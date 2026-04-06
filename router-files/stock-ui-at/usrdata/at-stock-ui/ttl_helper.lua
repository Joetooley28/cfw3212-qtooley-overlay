local JSON = require("JSON")

local M = {}

M.paths = {
    config = "/usrdata/at-stock-ui/ttl_config.json"
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

local function shell_run(command)
    local handle = io.popen(command .. " 2>&1", "r")
    if not handle then
        return nil
    end
    local output = handle:read("*a") or ""
    handle:close()
    return output
end

function M.read_config()
    return decode_json(read_file(M.paths.config))
end

function M.write_config(value)
    return write_file(M.paths.config, encode_json(value))
end

local function parse_live_ttl_value(iptables_output)
    for line in (iptables_output or ""):gmatch("([^\n]+)") do
        local value = line:match("TTL%s+set%s+to%s+(%d+)")
        if value then
            return tonumber(value)
        end
    end
    return nil
end

local function parse_live_hl_value(ip6tables_output)
    for line in (ip6tables_output or ""):gmatch("([^\n]+)") do
        local value = line:match("HL%s+set%s+to%s+(%d+)")
        if value then
            return tonumber(value)
        end
    end
    return nil
end

function M.get_status()
    local config = M.read_config()
    local configured_value = config and tonumber(config.ttl_value) or 0

    local ipv4_output = shell_run("iptables -t mangle -vnL POSTROUTING")
    local ipv6_output = shell_run("ip6tables -t mangle -vnL POSTROUTING")

    local live_ipv4 = parse_live_ttl_value(ipv4_output)
    local live_ipv6 = parse_live_hl_value(ipv6_output)

    local active = (live_ipv4 ~= nil) or (live_ipv6 ~= nil)

    return {
        ok = true,
        active = active,
        configured_value = configured_value,
        live_ipv4_value = live_ipv4,
        live_ipv6_value = live_ipv6,
        ipv4_rule_present = live_ipv4 ~= nil,
        ipv6_rule_present = live_ipv6 ~= nil
    }
end

function M.apply_ttl(value)
    value = tonumber(value)
    if not value or value < 1 or value > 255 or math.floor(value) ~= value then
        return { ok = false, error = "invalid_ttl_value" }
    end

    local val_str = tostring(value)

    shell_run("iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set " .. val_str)
    shell_run("ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set " .. val_str)

    local status = M.get_status()
    if status.live_ipv4_value and status.live_ipv4_value ~= value then
        shell_run("iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set " .. tostring(status.live_ipv4_value))
    end
    if status.live_ipv6_value and status.live_ipv6_value ~= value then
        shell_run("ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set " .. tostring(status.live_ipv6_value))
    end

    local ipv4_result = shell_run("iptables -t mangle -I POSTROUTING -o rmnet+ -j TTL --ttl-set " .. val_str)
    local ipv6_result = shell_run("ip6tables -t mangle -I POSTROUTING -o rmnet+ -j HL --hl-set " .. val_str)

    M.write_config({ ttl_value = value })

    local after = M.get_status()
    after.applied = true
    return after
end

function M.get_rules()
    local ipv4 = shell_run("iptables -t mangle -L POSTROUTING -n --line-numbers") or ""
    local ipv6 = shell_run("ip6tables -t mangle -L POSTROUTING -n --line-numbers") or ""
    return {
        ok = true,
        ipv4_rules = trim(ipv4),
        ipv6_rules = trim(ipv6)
    }
end

function M.remove_ttl()
    local status = M.get_status()

    if status.live_ipv4_value then
        shell_run("iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set " .. tostring(status.live_ipv4_value))
    end
    if status.live_ipv6_value then
        shell_run("ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set " .. tostring(status.live_ipv6_value))
    end

    os.remove(M.paths.config)

    local after = M.get_status()
    after.removed = true
    return after
end

return M
