-- Copyright (C) 2026 Joe Tooley
-- SPDX-License-Identifier: GPL-2.0-or-later
-- See repository root LICENSE for full license text.

local JSON = require("JSON")

local M = {}

M.paths = {
    binary = "/usrdata/at-stock-ui/bin/speedtest",
    install_script = "/usrdata/at-stock-ui/install_ookla_speedtest_cli.sh",
    remove_script = "/usrdata/at-stock-ui/remove_ookla_speedtest_cli.sh",
    home = "/tmp/ookla-speedtest-home",
    state = "/tmp/ookla-speedtest-state.json",
    pid = "/tmp/ookla-speedtest.pid",
    lock = "/tmp/ookla-speedtest.lock",
    runner = "/usrdata/at-stock-ui/ookla_speedtest_runner.lua",
    runner_log = "/tmp/ookla-speedtest-runner.log"
}

local function shell_quote(value)
    value = tostring(value or "")
    return "'" .. value:gsub("'", "'\\''") .. "'"
end

local function read_file(path)
    local f = io.open(path, "rb")
    if not f then
        return nil
    end
    local raw = f:read("*a")
    f:close()
    return raw
end

local function write_file(path, content)
    local f = io.open(path, "wb")
    if not f then
        return false
    end
    f:write(content or "")
    f:close()
    return true
end

local function decode_json(raw)
    if not raw or raw == "" then
        return nil
    end
    local ok, decoded = pcall(function()
        return JSON:decode(raw)
    end)
    if ok and type(decoded) == "table" then
        return decoded
    end
    return nil
end

local function encode_json(value)
    local ok, encoded = pcall(function()
        return JSON:encode(value)
    end)
    if ok and type(encoded) == "string" then
        return encoded
    end
    return "{}"
end

local function trim(value)
    value = tostring(value or "")
    return value:gsub("^%s+", ""):gsub("%s+$", "")
end

local function classify_failure_message(raw_message, raw_text, snapshot)
    local message = trim(raw_message or "")
    local raw = tostring(raw_text or "")
    local snapshot_stage = snapshot and snapshot.stage or ""

    if message:find("Couldn%'t resolve host name", 1, false) or
       raw:find("Couldn%'t resolve host name", 1, false) or
       message:find("HostNotFoundException", 1, true) or
       raw:find("HostNotFoundException", 1, true) or
       message:find("Could not retrieve or read configuration", 1, true) or
       raw:find("Could not retrieve or read configuration", 1, true) or
       message:find("Cannot retrieve configuration document", 1, true) or
       raw:find("Cannot retrieve configuration document", 1, true) then
        return "speedtest_configuration_error", "The router could not reach Ookla because internet access or DNS is not working."
    end

    if message:find("NoServers", 1, true) or raw:find("NoServers", 1, true) then
        return "speedtest_no_servers", "The router could not reach a working Ookla server. Check router internet access and DNS, then try again."
    end

    if message:find("Cannot open socket", 1, true) or raw:find("Cannot open socket", 1, true) or
       message:find("Cannot read from socket", 1, true) or raw:find("Cannot read from socket", 1, true) or
       message:find("Timeout", 1, true) or raw:find("Timeout", 1, true) then
        return "speedtest_network_error", "The router could not reach the Ookla test server. Check router internet access and try again."
    end

    if message:find("Cannot write", 1, true) or raw:find("Cannot write", 1, true) then
        return "speedtest_write_error", "The Ookla CLI could not finish writing the final result payload."
    end

    if snapshot_stage == "upload" and tonumber(snapshot and snapshot.progress or 0) > 0.9 then
        return "speedtest_result_missing", "The test reached late upload, but the CLI never returned a final result."
    end

    return nil, message
end

local function round(value, decimals)
    value = tonumber(value)
    if not value then
        return nil
    end
    local factor = 10 ^ (decimals or 0)
    return math.floor((value * factor) + 0.5) / factor
end

local function command_status(command)
    local handle = io.popen(command, "r")
    if not handle then
        return nil
    end
    local output = handle:read("*a") or ""
    handle:close()
    return trim(output)
end

local function run_capture(command)
    local marker = "__QTOOLEY_SPEEDTEST_RC__="
    local wrapped = "(" .. command .. ") 2>&1; printf '\\n" .. marker .. "%s\\n' $?"
    local handle = io.popen(wrapped, "r")
    if not handle then
        return nil, nil, "popen_failed"
    end
    local raw = handle:read("*a") or ""
    handle:close()
    local rc = tonumber(raw:match(marker .. "(%d+)"))
    raw = trim((raw:gsub("\n?" .. marker .. "%d+\n?$", "")))
    return rc or 1, raw, nil
