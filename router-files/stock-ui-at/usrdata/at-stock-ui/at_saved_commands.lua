-- Copyright (C) 2026 Joe Tooley
-- SPDX-License-Identifier: GPL-2.0-or-later
-- See repository root LICENSE for full license text.

--[[
  Shared AT terminal reference: custom commands + hidden built-in rows.
  Persisted under /usrdata/at-stock-ui for root and admin (same file).
  Must stay in sync with built-in COMMAND_REF in www/js/at_terminal.js for hide/duplicate checks.
]]

local JSON = require("JSON")
local validate = require("at_validate")

local M = {}

M.path = "/usrdata/at-stock-ui/at_terminal_saved_commands.json"
M.max_custom = 50
M.max_desc_len = 200

local function cmd_key(s)
    if not s then
        return ""
    end
    s = tostring(s):gsub("^%s+", ""):gsub("%s+$", "")
    return s:upper()
end

function M.cmd_key(s)
    return cmd_key(s)
end

-- Keys must match cmd_key() of each built-in row in at_terminal.js COMMAND_REF.
local RAW_BUILTIN = {
    "ATI", "AT+QGMR", "AT+QTEMP",
    "AT+CPIN?", "AT+QSIMSTAT?",
    "AT+CGSN", "AT+GSN", "AT+EGMR=0,7", [[AT+EGMR=1,7,"IMEI"]],
    "AT+CSQ", "AT+COPS?", "AT+QNWINFO", "AT+QCAINFO", "AT+QRSRP",
    [[AT+QENG="servingcell"]], [[AT+QENG="neighbourcell"]],
    "AT+CGDCONT?", "AT+CGPADDR",
    "AT+CFUN?", "AT+CFUN=0", "AT+CFUN=1", "AT+CFUN=1,1",
    [[AT+QNWPREFCFG="mode_pref"]],
    [[AT+QNWPREFCFG="mode_pref",AUTO]],
    [[AT+QNWPREFCFG="mode_pref",LTE]],
    [[AT+QNWPREFCFG="mode_pref",NR5G]],
    [[AT+QNWPREFCFG="mode_pref",NR5G-NSA]],
    [[AT+QNWPREFCFG="mode_pref",NR5G-SA]],
    [[AT+QNWPREFCFG="lte_band"]],
    [[AT+QNWPREFCFG="nsa_nr5g_band"]],
    [[AT+QNWPREFCFG="nr5g_band"]],
    [[AT+QNWPREFCFG="ue_capability_band"]],
    [[AT+QNWPREFCFG="policy_band"]],
    [[AT+QCFG="usbnet"]],
    [[AT+QCFG="usbspeed"]],
    [[AT+QCFG="data_interface"]],
}

local BUILTIN_CMD_KEYS = {}
for _, c in ipairs(RAW_BUILTIN) do
    BUILTIN_CMD_KEYS[cmd_key(c)] = true
end

local function read_raw(path)
    local f = io.open(path, "rb")
    if not f then
        return nil
    end
    local raw = f:read("*a")
    f:close()
    return raw
end

local function write_raw(path, content)
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

local function normalize_data(t)
    local out = {
        version = 1,
        custom = {},
        hidden_builtin = {},
    }
    if type(t) ~= "table" then
        return out
    end
    if type(t.custom) == "table" then
        for _, row in ipairs(t.custom) do
            if type(row) == "table" and type(row.id) == "string" and row.id ~= "" and
               type(row.cmd) == "string" and type(row.desc) == "string" then
                table.insert(out.custom, {
                    id = row.id,
                    cmd = row.cmd,
                    desc = row.desc,
                })
                if #out.custom >= M.max_custom then
                    break
                end
            end
        end
    end
    if type(t.hidden_builtin) == "table" then
        local seen = {}
        for _, h in ipairs(t.hidden_builtin) do
            local k = M.cmd_key(h)
            if k ~= "" and not seen[k] then
                seen[k] = true
                table.insert(out.hidden_builtin, k)
            end
        end
    end
    return out
end

function M.read_data()
    return normalize_data(decode_json(read_raw(M.path)))
end

function M.write_data(data)
    local norm = normalize_data(data)
    return write_raw(M.path, encode_json(norm))
end

function M.is_builtin_key(key)
    return BUILTIN_CMD_KEYS[key] == true
