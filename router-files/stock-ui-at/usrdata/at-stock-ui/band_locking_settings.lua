-- Copyright (C) 2026 Joe Tooley
-- SPDX-License-Identifier: GPL-2.0-or-later
-- See repository root LICENSE for full license text.

local JSON = require("JSON")
local at_lock = require("at_lock")
local backend = require("at_backend")

local M = {}

M.paths = {
    config = "/usrdata/at-stock-ui/band_locking_config.json",
    at_config = "/usrdata/at-stock-ui/config.json"
}

local MODE_VALUES = {
    AUTO = true,
    WCDMA = true,
    LTE = true,
    NR5G = true,
    ["LTE:NR5G"] = true
}

local RAT_ACQ_ORDER_VALUES = {
    ["LTE:NR5G"] = true,
    ["NR5G:LTE"] = true,
    ["LTE:NR5G:WCDMA"] = true,
    ["NR5G:LTE:WCDMA"] = true,
    ["WCDMA:LTE:NR5G"] = true,
    ["LTE:WCDMA:NR5G"] = true,
    ["NR5G:WCDMA:LTE"] = true,
    ["WCDMA:NR5G:LTE"] = true,
    ["LTE"] = true,
    ["NR5G"] = true,
    ["WCDMA"] = true,
    ["LTE:WCDMA"] = true,
    ["WCDMA:LTE"] = true,
    ["NR5G:WCDMA"] = true,
    ["WCDMA:NR5G"] = true
}

local NR5G_DISABLE_MODE_VALUES = {
    ["0"] = true,
    ["1"] = true,
    ["2"] = true
}