end

local function classify_action_failure(action_name, output, default_status)
    local raw = tostring(output or "")
    if action_name == "install" then
        if raw:find("Failed to download the Ookla CLI", 1, true) or
           raw:find("Could not resolve host", 1, true) or
           raw:find("Failed resolving", 1, true) or
           raw:find("bad address", 1, true) or
           raw:find("Connection timed out", 1, true) or
           raw:find("Network is unreachable", 1, true) then
            return "speedtest_install_download_failed", "Ookla install failed because the router could not reach the Ookla download site. Check router internet access and DNS."
        end
    end
    return nil, default_status
end

function M.file_exists(path)
    local f = io.open(path, "rb")
    if not f then
        return false
    end
    f:close()
    return true
end

function M.ensure_dir(path)
    os.execute("mkdir -p " .. shell_quote(path))
end

function M.read_state_file()
    return decode_json(read_file(M.paths.state))
end

function M.write_state_file(payload)
    local merged = payload or {}
    merged.binary_present = M.file_exists(M.paths.binary)
    merged.binary_path = M.paths.binary
    merged.install_script = M.paths.install_script
    merged.remove_script = M.paths.remove_script
    merged.default_interface = merged.default_interface or M.detect_default_interface() or ""
    local tmp_path = M.paths.state .. ".tmp"
    local ok = write_file(tmp_path, encode_json(merged))
    if ok then
        os.rename(tmp_path, M.paths.state)
    end
    return merged
end

function M.clear_pid()
    os.remove(M.paths.pid)
end

function M.stop_pid(pid)
    pid = tonumber(pid or M.read_pid())
    if not pid then
        return false
    end
    os.execute("kill " .. tostring(pid) .. " >/dev/null 2>&1")
    return true
end

function M.read_pid()
    local raw = trim(read_file(M.paths.pid) or "")
    local pid = tonumber(raw:match("^(%d+)$"))
    return pid
end

function M.pid_alive(pid)
    pid = tonumber(pid or M.read_pid())
    if not pid then
        return false
    end
    local rc = command_status("kill -0 " .. tostring(pid) .. " 2>/dev/null; echo $?")
    return rc == "0"
end

function M.detect_default_interface()
    local handle = io.popen("ip route 2>/dev/null", "r")
    if not handle then
        return ""
    end
    local raw = handle:read("*a") or ""
    handle:close()
    for line in raw:gmatch("([^\r\n]+)") do
        local iface = line:match("^default%s+via%s+%S+%s+dev%s+(%S+)")
        if iface then
            return iface
        end
    end
    return ""
end

local function not_installed_status_text()
    return "Ookla CLI is not installed on this router. Install it from this page when the router has internet access."
end

function M.default_state()
    local installed = M.file_exists(M.paths.binary)
    return {
        ok = true,
        phase = "idle",
        running = false,
        installed = installed,
        binary_present = installed,
        binary_path = M.paths.binary,
        install_script = M.paths.install_script,
        remove_script = M.paths.remove_script,
        default_interface = M.detect_default_interface() or "",
        result = nil,
        error = nil,
        status_text = installed and "Ready to run Ookla Speedtest from the router." or not_installed_status_text(),
        last_started_at = nil,
        last_completed_at = nil
    }
end

function M.get_state()
    local state = M.read_state_file() or M.default_state()
    state.installed = M.file_exists(M.paths.binary)
    state.binary_present = state.installed
    state.binary_path = M.paths.binary
    state.install_script = M.paths.install_script
    state.remove_script = M.paths.remove_script
    state.default_interface = state.default_interface or M.detect_default_interface() or ""

    local needs_failure_refresh =
        (state.phase == "failed" and (
            state.error == "speedtest_ended_without_result" or
            tostring(state.status_text or ""):find("^Testing ")
        ))

    if (state.running and not M.pid_alive()) or needs_failure_refresh then
        state.running = false
        if state.phase == "running" or state.phase == "preparing" or state.phase == "failed" then
            local failure = M.describe_failure(state.raw_output or "", {
                kind = state.error,
                message = state.last_error_message
            }, state.live or {})
            state.phase = "failed"
            state.ok = false
            state.error = failure.error or state.error or "speedtest_ended_without_result"
            state.status_text = failure.status_text or "The speed test process ended without a final result."
            state.last_error_message = failure.detail or state.last_error_message
            state.last_completed_at = state.last_completed_at or os.date("!%Y-%m-%dT%H:%M:%SZ")
            M.write_state_file(state)
        end
    end

    if not state.installed then
        local changed = false
        if state.running or
           state.phase ~= "idle" or
           state.error ~= nil or
           state.live ~= nil or
           state.result ~= nil or
           state.status_text ~= not_installed_status_text() then
            changed = true
        end
        state.running = false
        state.phase = "idle"
        state.error = nil
        state.live = nil
        state.result = nil
        state.status_text = not_installed_status_text()
        if changed then
            M.write_state_file(state)
        end
    end

    return state