end

function M.is_hidden(data, key)
    for _, k in ipairs(data.hidden_builtin) do
        if cmd_key(k) == key then
            return true
        end
    end
    return false
end

function M.validate_desc(desc)
    if desc == nil then
        desc = ""
    end
    desc = tostring(desc):gsub("^%s+", ""):gsub("%s+$", "")
    if #desc > M.max_desc_len then
        return nil, "description_too_long"
    end
    if not desc:match("^[\x20-\x7E]*$") then
        return nil, "invalid_description_format"
    end
    if desc == "" then
        desc = "(No description)"
    end
    return desc, nil
end

function M.new_id()
    return string.format("%d-%d", os.time(), math.random(100000, 999999))
end

function M.state_payload(data)
    data = normalize_data(data)
    return {
        ok = true,
        custom = data.custom,
        hidden_builtin = data.hidden_builtin,
        max_custom = M.max_custom,
    }
end

function M.get_state()
    return M.state_payload(M.read_data())
end

function M.add_custom(config, cmd_raw, desc_raw)
    local vcmd, verr = validate.validate_command(config, { command = cmd_raw })
    if not vcmd then
        return { ok = false, error = verr }, 400
    end
    local vdesc, derr = M.validate_desc(desc_raw)
    if not vdesc then
        return { ok = false, error = derr }, 400
    end

    local data = M.read_data()
    local key = M.cmd_key(vcmd)

    if #data.custom >= M.max_custom then
        return { ok = false, error = "custom_limit_reached" }, 400
    end

    for _, row in ipairs(data.custom) do
        if M.cmd_key(row.cmd) == key then
            return { ok = false, error = "duplicate_command" }, 400
        end
    end

    if BUILTIN_CMD_KEYS[key] and not M.is_hidden(data, key) then
        return { ok = false, error = "duplicate_command" }, 400
    end

    table.insert(data.custom, {
        id = M.new_id(),
        cmd = vcmd,
        desc = vdesc,
    })

    if not M.write_data(data) then
        return { ok = false, error = "save_failed" }, 500
    end
    return M.state_payload(data), 200
end

function M.remove_custom(id)
    if type(id) ~= "string" or id == "" then
        return { ok = false, error = "missing_id" }, 400
    end
    local data = M.read_data()
    local nextc = {}
    local found = false
    for _, row in ipairs(data.custom) do
        if row.id == id then
            found = true
        else
            table.insert(nextc, row)
        end
    end
    if not found then
        return { ok = false, error = "not_found" }, 404
    end
    data.custom = nextc
    if not M.write_data(data) then
        return { ok = false, error = "save_failed" }, 500
    end
    return M.state_payload(data), 200
end

function M.hide_builtin(config, cmd_raw)
    local vcmd, verr = validate.validate_command(config, { command = cmd_raw })
    if not vcmd then
        return { ok = false, error = verr }, 400
    end
    local key = M.cmd_key(vcmd)
    if not BUILTIN_CMD_KEYS[key] then
        return { ok = false, error = "not_builtin_command" }, 400
    end
    local data = M.read_data()
    if M.is_hidden(data, key) then
        return M.state_payload(data), 200
    end
    table.insert(data.hidden_builtin, key)
    if not M.write_data(data) then
        return { ok = false, error = "save_failed" }, 500
    end
    return M.state_payload(data), 200
end

function M.unhide_builtin(cmd_raw)
    local key = M.cmd_key(cmd_raw)
    if key == "" then
        return { ok = false, error = "missing_command" }, 400
    end
    local data = M.read_data()
    local next_h = {}
    local found = false
    for _, k in ipairs(data.hidden_builtin) do
        if M.cmd_key(k) == key then
            found = true
        else
            table.insert(next_h, k)
        end
    end
    if not found then
        return { ok = false, error = "not_hidden" }, 404
    end
    data.hidden_builtin = next_h
    if not M.write_data(data) then
        return { ok = false, error = "save_failed" }, 500
    end
    return M.state_payload(data), 200
end

function M.reset_hidden_builtins()
    local data = M.read_data()
    data.hidden_builtin = {}
    if not M.write_data(data) then
        return { ok = false, error = "save_failed" }, 500
    end
    return M.state_payload(data), 200
end

return M
