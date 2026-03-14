local M = {}

local FORBIDDEN_PATTERNS = {
    "[\r\n]",
    ";",
    "[`|<>$]"
}

local BLOCKED_EXACT_COMMANDS = {
    ["AT+QPOWD"] = true,
    ["AT&F"] = true,
    ["AT&W"] = true,
    ["AT+CFUN=1,1"] = true
}

local QUERY_ONLY_QCFG_KEYS = {
    ["usbnet"] = true,
    ["data_interface"] = true,
    ["pcie/mode"] = true,
    ["usbspeed"] = true
}

local function trim(s)
    return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function json_decode(JSON, body)
    if type(JSON.decode) == "function" then
        return JSON:decode(body)
    end
    error("JSON decode function not available")
end

local function normalize_command(cmd)
    return trim(cmd)
end

local function is_at_syntax(cmd)
    if not cmd:match("^AT") then
        return false
    end

    -- Allow broad single-line AT usage while still requiring printable input.
    if not cmd:match("^[\x20-\x7E]+$") then
        return false
    end

    return true
end

local function extract_qcfg_key(cmd)
    return cmd:match('^AT%+QCFG="([^"]+)"')
end

local function is_qcfg_query_only_violation(cmd)
    local key = extract_qcfg_key(cmd)
    if not key or not QUERY_ONLY_QCFG_KEYS[key] then
        return false
    end

    if cmd:match('^AT%+QCFG="[^"]+"$') or cmd:match('^AT%+QCFG="[^"]+"%?$') then
        return false
    end

    return true
end

local function is_blocked_command(cmd)
    if BLOCKED_EXACT_COMMANDS[cmd] then
        return true
    end

    if is_qcfg_query_only_violation(cmd) then
        return true
    end

    return false
end

function M.decode_request(JSON, body)
    local ok, decoded = pcall(json_decode, JSON, body)
    if not ok then
        return nil, "invalid_json"
    end
    if type(decoded) ~= "table" then
        return nil, "invalid_json"
    end
    return decoded, nil
end

function M.validate_command(config, payload)
    if type(payload) ~= "table" then
        return nil, "invalid_json"
    end

    local cmd = payload.command
    if type(cmd) ~= "string" then
        return nil, "missing_command"
    end

    cmd = normalize_command(cmd)

    if cmd == "" then
        return nil, "missing_command"
    end

    if #cmd > (config.max_command_len or 128) then
        return nil, "command_too_long"
    end

    for _, pattern in ipairs(FORBIDDEN_PATTERNS) do
        if cmd:find(pattern) then
            return nil, "invalid_command_format"
        end
    end

    if not is_at_syntax(cmd) then
        return nil, "invalid_command_format"
    end

    if is_blocked_command(cmd) then
        return nil, "command_not_allowed"
    end

    return cmd, nil
end

return M
