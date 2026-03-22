require("srvrUtils")

local turbo = require("turbo")
local SessionRequestHandler = require("session_handler")

package.path = package.path .. ";/usrdata/at-stock-ui/?.lua"

local validate = require("at_validate")
local at_lock = require("at_lock")
local backend = require("at_backend")
local speedtest = require("ookla_speedtest")
local ttl_helper = require("ttl_helper")
local JSON = require("JSON")

local MODE_VALUES = {
    AUTO = true,
    WCDMA = true,
    LTE = true,
    NR5G = true,
    ["LTE:NR5G"] = true
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

local function read_config()
    local f = io.open("/usrdata/at-stock-ui/config.json", "rb")
    if not f then
        return nil, "config_open_failed"
    end
    local raw = f:read("*a") or ""
    f:close()
    if type(JSON.decode) == "function" then
        return JSON:decode(raw), nil
    end
    return nil, "config_decode_unavailable"
end

local function split_lines(raw)
    local out = {}
    for line in (raw or ""):gsub("\r\n", "\n"):gsub("\r", "\n"):gmatch("([^\n]+)") do
        local trimmed = line:gsub("^%s+", ""):gsub("%s+$", "")
        if trimmed ~= "" then
            table.insert(out, trimmed)
        end
    end
    return out
end

local function summarize_response(command, raw)
    local lines = split_lines(raw)
    local keep = {}
    for _, line in ipairs(lines) do
        if line ~= command and line ~= "OK" and line ~= "ERROR" then
            table.insert(keep, line)
        end
    end
    return table.concat(keep, "\n")
end

local function parse_pref_value(group, raw)
    local summary = summarize_response('AT+QNWPREFCFG="' .. group .. '"', raw)
    local _, _, value = summary:find('^%+QNWPREFCFG:%s+"[^"]+",(.+)$')
    if not value then
        return nil
    end
    value = value:gsub("^%s+", ""):gsub("%s+$", "")
    return value
end

local function split_band_string(raw)
    if not raw or raw == "" or raw == "0" then
        return {}
    end
    local out = {}
    local seen = {}
    for part in raw:gmatch("([^:]+)") do
        local trimmed = part:gsub("^%s+", ""):gsub("%s+$", "")
        if trimmed ~= "" and not seen[trimmed] then
            seen[trimmed] = true
            table.insert(out, trimmed)
        end
    end
    return out
end

local function validate_mode_value(mode)
    if type(mode) ~= "string" then
        return nil, "invalid_mode"
    end
    mode = mode:gsub("^%s+", ""):gsub("%s+$", "")
    if not MODE_VALUES[mode] then
        return nil, "invalid_mode"
    end
    return mode, nil
end

local function validate_band_group(group)
    if type(group) ~= "string" or not BAND_VALUES[group] then
        return nil, "invalid_band_group"
    end
    return group, nil
end

local function validate_band_value(group, raw_bands)
    if type(raw_bands) ~= "string" then
        return nil, "invalid_band_list"
    end
    local out = {}
    local seen = {}
    for part in raw_bands:gmatch("([^:]+)") do
        local trimmed = part:gsub("^%s+", ""):gsub("%s+$", "")
        if trimmed ~= "" then
            if not BAND_VALUES[group][trimmed] then
                return nil, "invalid_band_list"
            end
            if not seen[trimmed] then
                seen[trimmed] = true
                table.insert(out, trimmed)
            end
        end
    end
    if #out == 0 then
        return nil, "invalid_band_list"
    end
    return table.concat(out, ":"), nil
end

local function run_locked_transaction(config, fn)
    local fd, lock_err = at_lock.acquire(config.lock_path)
    if not fd then
        return nil, lock_err
    end
    local ok, result = pcall(fn)
    at_lock.release(fd)
    if not ok then
        return nil, "backend_internal_error:" .. tostring(result)
    end
    return result, nil
end

local function run_command(config, command)
    local result = backend.run_transaction(config, command)
    if type(result) ~= "table" then
        return nil, "backend_bad_result"
    end
    if result.timed_out then
        return nil, "timeout"
    end
    if result.truncated then
        return nil, "response_too_large"
    end
    if not result.ok and result.error then
        return nil, result.error
    end
    return result.response or "", nil
end

local function must_run_command(config, command)
    local response, err = run_command(config, command)
    if not response then
        error(err or "backend_internal_error")
    end
    return response
end

local function soft_run_command(config, command)
    local response, err = run_command(config, command)
    if not response then
        return nil, err or "backend_internal_error"
    end
    return response, nil
end

local function normalize_action(prefix, url, action)
    if action and action ~= "" then
        return action
    end
    if url and url ~= "" and url ~= prefix then
        return url
    end
    return ""
end

local function strip_quotes(value)
    if not value then
        return ""
    end
    value = tostring(value):gsub('^%s*"', ""):gsub('"%s*$', "")
    return value:gsub("^%s+", ""):gsub("%s+$", "")
end

local function split_csv_preserving_quotes(text)
    local out = {}
    local current = {}
    local in_quotes = false
    local i = 1
    while i <= #text do
        local ch = text:sub(i, i)
        if ch == '"' then
            in_quotes = not in_quotes
        elseif ch == "," and not in_quotes then
            local field = table.concat(current):gsub("^%s+", ""):gsub("%s+$", "")
            table.insert(out, field)
            current = {}
        else
            table.insert(current, ch)
        end
        i = i + 1
    end
    local field = table.concat(current):gsub("^%s+", ""):gsub("%s+$", "")
    table.insert(out, field)
    return out
end

local function lte_bw(code)
    code = tonumber(code)
    if not code then
        return nil
    end
    if code == 0 then
        return "1.4"
    elseif code == 1 then
        return "3"
    elseif code >= 2 and code <= 5 then
        return tostring((code - 1) * 5)
    elseif code > 5 and code <= 100 then
        return tostring(code)
    end
    return nil
end

local function nr_bw(code)
    code = tonumber(code)
    if not code then
        return nil
    end
    if code >= 0 and code <= 5 then
        return tostring((code + 1) * 5)
    elseif code >= 6 and code <= 12 then
        return tostring((code - 2) * 10)
    elseif code == 13 then
        return "200"
    elseif code == 14 then
        return "400"
    elseif code > 14 and code <= 400 then
        return tostring(code)
    end
    return nil
end

local function first_numeric_after(tokens, start_index)
    local i
    for i = start_index, #tokens do
        if tokens[i] and tokens[i]:match("^%-?%d+$") then
            return tokens[i]
        end
    end
    return nil
end

local function parse_qcainfo(summary)
    local carriers = {}
    for line in (summary or ""):gmatch("([^\n]+)") do
        if line:match("^%+QCAINFO:") then
            local body = line:gsub("^%+QCAINFO:%s*", "")
            local tokens = split_csv_preserving_quotes(body)
            local role = strip_quotes(tokens[1] or "")
            local band_index = nil
            local i
            for idx, token in ipairs(tokens) do
                if token:find("BAND") then
                    band_index = idx
                    break
                end
            end
            if band_index then
                local band_label = strip_quotes(tokens[band_index])
                local rat = band_label:match("^([A-Z0-9]+)")
                local band = band_label:match("BAND%s+([0-9]+)")
                local bw_code = first_numeric_after(tokens, band_index + 1)
                local bandwidth_mhz = nil
                if rat == "LTE" then
                    bandwidth_mhz = lte_bw(bw_code)
                elseif rat == "NR5G" then
                    bandwidth_mhz = nr_bw(bw_code)
                end
                local channel = nil
                for j = 2, band_index - 1 do
                    if tokens[j]:match("^%-?%d+$") then
                        channel = tokens[j]
                        break
                    end
                end
                table.insert(carriers, {
                    role = role,
                    rat = rat or "",
                    band = band or "",
                    band_label = band_label,
                    channel = channel or "",
                    bandwidth_mhz = bandwidth_mhz or "",
                    bandwidth_text = bandwidth_mhz and ("Bandwidth " .. bandwidth_mhz .. " MHz") or "Bandwidth unavailable",
                    raw = line
                })
            end
        end
    end
    return carriers
end

local function is_displayable_qtemp(name, value_num)
    if value_num == nil then
        return true
    end
    if value_num <= -200 then
        return false
    end
    if value_num == 0 and name then
        if name:match("^modem%-sdr%d+%-pa%d+$") then
            return false
        end
        if name:match("^modem%-mmw%d+$") then
            return false
        end
    end
    return true
end

local function parse_qtemp(summary)
    local temps = {}
    local primary = nil
    local ambient_primary = nil
    local user_primary = nil
    local modem_primary = nil
    for line in (summary or ""):gmatch("([^\n]+)") do
        local name, value = line:match('^%+QTEMP:%s*"([^"]+)",%s*"?(-?%d+)"?$')
        if name and value then
            local numeric_value = tonumber(value)
            if is_displayable_qtemp(name, numeric_value) then
            local item = {
                name = name,
                value = numeric_value or value,
                value_text = tostring(value) .. " C"
            }
            table.insert(temps, item)
            if not ambient_primary and name:find("ambient") then
                ambient_primary = item.value_text
            end
            if not user_primary and name:find("usr") then
                user_primary = item.value_text
            end
            if not modem_primary and (name:find("mdm") or name:find("modem")) then
                modem_primary = item.value_text
            end
            end
        end
    end
    primary = ambient_primary or user_primary or modem_primary
    if not primary and temps[1] then
        primary = temps[1].value_text
    end
    return temps, primary or "N/A"
end

local function parse_qeng_servingcell(summary)
    for line in (summary or ""):gmatch("([^\n]+)") do
        if line:find("QENG") then
            return line
        end
    end
    return ""
end

local function build_ca_band_label(carrier)
    if type(carrier) ~= "table" then
        return nil
    end
    local rat = tostring(carrier.rat or "")
    local band = tostring(carrier.band or "")
    if band == "" then
        return nil
    end
    if rat == "NR5G" then
        return "n" .. band
    end
    if rat == "LTE" then
        return "B" .. band
    end
    return band
end

local function extract_servingcell_bands(line)
    local out = {}
    local seen = {}
    for nr_band in tostring(line or ""):gmatch("NR5G BAND%s+([0-9]+)") do
        local label = "n" .. nr_band
        if not seen[label] then
            seen[label] = true
            table.insert(out, label)
        end
    end
    for lte_band in tostring(line or ""):gmatch("LTE BAND%s+([0-9]+)") do
        local label = "B" .. lte_band
        if not seen[label] then
            seen[label] = true
            table.insert(out, label)
        end
    end
    return out
end

local function build_ca_snapshot(qcainfo_summary, servingcell_summary)
    local carriers = parse_qcainfo(qcainfo_summary or "")
    local servingcell_line = parse_qeng_servingcell(servingcell_summary or "")
    local bands = {}
    local seen = {}

    for _, carrier in ipairs(carriers) do
        local label = build_ca_band_label(carrier)
        if label and not seen[label] then
            seen[label] = true
            table.insert(bands, label)
        end
    end

    if #bands == 0 then
        for _, label in ipairs(extract_servingcell_bands(servingcell_line)) do
            if not seen[label] then
                seen[label] = true
                table.insert(bands, label)
            end
        end
    end

    return {
        ok = true,
        bands = bands,
        combo_text = #bands > 0 and table.concat(bands, " + ") or "Unavailable",
        carriers = carriers,
        servingcell_line = servingcell_line
    }
end

local JtoolTopMenuHandler = class("JtoolTopMenuHandler", turbo.web.RequestHandler)

function JtoolTopMenuHandler:get()
    self:redirect("/general_dashboard.html")
end

local AtTerminalApiHandler = class("AtTerminalApiHandler", SessionRequestHandler)

function AtTerminalApiHandler:getUrl(url, action)
    return "AtTerminalApi"
end

function AtTerminalApiHandler:post(url, action)
    action = normalize_action("at_terminal_api", url, action)
    local ok, err = xpcall(function()
        if action ~= "run" then
            error(turbo.web.HTTPError(404))
        end

        local config, config_err = read_config()
        if not config then
            self:set_status(500)
            self:write({ ok = false, error = config_err or "config_read_failed" })
            return
        end

        local payload = {
            command = self:get_argument("command", "")
        }

        local command, cmd_err = validate.validate_command(config, payload)
        if not command then
            self:set_status(400)
            self:write({ ok = false, error = cmd_err })
            return
        end

        local fd, lock_err = at_lock.acquire(config.lock_path)
        if not fd then
            self:set_status(409)
            self:write({ ok = false, error = lock_err })
            return
        end

        local backend_ok, result = pcall(backend.run_transaction, config, command)
        at_lock.release(fd)

        if not backend_ok then
            self:set_status(502)
            self:write({ ok = false, error = "backend_internal_error" })
            return
        end

        if type(result) ~= "table" then
            self:set_status(502)
            self:write({ ok = false, error = "backend_bad_result" })
            return
        end

        if result.timed_out then
            result.ok = false
            result.error = "timeout"
            self:set_status(504)
            self:write(result)
            return
        end

        if result.truncated then
            result.ok = false
            result.error = "response_too_large"
            self:set_status(413)
            self:write(result)
            return
        end

        if not result.ok and result.error then
            local status = 502
            if result.error == "at_channel_busy" then
                status = 409
            end
            self:set_status(status)
            self:write(result)
            return
        end

        self:write(result)
    end, debug.traceback)

    if not ok then
        turbo.log.error("AtTerminalApi handler exception: " .. tostring(err))
        self:set_status(500)
        self:write({ ok = false, error = "internal_handler_error" })
    end
end

local BandLockingApiHandler = class("BandLockingApiHandler", SessionRequestHandler)

function BandLockingApiHandler:getUrl(url, action)
    return "BandLockingApi"
end

function BandLockingApiHandler:get(url, action)
    action = normalize_action("band_locking_api", url, action)
    if action ~= "state" then
        error(turbo.web.HTTPError(404))
    end

    local config, config_err = read_config()
    if not config then
        self:set_status(500)
        self:write({ ok = false, error = config_err or "config_read_failed" })
        return
    end

    local payload, err = run_locked_transaction(config, function()
        local mode_raw = must_run_command(config, 'AT+QNWPREFCFG="mode_pref"')
        local lte_raw = must_run_command(config, 'AT+QNWPREFCFG="lte_band"')
        local nsa_raw = must_run_command(config, 'AT+QNWPREFCFG="nsa_nr5g_band"')
        local sa_raw = must_run_command(config, 'AT+QNWPREFCFG="nr5g_band"')
        local qnwinfo_raw, qnwinfo_err = soft_run_command(config, 'AT+QNWINFO')
        local qcainfo_raw, qcainfo_err = soft_run_command(config, 'AT+QCAINFO')
        local servingcell_raw, servingcell_err = soft_run_command(config, 'AT+QENG="servingcell"')

        return {
            ok = true,
            mode_pref = parse_pref_value("mode_pref", mode_raw) or "AUTO",
            lte_band_raw = parse_pref_value("lte_band", lte_raw) or "0",
            nsa_nr5g_band_raw = parse_pref_value("nsa_nr5g_band", nsa_raw) or "0",
            nr5g_band_raw = parse_pref_value("nr5g_band", sa_raw) or "0",
            lte_band_list = split_band_string(parse_pref_value("lte_band", lte_raw) or "0"),
            nsa_nr5g_band_list = split_band_string(parse_pref_value("nsa_nr5g_band", nsa_raw) or "0"),
            nr5g_band_list = split_band_string(parse_pref_value("nr5g_band", sa_raw) or "0"),
            qnwinfo_summary = qnwinfo_raw and summarize_response("AT+QNWINFO", qnwinfo_raw) or ("unavailable: " .. tostring(qnwinfo_err)),
            qcainfo_summary = qcainfo_raw and summarize_response("AT+QCAINFO", qcainfo_raw) or ("unavailable: " .. tostring(qcainfo_err)),
            servingcell_summary = servingcell_raw and summarize_response('AT+QENG="servingcell"', servingcell_raw) or ("unavailable: " .. tostring(servingcell_err))
        }
    end)

    if not payload then
        local status = err == "at_channel_busy" and 409 or 502
        self:set_status(status)
        self:write({ ok = false, error = err })
        return
    end

    self:write(payload)
end

function BandLockingApiHandler:post(url, action)
    action = normalize_action("band_locking_api", url, action)
    local config, config_err = read_config()
    if not config then
        self:set_status(500)
        self:write({ ok = false, error = config_err or "config_read_failed" })
        return
    end

    if action == "mode" then
        local mode, mode_err = validate_mode_value(self:get_argument("mode", ""))
        if not mode then
            self:set_status(400)
            self:write({ ok = false, error = mode_err })
            return
        end

        local result, err = run_locked_transaction(config, function()
            local command = 'AT+QNWPREFCFG="mode_pref",' .. mode
            local response = must_run_command(config, command)
            local readback_raw = must_run_command(config, 'AT+QNWPREFCFG="mode_pref"')
            return {
                ok = true,
                response = summarize_response(command, response),
                applied_mode = parse_pref_value("mode_pref", readback_raw) or "",
                readback_summary = summarize_response('AT+QNWPREFCFG="mode_pref"', readback_raw)
            }
        end)

        if not result then
            local status = err == "at_channel_busy" and 409 or 502
            self:set_status(status)
            self:write({ ok = false, error = err })
            return
        end

        self:write(result)
        return
    end

    if action == "bands" then
        local group, group_err = validate_band_group(self:get_argument("group", ""))
        if not group then
            self:set_status(400)
            self:write({ ok = false, error = group_err })
            return
        end

        local bands, band_err = validate_band_value(group, self:get_argument("bands", ""))
        if not bands then
            self:set_status(400)
            self:write({ ok = false, error = band_err })
            return
        end

        local command = 'AT+QNWPREFCFG="' .. group .. '",' .. bands
        local result, err = run_locked_transaction(config, function()
            local response = must_run_command(config, command)
            local readback_raw = must_run_command(config, 'AT+QNWPREFCFG="' .. group .. '"')
            local applied_raw = parse_pref_value(group, readback_raw) or "0"
            return {
                ok = true,
                response = summarize_response(command, response),
                applied_group = group,
                applied_raw = applied_raw,
                applied_list = split_band_string(applied_raw),
                readback_summary = summarize_response('AT+QNWPREFCFG="' .. group .. '"', readback_raw)
            }
        end)

        if not result then
            local status = err == "at_channel_busy" and 409 or 502
            self:set_status(status)
            self:write({ ok = false, error = err })
            return
        end

        self:write(result)
        return
    end

    self:set_status(404)
    self:write({ ok = false, error = "unknown_action" })
end

local JtoolGeneralApiHandler = class("JtoolGeneralApiHandler", SessionRequestHandler)

function JtoolGeneralApiHandler:getUrl(url, action)
    return "JtoolGeneralApi"
end

function JtoolGeneralApiHandler:get(url, action)
    action = normalize_action("jtools_general_api", url, action)
    if action ~= "state" then
        error(turbo.web.HTTPError(404))
    end

    local config, config_err = read_config()
    if not config then
        self:set_status(500)
        self:write({ ok = false, error = config_err or "config_read_failed" })
        return
    end

    local payload, err = run_locked_transaction(config, function()
        local qcainfo_raw, qcainfo_err = soft_run_command(config, 'AT+QCAINFO')
        local qeng_raw, qeng_err = soft_run_command(config, 'AT+QENG="servingcell"')
        local qtemp_raw, qtemp_err = soft_run_command(config, 'AT+QTEMP')
        local qnwinfo_raw, qnwinfo_err = soft_run_command(config, 'AT+QNWINFO')
        local qspn_raw, qspn_err = soft_run_command(config, 'AT+QSPN')
        local cops_raw, cops_err = soft_run_command(config, 'AT+COPS?')

        local qcainfo_summary = qcainfo_raw and summarize_response("AT+QCAINFO", qcainfo_raw) or ("unavailable: " .. tostring(qcainfo_err))
        local qeng_summary = qeng_raw and summarize_response('AT+QENG="servingcell"', qeng_raw) or ("unavailable: " .. tostring(qeng_err))
        local qtemp_summary = qtemp_raw and summarize_response("AT+QTEMP", qtemp_raw) or ("unavailable: " .. tostring(qtemp_err))
        local qnwinfo_summary = qnwinfo_raw and summarize_response("AT+QNWINFO", qnwinfo_raw) or ("unavailable: " .. tostring(qnwinfo_err))
        local qspn_summary = qspn_raw and summarize_response("AT+QSPN", qspn_raw) or ("unavailable: " .. tostring(qspn_err))
        local cops_summary = cops_raw and summarize_response("AT+COPS?", cops_raw) or ("unavailable: " .. tostring(cops_err))
        local temperatures, primary_temperature_text = parse_qtemp(qtemp_summary)

        return {
            ok = true,
            fetched_at = os.time(),
            qcainfo_summary = qcainfo_summary,
            qeng_summary = qeng_summary,
            qtemp_summary = qtemp_summary,
            qnwinfo_summary = qnwinfo_summary,
            qspn_summary = qspn_summary,
            cops_summary = cops_summary,
            carriers = parse_qcainfo(qcainfo_summary),
            servingcell_line = parse_qeng_servingcell(qeng_summary),
            temperatures = temperatures,
            primary_temperature_text = primary_temperature_text
        }
    end)

    if not payload then
        local status = err == "at_channel_busy" and 409 or 502
        self:set_status(status)
        self:write({ ok = false, error = err })
        return
    end

    self:write(payload)
end

local OoklaSpeedtestApiHandler = class("OoklaSpeedtestApiHandler", SessionRequestHandler)

function OoklaSpeedtestApiHandler:getUrl(url, action)
    return "OoklaSpeedtestApi"
end

function OoklaSpeedtestApiHandler:get(url, action)
    action = normalize_action("ookla_speedtest_api", url, action)

    if action == "state" then
        local payload = speedtest.get_state()
        if not payload.running then
            local config = read_config()
            if config then
                local ca_snapshot = run_locked_transaction(config, function()
                    local qcainfo_raw, qcainfo_err = soft_run_command(config, 'AT+QCAINFO')
                    local servingcell_raw, servingcell_err = soft_run_command(config, 'AT+QENG="servingcell"')
                    local qcainfo_summary = qcainfo_raw and summarize_response("AT+QCAINFO", qcainfo_raw) or ("unavailable: " .. tostring(qcainfo_err))
                    local servingcell_summary = servingcell_raw and summarize_response('AT+QENG="servingcell"', servingcell_raw) or ("unavailable: " .. tostring(servingcell_err))
                    return build_ca_snapshot(qcainfo_summary, servingcell_summary)
                end)
                if ca_snapshot then
                    payload.ca_info = ca_snapshot
                else
                    payload.ca_info = {
                        ok = false,
                        bands = {},
                        combo_text = "AT busy",
                        carriers = {},
                        servingcell_line = ""
                    }
                end
            end
        end
        self:write(payload)
        return
    end

    if action == "servers" then
        local state = speedtest.get_state()
        if not state.binary_present then
            self:set_status(503)
            self:write({
                ok = false,
                error = "speedtest_binary_missing",
                binary_path = speedtest.paths.binary,
                install_script = speedtest.paths.install_script,
                default_interface = state.default_interface or ""
            })
            return
        end

        local payload, err = speedtest.list_servers({
            interface = state.default_interface or speedtest.detect_default_interface() or ""
        })

        if not payload then
            self:set_status(502)
            self:write({ ok = false, error = err or "speedtest_server_list_failed" })
            return
        end

        self:write(payload)
        return
    end

    error(turbo.web.HTTPError(404))
end

function OoklaSpeedtestApiHandler:post(url, action)
    action = normalize_action("ookla_speedtest_api", url, action)
    if action == "recover" then
        self:write(speedtest.recover_backend())
        return
    end

    if action ~= "start" then
        self:set_status(404)
        self:write({ ok = false, error = "unknown_action" })
        return
    end

    local state = speedtest.get_state()
    if not state.binary_present then
        self:set_status(503)
        self:write({
            ok = false,
            error = "speedtest_binary_missing",
            binary_path = speedtest.paths.binary,
            install_script = speedtest.paths.install_script,
            default_interface = state.default_interface or ""
        })
        return
    end

    if state.running then
        self:set_status(409)
        self:write({ ok = false, error = "speedtest_busy" })
        return
    end

    local server_id, server_err = speedtest.sanitize_server_id(self:get_argument("server_id", ""))
    if server_err then
        self:set_status(400)
        self:write({ ok = false, error = server_err })
        return
    end

    local interface_name, iface_err = speedtest.sanitize_interface(state.default_interface or "")
    if iface_err then
        self:set_status(400)
        self:write({ ok = false, error = iface_err })
        return
    end

    self:write(speedtest.start_background({
        server_id = server_id,
        interface = interface_name
    }))
end

local TtlHelperApiHandler = class("TtlHelperApiHandler", SessionRequestHandler)

function TtlHelperApiHandler:getUrl(url, action)
    return "TtlHelperApi"
end

function TtlHelperApiHandler:get(url, action)
    action = normalize_action("ttl_helper_api", url, action)

    if action == "status" then
        local ok, result = pcall(ttl_helper.get_status)
        if not ok then
            self:set_status(500)
            self:write({ ok = false, error = "ttl_status_failed" })
            return
        end
        self:write(result)
        return
    end

    if action == "rules" then
        local ok, result = pcall(ttl_helper.get_rules)
        if not ok then
            self:set_status(500)
            self:write({ ok = false, error = "ttl_rules_failed" })
            return
        end
        self:write(result)
        return
    end

    error(turbo.web.HTTPError(404))
end

function TtlHelperApiHandler:post(url, action)
    action = normalize_action("ttl_helper_api", url, action)

    if action == "apply" then
        local value = self:get_argument("value", "")
        local ok, result = pcall(ttl_helper.apply_ttl, tonumber(value))
        if not ok then
            self:set_status(500)
            self:write({ ok = false, error = "ttl_apply_failed" })
            return
        end
        if result and not result.ok then
            self:set_status(400)
        end
        self:write(result)
        return
    end

    if action == "remove" then
        local ok, result = pcall(ttl_helper.remove_ttl)
        if not ok then
            self:set_status(500)
            self:write({ ok = false, error = "ttl_remove_failed" })
            return
        end
        self:write(result)
        return
    end

    self:set_status(404)
    self:write({ ok = false, error = "unknown_action" })
end

return {
    init = function(handlers)
        table.insert(handlers, 1, {"^/top_menu/JtoolServices$", JtoolTopMenuHandler})
        table.insert(handlers, 1, {"^/(ookla_speedtest_api)/(state)$", OoklaSpeedtestApiHandler})
        table.insert(handlers, 1, {"^/(ookla_speedtest_api)/(servers)$", OoklaSpeedtestApiHandler})
        table.insert(handlers, 1, {"^/(ookla_speedtest_api)/(start)$", OoklaSpeedtestApiHandler})
        table.insert(handlers, 1, {"^/(ookla_speedtest_api)/(recover)$", OoklaSpeedtestApiHandler})
        table.insert(handlers, 1, {"^/(ttl_helper_api)/(status)$", TtlHelperApiHandler})
        table.insert(handlers, 1, {"^/(ttl_helper_api)/(rules)$", TtlHelperApiHandler})
        table.insert(handlers, 1, {"^/(ttl_helper_api)/(apply)$", TtlHelperApiHandler})
        table.insert(handlers, 1, {"^/(ttl_helper_api)/(remove)$", TtlHelperApiHandler})
        table.insert(handlers, 1, {"^/(jtools_general_api)/(state)$", JtoolGeneralApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(state)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(mode)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(bands)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(at_terminal_api)/(run)$", AtTerminalApiHandler})
    end
}
