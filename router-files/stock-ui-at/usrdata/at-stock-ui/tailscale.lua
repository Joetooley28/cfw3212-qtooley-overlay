local JSON = require("JSON")

local M = {}

M.paths = {
    runtime_dir = "/usrdata/tailscale",
    binary = "/usrdata/tailscale/tailscale",
    daemon = "/usrdata/tailscale/tailscaled",
    socket = "/usrdata/tailscale/tailscaled.sock",
    state_dir = "/usrdata/tailscale/state",
    systemd_dir = "/usrdata/tailscale/systemd",
    install_script = "/usrdata/at-stock-ui/install_tailscale.sh",
    remove_script = "/usrdata/at-stock-ui/remove_tailscale.sh",
    raw_output = "/tmp/qtooley-tailscale-last-output.txt",
    last_action = "/tmp/qtooley-tailscale-last-action.txt"
}

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

local function trim(value)
    value = tostring(value or "")
    return value:gsub("^%s+", ""):gsub("%s+$", "")
end

local function shell_quote(value)
    value = tostring(value or "")
    return "'" .. value:gsub("'", "'\\''") .. "'"
end

local function file_exists(path)
    local f = io.open(path, "rb")
    if not f then
        return false
    end
    f:close()
    return true
end

local function record_output(action_name, output)
    write_file(M.paths.last_action, trim(action_name or ""))
    write_file(M.paths.raw_output, tostring(output or ""):sub(1, 32768))
end

local function read_recorded_output()
    return trim(read_file(M.paths.raw_output) or "")
end

local function read_last_action()
    return trim(read_file(M.paths.last_action) or "")
end

local function run_capture(command)
    local marker = "__QTOOLEY_TS_RC__="
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

local function service_active()
    local rc = run_capture("systemctl is-active tailscaled >/dev/null 2>&1")
    return rc == 0
end

local function service_enabled()
    local rc = run_capture("systemctl is-enabled tailscaled >/dev/null 2>&1")
    return rc == 0
end

local function tailscale_installed()
    return file_exists(M.paths.binary) and file_exists(M.paths.daemon)
end

local function parse_auth_url(text)
    text = tostring(text or "")
    local url = text:match("(https://[%w%-%._~:/%?#%[%]@!$&'()%*+,;=]+)")
    return trim(url or "")
end

local function clean_peer_name(peer)
    if type(peer) ~= "table" then
        return "Peer"
    end
    local name = peer.HostName or peer.Name or peer.ComputedName or ""
    if name == "" and peer.DNSName then
        name = tostring(peer.DNSName):gsub("%.$", ""):match("^([^%.]+)") or peer.DNSName
    end
    name = trim(name)
    if name == "" then
        return "Peer"
    end
    return name
end

local function peer_ip(peer)
    if type(peer) ~= "table" then
        return ""
    end
    if type(peer.TailscaleIPs) == "table" and peer.TailscaleIPs[1] then
        return tostring(peer.TailscaleIPs[1])
    end
    if peer.TailscaleIP then
        return tostring(peer.TailscaleIP)
    end
    return ""
end

local function format_last_seen(peer)
    if type(peer) ~= "table" then
        return ""
    end
    if peer.Online == true then
        return "Connected now"
    end
    if type(peer.LastSeen) == "string" and trim(peer.LastSeen) ~= "" then
        return trim(peer.LastSeen)
    end
    return "Offline"
end

local function sort_peers(peers)
    table.sort(peers, function(a, b)
        if a.connected ~= b.connected then
            return a.connected
        end
        return tostring(a.name or ""):lower() < tostring(b.name or ""):lower()
    end)
end

local function gather_peers(status_json)
    local out = {}
    if type(status_json) ~= "table" or type(status_json.Peer) ~= "table" then
        return out
    end
    for _, peer in pairs(status_json.Peer) do
        out[#out + 1] = {
            name = clean_peer_name(peer),
            tailscale_ip = peer_ip(peer),
            connected = peer and peer.Online == true or false,
            last_seen = format_last_seen(peer)
        }
    end
    sort_peers(out)
    return out
end

local function cli_base()
    return shell_quote(M.paths.binary) .. " --socket=" .. shell_quote(M.paths.socket)
end

local function cli_capture(args)
    if not tailscale_installed() then
        return 1, "", "tailscale_not_installed"
    end
    return run_capture(cli_base() .. " " .. args)
