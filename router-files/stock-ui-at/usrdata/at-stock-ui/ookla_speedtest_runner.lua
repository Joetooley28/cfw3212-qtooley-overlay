-- Copyright (C) 2026 Joe Tooley
-- SPDX-License-Identifier: GPL-2.0-or-later
-- See repository root LICENSE for full license text.

package.path = package.path .. ";/usrdata/at-stock-ui/?.lua"

local at_lock = require("at_lock")
local speedtest = require("ookla_speedtest")

local function now_utc()
    return os.date("!%Y-%m-%dT%H:%M:%SZ")
end

local function clean_arg(value)
    value = tostring(value or "")
    if value == "" or value == "-" then
        return nil
    end
    return value
end

local function shell_quote(value)
    value = tostring(value or "")
    return "'" .. value:gsub("'", "'\\''") .. "'"
end

local function finish(lock_fd, payload)
    payload = speedtest.write_state_file(payload or speedtest.default_state())
    speedtest.clear_pid()
    at_lock.release(lock_fd)
    return payload
end

local function write_live_state(snapshot, status_text, requested_server_id, selected_interface, last_started_at)
    speedtest.write_state_file({
        ok = true,
        phase = "running",
        running = true,
        installed = speedtest.file_exists(speedtest.paths.binary),
        status_text = status_text,
        error = nil,
        result = nil,
        live = snapshot,
        requested_server_id = requested_server_id or "",
        selected_interface = selected_interface or "",
        last_started_at = last_started_at
    })
end

local function build_command_args(selected_interface, requested_server_id)
    local args = {
        "HOME=" .. shell_quote(speedtest.paths.home),
        shell_quote(speedtest.paths.binary),
        "--accept-license",
        "--accept-gdpr",
        "-f",
        "json",
        "--progress=yes"
    }
    if selected_interface and selected_interface ~= "" then
        table.insert(args, "-I")
        table.insert(args, shell_quote(selected_interface))
    end
    if requested_server_id and requested_server_id ~= "" then
        table.insert(args, "-s")
        table.insert(args, shell_quote(requested_server_id))
    end
    return args
end

