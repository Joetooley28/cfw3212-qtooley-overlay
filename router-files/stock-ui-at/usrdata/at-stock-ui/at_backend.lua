local socket = require("socket")

local M = {}

local function shell_quote(s)
    return "'" .. tostring(s):gsub("'", [['"'"']]) .. "'"
end

local function now_ms()
    return math.floor(socket.gettime() * 1000)
end

local function read_all(path)
    local f = io.open(path, "rb")
    if not f then
        return ""
    end
    local data = f:read("*a") or ""
    f:close()
    return data
end

local function read_limited(path, max_bytes)
    local f = io.open(path, "rb")
    if not f then
        return "", false
    end

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

local function write_command(device_path, command)
    local f, err = io.open(device_path, "wb")
    if not f then
        return nil, "backend_open_failed:" .. tostring(err)
    end

    -- Command is written directly to the device, not interpolated into a shell.
    local ok, write_err = f:write(command, "\r")
    f:flush()
    f:close()

    if not ok then
        return nil, "backend_write_failed:" .. tostring(write_err)
    end

    return true, nil
end

local function last_nonempty_line(data)
    local normalized = (data or ""):gsub("\r\n", "\n"):gsub("\r", "\n")
    local last = nil
    for line in normalized:gmatch("([^\n]*)\n?") do
        local t = trim(line)
        if t ~= "" then
            last = t
        end
    end
    return last
end

local function terminal_status(data)
    local last = last_nonempty_line(data)
    if last == "OK" then
        return true, "OK"
    end
    if last == "ERROR" then
        return true, "ERROR"
    end
    if last and last:find("^%+CME ERROR:") then
        return true, "CME_ERROR"
    end
    if last and last:find("^%+CMS ERROR:") then
        return true, "CMS_ERROR"
    end
    return false, nil
end

local function cleanup(paths)
    for _, p in ipairs(paths) do
        if p then
            os.remove(p)
        end
    end
end

local function execute_ok(cmd)
    local a, b, c = os.execute(cmd)

    if type(a) == "number" then
        return a == 0
    end

    if type(a) == "boolean" then
        if a == true and (b == nil or b == "exit") and (c == nil or c == 0) then
            return true
        end
        return false
    end

    return false
end

local function start_reader(device_path, resp_path, pid_path, ready_path, timeout_ms)
    local timeout_sec = math.max(1, math.ceil(timeout_ms / 1000))
    local cmd =
        "sh -c " ..
        shell_quote(
            -- Verified on the live box: /usr/bin/timeout exists. The reader is
            -- started before the write because that is the only proven
            -- transactional pattern for this Casa platform. A small remaining
            -- race still exists between process existence and the reader being
            -- actively blocked in read(2), but this is more deterministic than
            -- a blind fixed sleep.
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
    local start_ms = now_ms()
    local deadline_ms = start_ms + timeout_ms
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

local function read_response_via_proven_pattern(device_path, command, timeout_ms, poll_interval_ms, max_response_bytes)
    local tag = tostring(os.time()) .. "." .. tostring(math.random(100000, 999999))
    local resp_path = "/tmp/at-http-response." .. tag
    local pid_path = "/tmp/at-http-reader." .. tag
    local ready_path = "/tmp/at-http-ready." .. tag

    local started, start_err = start_reader(device_path, resp_path, pid_path, ready_path, timeout_ms)
    if not started then
        cleanup({resp_path, pid_path, ready_path})
        return nil, true, false, start_err
    end

    local ready = wait_for_reader_ready(ready_path, math.min(timeout_ms, 500), poll_interval_ms)
    if not ready then
        stop_reader(pid_path)
        cleanup({resp_path, pid_path, ready_path})
        return nil, true, false, "backend_reader_not_ready"
    end

    local write_ok, write_err = write_command(device_path, command)
    if not write_ok then
        stop_reader(pid_path)
        cleanup({resp_path, pid_path, ready_path})
        return nil, false, false, write_err
    end

    local start_ms = now_ms()
    local deadline_ms = start_ms + timeout_ms
    local data = ""
    local truncated = false

    while now_ms() < deadline_ms do
        data, truncated = read_limited(resp_path, max_response_bytes)
        if truncated then
            break
        end
        local complete = terminal_status(data)
        if complete then
            break
        end
        socket.sleep((poll_interval_ms or 50) / 1000)
    end

    local complete = terminal_status(data)
    local timed_out = not truncated and not complete

    stop_reader(pid_path)

    cleanup({resp_path, pid_path, ready_path})

    return data, timed_out, truncated, nil
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

local function direct_transaction(config, command)
    local device_path, path_err = resolve_device_path(config)
    if not device_path then
        return nil, false, false, path_err
    end

    local timeout_ms = math.min(config.read_timeout_ms or 1500, config.hard_timeout_ms or 5000)
    local response, timed_out, truncated, read_err =
        read_response_via_proven_pattern(
            device_path,
            command,
            timeout_ms,
            config.poll_interval_ms or 50,
            config.max_response_bytes or 16384
        )

    if read_err then
        return nil, timed_out, truncated, read_err
    end

    return response, timed_out, truncated, nil, device_path
end

function M.run_transaction(config, command)
    local start_ms = now_ms()

    local response, timed_out, truncated, err, device_path = direct_transaction(config, command)

    local duration_ms = now_ms() - start_ms

    if not response and err then
        return {
            ok = false,
            command = command,
            response = "",
            timed_out = timed_out or false,
            truncated = truncated or false,
            duration_ms = duration_ms,
            backend = config.backend_mode,
            device_path = device_path or "",
            error = err
        }
    end

    return {
        ok = not timed_out and not truncated,
        command = command,
        response = response or "",
        timed_out = timed_out or false,
        truncated = truncated or false,
        duration_ms = duration_ms,
        backend = config.backend_mode,
        device_path = device_path or ""
    }
end

return M