end

local function status_json()
    if not tailscale_installed() or not service_active() then
        return nil
    end
    local rc, output = cli_capture("status --json")
    if rc ~= 0 then
        return nil, output
    end
    return decode_json(output), output
end

local function effective_raw_output(status_raw)
    local recorded = read_recorded_output()
    if recorded ~= "" then
        return recorded
    end
    if trim(status_raw or "") ~= "" then
        return trim(status_raw)
    end
    return ""
end

local function prefs_json()
    if not tailscale_installed() or not service_active() then
        return nil
    end
    local rc, output = cli_capture("debug prefs --json")
    if rc ~= 0 then
        return nil
    end
    return decode_json(output)
end

local function cli_ipv4()
    if not tailscale_installed() or not service_active() then
        return ""
    end
    local rc, output = cli_capture("ip -4")
    if rc ~= 0 then
        return ""
    end
    return trim((output:gmatch("([^\r\n]+)")()) or output)
end

local function local_hostname()
    local rc, output = run_capture("hostname")
    if rc ~= 0 then
        return ""
    end
    return trim(output)
end

local function backend_state_text(backend_state, auth_url, active, installed)
    if not installed then
        return "Tailscale is not installed on this router."
    end
    if not active then
        return "Tailscale is installed but the service is stopped."
    end
    if auth_url ~= "" or backend_state == "NeedsLogin" then
        return "Tailscale needs browser authorization."
    end
    if backend_state == "Running" then
        return "Tailscale is connected on this router."
    end
    if backend_state == "Starting" then
        return "Tailscale is starting on this router."
    end
    if backend_state ~= "" then
        return "Tailscale backend state: " .. backend_state
    end
    return "Tailscale state is available."
end

local function is_pending_login_state(state)
    if type(state) ~= "table" then
        return false
    end
    return trim(state.backend_state or "") == "NeedsLogin" or trim(state.auth_url or "") ~= ""
end

function M.get_state()
    local installed = tailscale_installed()
    local active = service_active()
    local enabled = service_enabled()
    local raw_output = ""
    local auth_url = ""

    local status, status_raw = status_json()
    local prefs = prefs_json()
    local backend_state = status and trim(status.BackendState or "") or ""
    local peers = gather_peers(status)
    local hostname = local_hostname()
    local tailscale_ip = ""
    local logged_in = false

    if type(status) == "table" and type(status.Self) == "table" then
        hostname = trim(status.Self.HostName or hostname)
        if type(status.Self.TailscaleIPs) == "table" and status.Self.TailscaleIPs[1] then
            tailscale_ip = tostring(status.Self.TailscaleIPs[1])
        end
        logged_in = status.Self.Online == true or (type(status.Self.TailscaleIPs) == "table" and status.Self.TailscaleIPs[1] ~= nil)
    end
    if tailscale_ip == "" then
        tailscale_ip = cli_ipv4()
    end
    if type(status) == "table" and trim(status.AuthURL or "") ~= "" then
        auth_url = trim(status.AuthURL or "")
    end
    if auth_url == "" and not logged_in and backend_state == "NeedsLogin" then
        auth_url = parse_auth_url(raw_output)
    end
    if auth_url == "" and not logged_in and backend_state == "NeedsLogin" and status_raw and status_raw ~= "" then
        auth_url = parse_auth_url(status_raw)
    end
    if logged_in or backend_state == "Running" then
        auth_url = ""
    end

    local ssh_enabled = false
    if type(prefs) == "table" then
        ssh_enabled = prefs.RunSSH == true or prefs.SSH == true
    end

    raw_output = effective_raw_output(status_raw)

    return {
        ok = true,
        installed = installed,
        service_active = active,
        service_enabled = enabled,
        logged_in = logged_in,
        hostname = hostname,
        tailscale_ip = tailscale_ip,
        ssh_enabled = ssh_enabled,
        status_text = backend_state_text(backend_state, auth_url, active, installed),
        auth_url = auth_url,
        peers = peers,
        raw_output = raw_output,
        last_action = read_last_action(),
        backend_state = backend_state,
        install_script = M.paths.install_script,
        remove_script = M.paths.remove_script
    }
end

