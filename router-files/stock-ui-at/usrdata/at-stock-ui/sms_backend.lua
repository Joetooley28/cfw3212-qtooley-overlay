-- Copyright (C) 2026 Joe Tooley
-- SPDX-License-Identifier: GPL-2.0-or-later
-- See repository root LICENSE for full license text.

local socket = require("socket")
local backend = require("at_backend")
local at_lock = require("at_lock")

local M = {}

local function now_ms()
    return math.floor(socket.gettime() * 1000)
end

local function shell_quote(s)
    return "'" .. tostring(s):gsub("'", [['"'"']]) .. "'"
end

local function read_all(path)
    local f = io.open(path, "rb")
    if not f then return "" end
    local data = f:read("*a") or ""
    f:close()
    return data
end

local function read_limited(path, max_bytes)
    local f = io.open(path, "rb")
    if not f then return "", false end
    local data = f:read(max_bytes + 1) or ""
    f:close()
    if #data > max_bytes then
        return data:sub(1, max_bytes), true
    end
    return data, false
end

local function trim(s)
    return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function execute_ok(cmd)
    local a, b, c = os.execute(cmd)
    if type(a) == "number" then return a == 0 end
    if type(a) == "boolean" then
        if a == true and (b == nil or b == "exit") and (c == nil or c == 0) then return true end
        return false
    end
    return false
end

local function resolve_device_path(config)
    local mode = config.backend_mode
    local modes = config.backend_modes or {}
    local selected = modes[mode]
    if not selected or not selected.device_path then
        return nil, "unknown_backend_mode"
    end
    return selected.device_path, nil
end

local function write_to_device(device_path, data)
    local f, err = io.open(device_path, "wb")
    if not f then
        return nil, "backend_open_failed:" .. tostring(err)
    end
    local ok, write_err = f:write(data)
    f:flush()
    f:close()
    if not ok then
        return nil, "backend_write_failed:" .. tostring(write_err)
    end
    return true, nil
end

-- Check if response data contains a terminal status (OK or ERROR)
local function terminal_status(data)
    local normalized = (data or ""):gsub("\r\n", "\n"):gsub("\r", "\n")
    local last = nil
    for line in normalized:gmatch("([^\n]*)\n?") do
        local t = trim(line)
        if t ~= "" then last = t end
    end
    if last == "OK" then return true, "OK" end
    if last == "ERROR" then return true, "ERROR" end
    if (data or ""):match("%+CMS ERROR") then return true, "ERROR" end
    return false, nil
end

-- Check if response contains the ">" prompt for SMS input
local function has_prompt(data)
    return (data or ""):match(">") ~= nil
end

-- Start a background reader process that captures device output to a file
local function start_reader(device_path, resp_path, pid_path, ready_path, timeout_ms)
    local timeout_sec = math.max(1, math.ceil(timeout_ms / 1000))
    local cmd =
        "sh -c " ..
        shell_quote(
            ": > " .. shell_quote(resp_path) ..
            "; timeout " .. timeout_sec ..
            " cat " .. shell_quote(device_path) ..
            " > " .. shell_quote(resp_path) ..
            " 2>/dev/null & pid=$!; echo $pid > " .. shell_quote(pid_path) ..
            "; i=0; while [ $i -lt 50 ]; do if [ -d /proc/$pid ]; then : > " .. shell_quote(ready_path) .. "; break; fi; i=$((i+1)); sleep 0.01; done"
        )
    if not execute_ok(cmd) then
        return false, "backend_read_start_failed"
    end
    return true, nil
end

local function stop_reader(pid_path)
    local pid = read_all(pid_path):match("(%d+)")
    if pid then
        os.execute("kill " .. pid .. " >/dev/null 2>&1")
    end
end

local function wait_for_reader_ready(ready_path, timeout_ms, poll_interval_ms)
    local deadline_ms = now_ms() + timeout_ms
    while now_ms() < deadline_ms do
        local attrs = io.open(ready_path, "rb")
        if attrs then
            attrs:close()
            return true
        end
        socket.sleep((poll_interval_ms or 50) / 1000)
    end
    return false
end

local function cleanup(paths)
    for _, p in ipairs(paths) do
        if p then os.remove(p) end
    end
end

-- ══════════════════════════════════════════════════════════════════
-- SMS-specific two-step send transaction
--
-- AT+CMGS requires:
--   1. Send  AT+CMGS="phone"\r  →  modem responds with "> "
--   2. Send  message_text\x1A   →  modem responds with +CMGS: <mr>\r\nOK
-- ══════════════════════════════════════════════════════════════════

function M.send_sms(config, phone_number, message_text)
    local start_ms = now_ms()

    local device_path, path_err = resolve_device_path(config)
    if not device_path then
        return { ok = false, error = path_err, duration_ms = 0 }
    end

    -- Use longer timeouts for SMS (network dependent, up to 120s per spec)
    local timeout_ms = math.min(config.sms_timeout_ms or 30000, 60000)
    local poll_ms = config.poll_interval_ms or 50
    local max_bytes = config.max_response_bytes or 16384

    local tag = tostring(os.time()) .. "." .. tostring(math.random(100000, 999999))
    local resp_path = "/tmp/at-sms-response." .. tag
    local pid_path = "/tmp/at-sms-reader." .. tag
    local ready_path = "/tmp/at-sms-ready." .. tag
    local paths = { resp_path, pid_path, ready_path }

    -- First, set text mode: AT+CMGF=1
    local mode_result = backend.run_transaction(config, 'AT+CMGF=1')
    if type(mode_result) ~= "table" or not mode_result.ok then
        return {
            ok = false,
            error = "sms_mode_set_failed",
            duration_ms = now_ms() - start_ms
        }
    end

    -- Start reader for the interactive CMGS sequence
    local started, start_err = start_reader(device_path, resp_path, pid_path, ready_path, timeout_ms)
    if not started then
        cleanup(paths)
        return { ok = false, error = start_err or "reader_start_failed", duration_ms = now_ms() - start_ms }
    end

    local ready = wait_for_reader_ready(ready_path, math.min(timeout_ms, 500), poll_ms)
    if not ready then
        stop_reader(pid_path)
        cleanup(paths)
        return { ok = false, error = "backend_reader_not_ready", duration_ms = now_ms() - start_ms }
    end

    -- Step 1: Send AT+CMGS="phone"\r
    local cmgs_cmd = 'AT+CMGS="' .. phone_number .. '"\r'
    local w_ok, w_err = write_to_device(device_path, cmgs_cmd)
    if not w_ok then
        stop_reader(pid_path)
        cleanup(paths)
        return { ok = false, error = w_err or "cmgs_write_failed", duration_ms = now_ms() - start_ms }
    end

    -- Wait for ">" prompt
    local prompt_deadline = now_ms() + 10000
    local got_prompt = false
    while now_ms() < prompt_deadline do
        local data = read_all(resp_path)
        if has_prompt(data) then
            got_prompt = true
            break
        end
        -- Check for early error
        local complete, status = terminal_status(data)
        if complete then
            stop_reader(pid_path)
            cleanup(paths)
            return {
                ok = false,
                error = "sms_rejected",
                response = data,
                duration_ms = now_ms() - start_ms
            }
        end
        socket.sleep(poll_ms / 1000)
    end

    if not got_prompt then
        -- Send escape to cancel
        write_to_device(device_path, "\x1B")
        socket.sleep(0.2)
        stop_reader(pid_path)
        cleanup(paths)
        return { ok = false, error = "sms_no_prompt", duration_ms = now_ms() - start_ms }
    end

    -- Step 2: Send message text followed by Ctrl+Z (0x1A)
    local msg_data = message_text .. "\x1A"
    local m_ok, m_err = write_to_device(device_path, msg_data)
    if not m_ok then
        -- Try to cancel
        write_to_device(device_path, "\x1B")
        socket.sleep(0.2)
        stop_reader(pid_path)
        cleanup(paths)
        return { ok = false, error = m_err or "msg_write_failed", duration_ms = now_ms() - start_ms }
    end

    -- Wait for OK/ERROR (network send can take several seconds)
    local send_deadline = now_ms() + timeout_ms
    local final_data = ""
    local truncated = false
    while now_ms() < send_deadline do
        final_data, truncated = read_limited(resp_path, max_bytes)
        if truncated then break end
        local complete = terminal_status(final_data)
        if complete then break end
        socket.sleep(poll_ms / 1000)
    end

    stop_reader(pid_path)
    cleanup(paths)

    local complete, status = terminal_status(final_data)
    local timed_out = not truncated and not complete

    -- Extract message reference from +CMGS: <mr>
    local mr = (final_data or ""):match("%+CMGS:%s*(%d+)")

    return {
        ok = (status == "OK") and not timed_out and not truncated,
        response = final_data or "",
        message_reference = mr and tonumber(mr) or nil,
        timed_out = timed_out,
        truncated = truncated,
        duration_ms = now_ms() - start_ms,
        error = timed_out and "timeout" or (status == "ERROR" and "sms_send_failed" or nil)
    }
end

-- ══════════════════════════════════════════════════════════════════
-- List all SMS messages (uses standard single-command backend)
-- Returns parsed message list
-- ══════════════════════════════════════════════════════════════════

function M.list_messages(config)
    -- Set text mode
    local mode_result = backend.run_transaction(config, 'AT+CMGF=1')
    if type(mode_result) ~= "table" or not mode_result.ok then
        return { ok = false, error = "sms_mode_set_failed", messages = {} }
    end

    -- Show extra params for richer data
    backend.run_transaction(config, 'AT+CSDH=1')

    -- List all messages
    local result = backend.run_transaction(config, 'AT+CMGL="ALL"')
    if type(result) ~= "table" then
        return { ok = false, error = "backend_bad_result", messages = {} }
    end
    if not result.ok then
        return { ok = false, error = result.error or "list_failed", messages = {} }
    end

    local messages = M.parse_cmgl_response(result.response or "")

    -- Also get storage info
    local storage_result = backend.run_transaction(config, 'AT+CPMS?')
    local storage = nil
    if type(storage_result) == "table" and storage_result.ok then
        storage = M.parse_cpms_response(storage_result.response or "")
    end

    return { ok = true, messages = messages, storage = storage }
end

-- ══════════════════════════════════════════════════════════════════
-- Read a single message by index
-- ══════════════════════════════════════════════════════════════════

function M.read_message(config, index)
    local mode_result = backend.run_transaction(config, 'AT+CMGF=1')
    if type(mode_result) ~= "table" or not mode_result.ok then
        return { ok = false, error = "sms_mode_set_failed" }
    end

    backend.run_transaction(config, 'AT+CSDH=1')

    local result = backend.run_transaction(config, 'AT+CMGR=' .. tostring(index))
    if type(result) ~= "table" then
        return { ok = false, error = "backend_bad_result" }
    end
    if not result.ok then
        return { ok = false, error = result.error or "read_failed" }
    end

    local message = M.parse_cmgr_response(result.response or "", index)
    if not message then
        return { ok = false, error = "parse_failed", raw = result.response }
    end

    return { ok = true, message = message }
end

-- ══════════════════════════════════════════════════════════════════
-- Delete a message by index (or delete by flag)
-- ══════════════════════════════════════════════════════════════════

function M.delete_message(config, index, delflag)
    local cmd = 'AT+CMGD=' .. tostring(index)
    if delflag and tonumber(delflag) then
        cmd = cmd .. ',' .. tostring(delflag)
    end
    local result = backend.run_transaction(config, cmd)
    if type(result) ~= "table" then
        return { ok = false, error = "backend_bad_result" }
    end
    return { ok = result.ok, error = result.error, response = result.response }
end

-- ══════════════════════════════════════════════════════════════════
-- Get SMS storage info
-- ══════════════════════════════════════════════════════════════════

function M.get_storage(config)
    local result = backend.run_transaction(config, 'AT+CPMS?')
    if type(result) ~= "table" or not result.ok then
        return { ok = false, error = "storage_query_failed" }
    end
    local storage = M.parse_cpms_response(result.response or "")
    return { ok = true, storage = storage }
end

-- ══════════════════════════════════════════════════════════════════
-- Response parsers
-- ══════════════════════════════════════════════════════════════════

-- Parse AT+CMGL="ALL" response (text mode)
-- Format: +CMGL: <index>,<stat>,<oa/da>,[<alpha>],[<scts>][,<tooa/toda>,<length>]\r\n<data>
function M.parse_cmgl_response(raw)
    local messages = {}
    local normalized = (raw or ""):gsub("\r\n", "\n"):gsub("\r", "\n")

    -- Split into lines
    local lines = {}
    for line in normalized:gmatch("([^\n]*)\n?") do
        table.insert(lines, line)
    end

    local i = 1
    while i <= #lines do
        local line = lines[i]
        -- Match +CMGL: header line
        local idx, stat, addr, alpha, scts = line:match(
            '^%+CMGL:%s*(%d+),"([^"]*)",?"?([^",]*)"?,?"?([^",]*)"?,?"?([^"]*)"?'
        )
        if idx then
            -- Next line(s) are the message body
            local body_parts = {}
            i = i + 1
            while i <= #lines do
                local next_line = lines[i]
                -- Stop if we hit another +CMGL header, OK, or ERROR
                if next_line:match("^%+CMGL:") or trim(next_line) == "OK" or trim(next_line) == "ERROR" then
                    break
                end
                table.insert(body_parts, next_line)
                i = i + 1
            end
            local body = trim(table.concat(body_parts, "\n"))

            table.insert(messages, {
                index = tonumber(idx),
                status = stat,
                address = trim(addr):gsub('^"', ""):gsub('"$', ""),
                alpha = trim(alpha or ""),
                timestamp = trim(scts or ""):gsub('^"', ""):gsub('"$', ""),
                body = body
            })
        else
            i = i + 1
        end
    end

    return messages
end

-- Parse AT+CMGR response (text mode)
-- Format: +CMGR: <stat>,<oa>,[<alpha>],<scts>[,...]\r\n<data>
function M.parse_cmgr_response(raw, index)
    local normalized = (raw or ""):gsub("\r\n", "\n"):gsub("\r", "\n")
    local lines = {}
    for line in normalized:gmatch("([^\n]*)\n?") do
        table.insert(lines, line)
    end

    for i, line in ipairs(lines) do
        local stat, addr, alpha, scts = line:match(
            '^%+CMGR:%s*"([^"]*)",?"?([^",]*)"?,?"?([^",]*)"?,?"?([^"]*)"?'
        )
        if stat then
            local body_parts = {}
            for j = i + 1, #lines do
                local next_line = lines[j]
                if trim(next_line) == "OK" or trim(next_line) == "ERROR" then break end
                table.insert(body_parts, next_line)
            end
            return {
                index = index,
                status = stat,
                address = trim(addr):gsub('^"', ""):gsub('"$', ""),
                alpha = trim(alpha or ""),
                timestamp = trim(scts or ""):gsub('^"', ""):gsub('"$', ""),
                body = trim(table.concat(body_parts, "\n"))
            }
        end
    end

    return nil
end

-- Parse AT+CPMS? response
-- Format: +CPMS: "ME",used,total,"ME",used,total,"ME",used,total
function M.parse_cpms_response(raw)
    local mem1, used1, total1, mem2, used2, total2, mem3, used3, total3 = (raw or ""):match(
        '%+CPMS:%s*"([^"]+)",(%d+),(%d+),"([^"]+)",(%d+),(%d+),"([^"]+)",(%d+),(%d+)'
    )
    if mem1 then
        return {
            read  = { memory = mem1, used = tonumber(used1),  total = tonumber(total1) },
            write = { memory = mem2, used = tonumber(used2),  total = tonumber(total2) },
            recv  = { memory = mem3, used = tonumber(used3),  total = tonumber(total3) }
        }
    end
    return nil
end

return M