local BAND_VALUES = {
    lte_band = {
        ["2"] = true, ["4"] = true, ["5"] = true, ["7"] = true, ["12"] = true, ["13"] = true,
        ["14"] = true, ["17"] = true, ["25"] = true, ["26"] = true, ["29"] = true, ["30"] = true,
        ["38"] = true, ["41"] = true, ["42"] = true, ["43"] = true, ["48"] = true, ["66"] = true,
        ["71"] = true
    },
    nsa_nr5g_band = {
        ["2"] = true, ["5"] = true, ["7"] = true, ["12"] = true, ["13"] = true, ["14"] = true,
        ["25"] = true, ["26"] = true, ["29"] = true, ["30"] = true, ["38"] = true, ["41"] = true,
        ["48"] = true, ["66"] = true, ["70"] = true, ["71"] = true, ["77"] = true, ["78"] = true
    },
    nr5g_band = {
        ["2"] = true, ["5"] = true, ["7"] = true, ["12"] = true, ["13"] = true, ["14"] = true,
        ["25"] = true, ["26"] = true, ["29"] = true, ["30"] = true, ["38"] = true, ["41"] = true,
        ["48"] = true, ["66"] = true, ["70"] = true, ["71"] = true, ["77"] = true, ["78"] = true
    }
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
    return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function normalize_mode(value)
    value = trim(value)
    if value ~= "" and MODE_VALUES[value] then
        return value
    end
    return nil
end

local function normalize_order(value)
    value = trim(value)
    if value ~= "" and RAT_ACQ_ORDER_VALUES[value] then
        return value
    end
    return nil
end

local function normalize_nr5g_disable(value)
    value = trim(value)
    if value ~= "" and NR5G_DISABLE_MODE_VALUES[value] then
        return value
    end
    return nil
end

local function normalize_band_list(group, raw_value)
    if type(raw_value) ~= "string" then
        return nil
    end
    local out = {}
    local seen = {}
    for part in raw_value:gmatch("([^:]+)") do
        local trimmed = trim(part)
        if trimmed ~= "" and BAND_VALUES[group][trimmed] and not seen[trimmed] then
            seen[trimmed] = true
            table.insert(out, trimmed)
        end
    end
    if #out == 0 then
        return nil
    end
    return table.concat(out, ":")
end

local function normalize_settings(value)
    local input = type(value) == "table" and value or {}
    local out = {}

    out.mode_pref = normalize_mode(input.mode_pref)
    out.rat_acq_order = normalize_order(input.rat_acq_order)
    out.nr5g_disable_mode = normalize_nr5g_disable(input.nr5g_disable_mode)
    out.lte_band = normalize_band_list("lte_band", input.lte_band)
    out.nsa_nr5g_band = normalize_band_list("nsa_nr5g_band", input.nsa_nr5g_band)
    out.nr5g_band = normalize_band_list("nr5g_band", input.nr5g_band)

    return out
end

local function join_keys(group)
    local keys = {}
    for key in pairs(BAND_VALUES[group]) do
        table.insert(keys, key)
    end
    table.sort(keys, function(a, b)
        return tonumber(a) < tonumber(b)
    end)
    return table.concat(keys, ":")
end

local function read_at_config()
    return decode_json(read_file(M.paths.at_config))
end

local function build_commands(settings)
    local commands = {}
    if settings.mode_pref then
        table.insert(commands, 'AT+QNWPREFCFG="mode_pref",' .. settings.mode_pref)
    end
    if settings.rat_acq_order then
        table.insert(commands, 'AT+QNWPREFCFG="rat_acq_order",' .. settings.rat_acq_order)
    end
    if settings.nr5g_disable_mode then
        table.insert(commands, 'AT+QNWPREFCFG="nr5g_disable_mode",' .. settings.nr5g_disable_mode)
    end
    if settings.lte_band then
        table.insert(commands, 'AT+QNWPREFCFG="lte_band",' .. settings.lte_band)
    end
    if settings.nsa_nr5g_band then
        table.insert(commands, 'AT+QNWPREFCFG="nsa_nr5g_band",' .. settings.nsa_nr5g_band)
    end
    if settings.nr5g_band then
        table.insert(commands, 'AT+QNWPREFCFG="nr5g_band",' .. settings.nr5g_band)
    end
    return commands
end

local function has_settings(settings)
    return settings and next(settings) ~= nil
end

local function run_commands(settings)
    local config = read_at_config()
    if not config then
        return nil, "config_read_failed"
    end

    local commands = build_commands(settings)
    if #commands == 0 then
        return true
    end

    local fd, lock_err = at_lock.acquire(config.lock_path)
    if not fd then
        return nil, lock_err
    end

    local ok = true
    local err = nil
    for _, command in ipairs(commands) do
        local result = backend.run_transaction(config, command)
        if not result or not result.ok then
            ok = false
            err = result and result.error or "request_failed"
            break
        end
    end

    pcall(at_lock.release, fd)
    if not ok then
        return nil, err
    end
    return true
end

function M.get_safe_defaults()
    return {
        mode_pref = "AUTO",
        rat_acq_order = "NR5G:LTE",
        nr5g_disable_mode = "0",
        lte_band = join_keys("lte_band"),
        nsa_nr5g_band = join_keys("nsa_nr5g_band"),
        nr5g_band = join_keys("nr5g_band")
    }
end

function M.read_config()
    local decoded = decode_json(read_file(M.paths.config))
    if not decoded then
        return nil
    end
    local normalized = normalize_settings(decoded)
    if not has_settings(normalized) then
        return nil
    end
    return normalized
end

function M.write_config(value)
    return write_file(M.paths.config, encode_json(normalize_settings(value)))
end

function M.save_partial(partial)
    local current = M.read_config() or {}
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

function M.delete_config()
    os.remove(M.paths.config)
end

function M.get_saved_config()
    local settings = M.read_config()
    return {
        ok = true,
        settings = settings,
        has_saved_settings = has_settings(settings)
    }
end

function M.reapply_saved()
    local settings = M.read_config()
    if not settings then
        return nil, "no_saved_settings"
    end
    return run_commands(settings)
end

function M.reset_to_defaults()
    local defaults = M.get_safe_defaults()
    local ok, err = run_commands(defaults)
    if not ok then
        return {
            ok = false,
            error = err or "request_failed"
        }
    end

    local write_ok = M.write_config(defaults)
    if not write_ok then
        return {
            ok = false,
            error = "settings_write_failed"
        }
    end

    return {
        ok = true,
        settings = defaults,
        reset = true
    }
end

return M