function M.get_raw()
    local status, status_raw = status_json()
    return {
        ok = true,
        raw_output = effective_raw_output(status_raw),
        last_action = read_last_action()
    }
end

local function action_result(ok, action_name, output, opts)
    opts = opts or {}
    record_output(action_name, output)
    local state = M.get_state()
    state.action = action_name
    state.action_output = trim(output or "")
    state.auth_url = state.auth_url ~= "" and state.auth_url or parse_auth_url(output)
    if opts.allow_auth_pending and (state.auth_url ~= "" or is_pending_login_state(state)) then
        state.ok = true
        state.pending_auth = true
        state.status_text = "Tailscale needs browser authorization."
        return state
    end
    state.ok = ok
    if ok then
        if tostring(output or ""):find("QTOOLEY_TAILSCALE_ALREADY_CURRENT=1", 1, true) then
            state.already_current = true
            state.status_text = "Tailscale is already up to date on this router."
        elseif tostring(output or ""):find("QTOOLEY_TAILSCALE_FORCED_REINSTALL=1", 1, true) then
            state.status_text = "Tailscale was reinstalled on the router."
        elseif tostring(output or ""):find("QTOOLEY_TAILSCALE_UPDATED=1", 1, true) then
            state.status_text = "Tailscale was installed or updated successfully."
        end
    end
    if not ok then
        state.error = opts.error or "tailscale_action_failed"
        state.status_text = opts.status_text or state.status_text
    end
    return state
end

local function run_system_action(action_name, command, opts)
    local rc, output = run_capture(command)
    return action_result(rc == 0, action_name, output, opts)
end

local function run_cli_action(action_name, args, opts)
    local rc, output, err = cli_capture(args)
    if err then
        return {
            ok = false,
            error = err,
            status_text = "Tailscale is not installed on this router."
        }
    end
    return action_result(rc == 0, action_name, output, opts)
end

function M.install()
    return run_system_action("install", "/bin/sh " .. shell_quote(M.paths.install_script), {
        error = "tailscale_install_failed",
        status_text = "Tailscale install failed on the router."
    })
end

function M.update()
    return run_system_action("update", "/bin/sh " .. shell_quote(M.paths.install_script) .. " --force", {
        error = "tailscale_update_failed",
        status_text = "Tailscale update failed on the router."
    })
end

function M.remove()
    return run_system_action("remove", "/bin/sh " .. shell_quote(M.paths.remove_script), {
        error = "tailscale_remove_failed",
        status_text = "Tailscale remove failed on the router."
    })
end

function M.start()
    return run_system_action("start", "systemctl start tailscaled", {
        error = "tailscale_start_failed",
        status_text = "Failed to start Tailscale on the router."
    })
end

function M.stop()
    return run_system_action("stop", "systemctl stop tailscaled", {
        error = "tailscale_stop_failed",
        status_text = "Failed to stop Tailscale on the router."
    })
end

function M.restart()
    return run_system_action("restart", "systemctl restart tailscaled", {
        error = "tailscale_restart_failed",
        status_text = "Failed to restart Tailscale on the router."
    })
end

function M.connect()
    return run_cli_action("connect", "up --ssh=false --accept-dns=false --reset --timeout=8s", {
        allow_auth_pending = true,
        error = "tailscale_connect_failed",
        status_text = "Failed to connect Tailscale on the router."
    })
end

function M.connect_ssh()
    return run_cli_action("connect_ssh", "up --ssh --accept-dns=false --reset --timeout=8s", {
        allow_auth_pending = true,
        error = "tailscale_connect_ssh_failed",
        status_text = "Failed to connect Tailscale with SSH enabled."
    })
end

function M.reconnect_no_ssh()
    return run_cli_action("reconnect_no_ssh", "up --ssh=false --accept-dns=false --reset --timeout=8s", {
        allow_auth_pending = true,
        error = "tailscale_reconnect_no_ssh_failed",
        status_text = "Failed to reconnect Tailscale with SSH disabled."
    })
end

function M.disconnect()
    return run_cli_action("disconnect", "down", {
        error = "tailscale_disconnect_failed",
        status_text = "Failed to disconnect Tailscale on the router."
    })
end

function M.logout()
    return run_cli_action("logout", "logout", {
        error = "tailscale_logout_failed",
        status_text = "Failed to log out of Tailscale on the router."
    })
end

return M