local function run_attempt(requested_server_id, selected_interface, started_at, attempt_number)
    local snapshot = {
        stage = "starting",
        progress = 0,
        ping_latency_ms = nil,
        ping_jitter_ms = nil,
        download_mbps = 0,
        upload_mbps = 0,
        server_name = "",
        server_location = "",
        interface_name = selected_interface or "",
        isp = ""
    }

    local args = build_command_args(selected_interface, requested_server_id)
    local handle = io.popen(table.concat(args, " ") .. " 2>&1", "r")
    if not handle then
        return nil, snapshot, {
            error = "speedtest_launch_failed",
            status_text = "Ookla Speedtest failed on the router.",
            detail = ""
        }, ""
    end

    local preparing_text = attempt_number > 1 and "Retrying Ookla Speedtest on the router..." or "Preparing Ookla Speedtest on the router..."
    write_live_state(snapshot, preparing_text, requested_server_id, selected_interface, started_at)

    local raw_lines = {}
    local final_result = nil
    local error_details = {}

    while true do
        local line = handle:read("*l")
        if not line then
            break
        end
        speedtest.capture_error_details(speedtest.parse_json_line(line), error_details)
        raw_lines[#raw_lines + 1] = line
        while #raw_lines > 120 do
            table.remove(raw_lines, 1)
        end

        local decoded = speedtest.parse_json_line(line)
        if decoded then
            speedtest.capture_error_details(decoded, error_details)
            snapshot = speedtest.progress_snapshot(decoded, snapshot)

            local status_text = "Running Ookla Speedtest on the router..."
            if attempt_number > 1 then
                status_text = "Retry " .. tostring(attempt_number) .. ": running Ookla Speedtest on the router..."
            end
            if snapshot.stage == "ping" then
                status_text = attempt_number > 1 and ("Retry " .. tostring(attempt_number) .. ": testing latency...") or "Testing latency..."
            elseif snapshot.stage == "download" then
                status_text = attempt_number > 1 and ("Retry " .. tostring(attempt_number) .. ": testing download speed...") or "Testing download speed..."
            elseif snapshot.stage == "upload" then
                status_text = attempt_number > 1 and ("Retry " .. tostring(attempt_number) .. ": testing upload speed...") or "Testing upload speed..."
            end

            write_live_state(snapshot, status_text, requested_server_id, selected_interface, started_at)

            if decoded.type == "result" then
                final_result = speedtest.normalize_result(decoded, requested_server_id, selected_interface)
            end
        end
    end

    handle:close()

    local raw_joined = table.concat(raw_lines, "\n")
    if not final_result then
        local decoded = speedtest.parse_last_json_line(raw_joined)
        if decoded and decoded.type == "result" then
            final_result = speedtest.normalize_result(decoded, requested_server_id, selected_interface)
            snapshot = speedtest.progress_snapshot(decoded, snapshot)
        end
    end

    if final_result then
        return final_result, snapshot, nil, raw_joined
    end

    return nil, snapshot, speedtest.describe_failure(raw_joined, error_details, snapshot), raw_joined
end

local requested_server_id = clean_arg(arg[1])
local selected_interface = clean_arg(arg[2])
if not selected_interface or selected_interface == "" then
    selected_interface = speedtest.detect_default_interface() or ""
end

local lock_fd, lock_err = at_lock.acquire(speedtest.paths.lock)
if not lock_fd then
    speedtest.write_state_file({
        ok = false,
        phase = "failed",
        running = false,
        error = lock_err == "at_channel_busy" and "speedtest_busy" or (lock_err or "speedtest_lock_failed"),
        status_text = "Another Ookla Speedtest is already running.",
        requested_server_id = requested_server_id or "",
        selected_interface = selected_interface or "",
        last_completed_at = now_utc()
    })
    speedtest.clear_pid()
    os.exit(1)
end

local ok, err = xpcall(function()
    local started_at = now_utc()
    speedtest.ensure_dir(speedtest.paths.home)
    local final_result, snapshot, failure, raw_joined = run_attempt(requested_server_id, selected_interface, started_at, 1)
    if not final_result and failure and failure.error == "speedtest_write_error" then
        write_live_state(snapshot, "Retrying after Ookla final-write failure...", requested_server_id, selected_interface, started_at)
        final_result, snapshot, failure, raw_joined = run_attempt(requested_server_id, selected_interface, started_at, 2)
    end

    if not final_result then
        finish(lock_fd, {
            ok = false,
            phase = "failed",
            running = false,
            error = failure and failure.error or "speedtest_failed",
            status_text = failure and failure.status_text or "Ookla Speedtest failed on the router.",
            requested_server_id = requested_server_id or "",
            selected_interface = selected_interface or "",
            live = snapshot,
            last_error_message = failure and failure.detail or "",
            raw_output = tostring(raw_joined or ""):sub(1, 2048),
            last_completed_at = now_utc()
        })
        return
    end

    finish(lock_fd, {
        ok = true,
        phase = "completed",
        running = false,
        error = nil,
        status_text = "Ookla Speedtest completed successfully.",
        requested_server_id = requested_server_id or "",
        selected_interface = final_result.interface_name or selected_interface or "",
        live = snapshot,
        result = final_result,
        last_completed_at = now_utc()
    })
end, debug.traceback)

if not ok then
    finish(lock_fd, {
        ok = false,
        phase = "failed",
        running = false,
        error = "speedtest_runner_crashed",
        status_text = "Ookla Speedtest runner crashed.",
        traceback = tostring(err):sub(1, 2048),
        requested_server_id = requested_server_id or "",
        selected_interface = selected_interface or "",
        last_completed_at = now_utc()
    })
    os.exit(1)
end
