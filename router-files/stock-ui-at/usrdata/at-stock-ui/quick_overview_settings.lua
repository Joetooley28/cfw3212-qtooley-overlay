-- Copyright (C) 2026 Joe Tooley
-- SPDX-License-Identifier: GPL-2.0-or-later
-- See repository root LICENSE for full license text.

local JSON = require("JSON")

local M = {}

M.paths = {
    config = "/usrdata/at-stock-ui/quick_overview_settings.json"
}

M.defaults = {
    enabled = true,
    timeout = 45000,
    dismissMode = "movement",
    weightRsrp = 50,
    weightSinr = 30,
    weightRsrq = 20
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

local function to_int(value)
    local n = tonumber(value)
    if not n then
        return nil
    end
    n = math.floor(n)
    return n
end

local function normalize_settings(value)
    local input = type(value) == "table" and value or {}
    local out = {
        enabled = M.defaults.enabled,
        timeout = M.defaults.timeout,
        dismissMode = M.defaults.dismissMode,
        weightRsrp = M.defaults.weightRsrp,
        weightSinr = M.defaults.weightSinr,
        weightRsrq = M.defaults.weightRsrq
    }

    if input.enabled ~= nil then
        out.enabled = not not input.enabled
    end

    local timeout = to_int(input.timeout)
    if timeout and timeout > 0 then
        out.timeout = timeout
    end

    if input.dismissMode == "button" then
        out.dismissMode = "button"
    end

    local weightRsrp = to_int(input.weightRsrp)
    local weightSinr = to_int(input.weightSinr)
    local weightRsrq = to_int(input.weightRsrq)
    if weightRsrp and weightSinr and weightRsrq and
       weightRsrp >= 0 and weightSinr >= 0 and weightRsrq >= 0 and
       weightRsrp <= 100 and weightSinr <= 100 and weightRsrq <= 100 and
       (weightRsrp + weightSinr + weightRsrq) == 100 then
        out.weightRsrp = weightRsrp
        out.weightSinr = weightSinr
        out.weightRsrq = weightRsrq
    end

    return out
end

function M.read_config()
    return normalize_settings(decode_json(read_file(M.paths.config)))
end

function M.write_config(value)
    return write_file(M.paths.config, encode_json(normalize_settings(value)))
end

function M.get_settings()
    return {
        ok = true,
        settings = M.read_config()
    }
end

function M.save_settings(partial)
    local current = M.read_config()
    local merged = {}
    local key

    for key, value in pairs(current) do
        merged[key] = value
    end
    if type(partial) == "table" then
        for key, value in pairs(partial) do
            merged[key] = value
        end
    end

    local normalized = normalize_settings(merged)
    local ok = M.write_config(normalized)
    if not ok then
        return {
            ok = false,
            error = "settings_write_failed"
        }
    end

    return {
        ok = true,
        settings = normalized
    }
end

return M