end

function M.reset_idle_state()
    return M.write_state_file(M.default_state())
end

function M.recover_backend()
    M.stop_pid()
    M.clear_pid()
    os.remove(M.paths.runner_log)
    os.remove(M.paths.state)
    M.ensure_dir(M.paths.home)
    return M.reset_idle_state()
end

function M.sanitize_server_id(value)
    value = trim(value)
    if value == "" then
        return nil, nil
    end
    if not value:match("^%d+$") then
        return nil, "invalid_server_id"
    end
    return value, nil
end

function M.sanitize_interface(value)
    value = trim(value)
    if value == "" then
        value = M.detect_default_interface() or ""
    end
    if value ~= "" and not value:match("^[%w%._:%-]+$") then
        return nil, "invalid_interface"
    end
    return value, nil
end

function M.parse_last_json_line(raw)
    local last = nil
    for line in tostring(raw or ""):gmatch("([^\r\n]+)") do
        line = trim(line)
        if line:match("^%b{}$") then
            local decoded = decode_json(line)
            if decoded then
                last = decoded
            end
        end
    end
    return last
end

function M.parse_json_line(line)
    line = trim(line)
    if line == "" or not line:match("^%b{}$") then
        return nil
    end
    return decode_json(line)
end

local function ring_push(buffer, value, limit)
    limit = tonumber(limit or 80) or 80
    buffer[#buffer + 1] = value
    while #buffer > limit do
        table.remove(buffer, 1)
    end
end

function M.run_speedtest_command(args)
    if not M.file_exists(M.paths.binary) then
        return nil, "speedtest_binary_missing", ""
    end

    M.ensure_dir(M.paths.home)

    local parts = {
        "HOME=" .. shell_quote(M.paths.home),
        shell_quote(M.paths.binary),
        "--accept-license",
        "--accept-gdpr"
    }

    local i
    for i = 1, #args do
        table.insert(parts, args[i])
    end

    local command = table.concat(parts, " ") .. " 2>&1"
    local handle = io.popen(command, "r")
    if not handle then
        return nil, "speedtest_launch_failed", ""
    end

    local raw = handle:read("*a") or ""
    local ok, _, code = handle:close()
    local decoded = M.parse_last_json_line(raw)
    if decoded then
        return decoded, nil, raw
    end

    if ok == true or code == 0 then
        return nil, "speedtest_parse_failed", raw
    end

    return nil, "speedtest_command_failed", raw
end

function M.normalize_result(decoded, selected_server_id, selected_interface)
    local download_bandwidth = decoded and decoded.download and tonumber(decoded.download.bandwidth) or nil
    local upload_bandwidth = decoded and decoded.upload and tonumber(decoded.upload.bandwidth) or nil
    local result_url = decoded and decoded.result and decoded.result.url or ""

    return {
        timestamp = decoded and decoded.timestamp or "",
        download_mbps = round((download_bandwidth or 0) * 8 / 1000000, 2) or 0,
        upload_mbps = round((upload_bandwidth or 0) * 8 / 1000000, 2) or 0,
        download_bandwidth = download_bandwidth or 0,
        upload_bandwidth = upload_bandwidth or 0,
        download_bytes = decoded and decoded.download and tonumber(decoded.download.bytes) or 0,
        upload_bytes = decoded and decoded.upload and tonumber(decoded.upload.bytes) or 0,
        latency_ms = decoded and decoded.ping and tonumber(decoded.ping.latency) or nil,
        jitter_ms = decoded and decoded.ping and tonumber(decoded.ping.jitter) or nil,
        packet_loss = decoded and decoded.packetLoss,
        isp = decoded and decoded.isp or "",
        interface_name = decoded and decoded.interface and decoded.interface.name or (selected_interface or ""),
        external_ip = decoded and decoded.interface and decoded.interface.externalIp or "",
        internal_ip = decoded and decoded.interface and decoded.interface.internalIp or "",
        server_id = decoded and decoded.server and decoded.server.id or selected_server_id,
        server_name = decoded and decoded.server and decoded.server.name or "",
        server_location = decoded and decoded.server and decoded.server.location or "",
        server_country = decoded and decoded.server and decoded.server.country or "",
        server_host = decoded and decoded.server and decoded.server.host or "",
        result_url = result_url,
        result_png_url = result_url ~= "" and (result_url .. ".png") or "",
        raw = decoded
    }
end

function M.bandwidth_to_mbps(bytes_per_second)
    local numeric = tonumber(bytes_per_second)
    if not numeric then
        return 0
    end
    return round(numeric * 8 / 1000000, 2) or 0
end

function M.progress_snapshot(decoded, current)
    current = current or {}
    local snapshot = {
        stage = current.stage or "preparing",
        progress = current.progress or 0,
        ping_latency_ms = current.ping_latency_ms,
        ping_jitter_ms = current.ping_jitter_ms,
        download_mbps = current.download_mbps or 0,
        upload_mbps = current.upload_mbps or 0,
        server_name = current.server_name or "",
        server_location = current.server_location or "",
        interface_name = current.interface_name or "",
        isp = current.isp or ""
    }

    if type(decoded) ~= "table" then
        return snapshot
    end

    if decoded.type == "testStart" then
        snapshot.stage = "starting"
        snapshot.server_name = decoded.server and decoded.server.name or snapshot.server_name
        snapshot.server_location = decoded.server and decoded.server.location or snapshot.server_location
        snapshot.interface_name = decoded.interface and decoded.interface.name or snapshot.interface_name
        snapshot.isp = decoded.isp or snapshot.isp
        return snapshot
    end

    if decoded.type == "ping" then
        snapshot.stage = "ping"
        snapshot.progress = decoded.ping and tonumber(decoded.ping.progress) or snapshot.progress
        snapshot.ping_latency_ms = decoded.ping and tonumber(decoded.ping.latency) or snapshot.ping_latency_ms
        snapshot.ping_jitter_ms = decoded.ping and tonumber(decoded.ping.jitter) or snapshot.ping_jitter_ms
        return snapshot
    end

    if decoded.type == "download" then
        snapshot.stage = "download"
        snapshot.progress = decoded.download and tonumber(decoded.download.progress) or snapshot.progress
        snapshot.download_mbps = decoded.download and M.bandwidth_to_mbps(decoded.download.bandwidth) or snapshot.download_mbps
        return snapshot
    end

    if decoded.type == "upload" then
        snapshot.stage = "upload"
        snapshot.progress = decoded.upload and tonumber(decoded.upload.progress) or snapshot.progress
        snapshot.upload_mbps = decoded.upload and M.bandwidth_to_mbps(decoded.upload.bandwidth) or snapshot.upload_mbps
        return snapshot
    end

    if decoded.type == "result" then
        snapshot.stage = "completed"
        snapshot.progress = 1
        snapshot.download_mbps = decoded.download and M.bandwidth_to_mbps(decoded.download.bandwidth) or snapshot.download_mbps
        snapshot.upload_mbps = decoded.upload and M.bandwidth_to_mbps(decoded.upload.bandwidth) or snapshot.upload_mbps
        return snapshot
    end

    return snapshot
end

function M.capture_error_details(decoded, current)
    current = current or {}
    if type(decoded) ~= "table" then
        return current
    end

    if decoded.error and tostring(decoded.error) ~= "" then
        current.message = tostring(decoded.error)
        current.kind = current.kind or "speedtest_runtime_error"
    elseif decoded.type == "log" and tostring(decoded.level or "") == "error" and tostring(decoded.message or "") ~= "" then
        current.message = tostring(decoded.message)
        current.kind = current.kind or "speedtest_runtime_error"
    else
        return current
    end

    local kind = classify_failure_message(current.message, current.message, {})
    if kind then
        current.kind = kind
    end

    return current
end

function M.describe_failure(raw, error_details, snapshot)
    raw = tostring(raw or "")
    error_details = error_details or {}
    snapshot = snapshot or {}

    local kind = error_details.kind or "speedtest_failed"
    local message = trim(error_details.message or "")

    local classified_kind, classified_message = classify_failure_message(message, raw, snapshot)
    if classified_kind then
        kind = classified_kind
        message = classified_message or message
    end

    local status_text = "Ookla Speedtest failed on the router."
    if message ~= "" then
        status_text = message
    end

    return {
        error = kind,
        status_text = status_text,
        detail = message
    }
end

function M.run_speedtest_once(options)
    options = options or {}
    local args = { "-f", "json", "-p", "no" }
    if options.interface and options.interface ~= "" then
        table.insert(args, "-I")
        table.insert(args, options.interface)
    end
    if options.server_id and options.server_id ~= "" then
        table.insert(args, "-s")
        table.insert(args, tostring(options.server_id))
    end

    local decoded, err, raw = M.run_speedtest_command(args)
    if not decoded then
        return nil, err, raw
    end
    if decoded.type ~= "result" then
        return nil, "speedtest_unexpected_payload", raw
    end
    return M.normalize_result(decoded, options.server_id, options.interface), nil, raw
end

function M.list_servers(options)
    options = options or {}
    local args = { "-L", "-f", "json" }
    if options.interface and options.interface ~= "" then
        table.insert(args, "-I")
        table.insert(args, options.interface)
    end
    local decoded, err, raw = M.run_speedtest_command(args)
    if not decoded then
        return nil, err, raw
    end
    if decoded.type ~= "serverList" or type(decoded.servers) ~= "table" then
        return nil, "speedtest_server_list_failed", raw
    end

    return {
        ok = true,
        servers = decoded.servers,
        fetched_at = decoded.timestamp or "",
        default_interface = options.interface or M.detect_default_interface() or "",
        installed = M.file_exists(M.paths.binary),
        binary_path = M.paths.binary,
        install_script = M.paths.install_script,
        remove_script = M.paths.remove_script
    }, nil, raw
end

function M.start_background(options)
    options = options or {}
    local server_arg = options.server_id and tostring(options.server_id) or "-"
    local interface_arg = options.interface and tostring(options.interface) or "-"

    local state = M.write_state_file({
        ok = true,
        phase = "preparing",
        running = true,
        installed = M.file_exists(M.paths.binary),
        status_text = "Preparing Ookla Speedtest on the router...",
        error = nil,
        result = nil,
        requested_server_id = options.server_id or "",
        selected_interface = options.interface or "",
        last_started_at = os.date("!%Y-%m-%dT%H:%M:%SZ")
    })

    local command = "/bin/sh -c " .. shell_quote(
        "/usr/bin/lua " .. shell_quote(M.paths.runner) ..
        " " .. shell_quote(server_arg) ..
        " " .. shell_quote(interface_arg) ..
        " >" .. shell_quote(M.paths.runner_log) .. " 2>&1 & echo $! > " .. shell_quote(M.paths.pid)
    )
    os.execute(command)

    return state
end

local function action_result(ok, action_name, output, opts)
    opts = opts or {}

    if ok and (action_name == "install" or action_name == "remove") then
        M.recover_backend()
    end

    local state = M.get_state()
    state.action = action_name
    state.action_output = trim(output or "")
    state.ok = ok

    if ok then
        if action_name == "install" then
            state.status_text = "Ookla CLI installed successfully on the router."
        elseif action_name == "remove" then
            state.status_text = "Ookla CLI removed from the router."
        end
        return state
    end

    local classified_error, classified_status = classify_action_failure(action_name, output, opts.status_text or state.status_text)
    state.error = classified_error or opts.error or "speedtest_action_failed"
    state.status_text = classified_status or opts.status_text or state.status_text
    return state
end

local function run_system_action(action_name, command, opts)
    local rc, output, err = run_capture(command)
    if err then
        return {
            ok = false,
            error = err,
            status_text = opts and opts.status_text or "Speedtest action failed on the router."
        }
    end
    return action_result(rc == 0, action_name, output, opts)
end

function M.install()
    return run_system_action("install", "/bin/sh " .. shell_quote(M.paths.install_script), {
        error = "speedtest_install_failed",
        status_text = "Ookla install failed on the router."
    })
end

function M.remove()
    return run_system_action("remove", "/bin/sh " .. shell_quote(M.paths.remove_script), {
        error = "speedtest_remove_failed",
        status_text = "Ookla remove failed on the router."
    })
end

return M
