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

-- Cached firmware version (AT+QGMR) — fetched once per process lifetime
local _cached_firmware_version = nil

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
    ["WCDMA:NR5G"] = true,
    ["NR5G-NSA:NR5G:LTE"] = true,
    ["NR5G-NSA:LTE:NR5G"] = true,
    ["LTE:NR5G-NSA:NR5G"] = true,
    ["NR5G:NR5G-NSA:LTE"] = true
}

local NR5G_DISABLE_MODE_VALUES = {
    ["0"] = true,
    ["1"] = true
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

local function validate_rat_acq_order(order)
    if type(order) ~= "string" then
        return nil, "invalid_rat_acq_order"
    end
    order = order:gsub("^%s+", ""):gsub("%s+$", "")
    if not RAT_ACQ_ORDER_VALUES[order] then
        return nil, "invalid_rat_acq_order"
    end
    return order, nil
end

local function validate_nr5g_disable_mode(val)
    if type(val) ~= "string" then
        return nil, "invalid_nr5g_disable_mode"
    end
    val = val:gsub("^%s+", ""):gsub("%s+$", "")
    if not NR5G_DISABLE_MODE_VALUES[val] then
        return nil, "invalid_nr5g_disable_mode"
    end
    return val, nil
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

local CELL_LOCK_ACTIONS = {
    lock_lte = true,
    lock_nr5g = true,
    unlock_lte = true,
    unlock_nr5g = true
}

local SCS_VALUES = {
    ["15"] = true, ["30"] = true, ["60"] = true, ["120"] = true, ["240"] = true
}

local SCS_CODE_TO_KHZ = {
    ["0"] = "15", ["1"] = "30", ["2"] = "60", ["3"] = "120", ["4"] = "240"
}

local SCS_KHZ_TO_CODE = {
    ["15"] = "0", ["30"] = "1", ["60"] = "2", ["120"] = "3", ["240"] = "4"
}

local function validate_cell_lock_action(action)
    if type(action) ~= "string" or not CELL_LOCK_ACTIONS[action] then
        return nil, "invalid_cell_lock_action"
    end
    return action, nil
end

local function validate_scs_value(scs)
    if type(scs) ~= "string" then
        scs = tostring(scs)
    end
    scs = scs:gsub("^%s+", ""):gsub("%s+$", "")
    if not SCS_VALUES[scs] then
        return nil, "invalid_scs_value"
    end
    return scs, nil
end

local function validate_numeric(val, name, min_val, max_val)
    if type(val) ~= "string" then
        val = tostring(val or "")
    end
    val = val:gsub("^%s+", ""):gsub("%s+$", "")
    local num = tonumber(val)
    if not num or num ~= math.floor(num) then
        return nil, "invalid_" .. name .. "_not_integer"
    end
    if min_val and num < min_val then
        return nil, "invalid_" .. name .. "_too_low"
    end
    if max_val and num > max_val then
        return nil, "invalid_" .. name .. "_too_high"
    end
    return tostring(num), nil
end

local function validate_cell_pairs(json_str, num_cells)
    if type(json_str) ~= "string" or json_str == "" then
        return nil, "invalid_cell_pairs"
    end
    local ok_decode, pairs_array = pcall(function() return JSON:decode(json_str) end)
    if not ok_decode or type(pairs_array) ~= "table" then
        return nil, "invalid_cell_pairs_json"
    end
    local num = tonumber(num_cells) or 0
    if #pairs_array < num then
        return nil, "not_enough_cell_pairs"
    end
    local parts = {}
    for i = 1, num do
        local pair = pairs_array[i]
        if type(pair) ~= "table" then
            return nil, "invalid_cell_pair_entry"
        end
        local earfcn, e_err = validate_numeric(pair.earfcn or pair[1], "earfcn", 0, 999999)
        if not earfcn then
            return nil, e_err
        end
        local pci, p_err = validate_numeric(pair.pci or pair[2], "pci", 0, 503)
        if not pci then
            return nil, p_err
        end
        table.insert(parts, earfcn)
        table.insert(parts, pci)
    end
    return parts, nil
end

local function parse_qnwlock_status(raw, key)
    local lines = split_lines(raw)
    for _, line in ipairs(lines) do
        local pattern = '%+QNWLOCK:%s+"' .. key .. '",(.*)'
        local rest = line:match(pattern)
        if rest then
            local first = rest:match("^(%d+)")
            if first then
                local locked = (first ~= "0")
                return { locked = locked, detail = rest }
            end
        end
    end
    return { locked = false, detail = "" }
end

local function scs_code_to_khz(code)
    if type(code) ~= "string" then
        code = tostring(code or "")
    end
    return SCS_CODE_TO_KHZ[code] or code
end

local function parse_serving_cell(raw)
    local cells = {}
    local lines = split_lines(raw)
    for _, line in ipairs(lines) do
        if line:find('+QENG: "servingcell"') then
            local parts = {}
            for part in line:gmatch("([^,]+)") do
                table.insert(parts, (part:gsub("^%s+", ""):gsub("%s+$", ""):gsub('"', '')))
            end
            if #parts >= 10 then
                local rat = parts[3] or ""
                if rat == "LTE" then
                    table.insert(cells, {
                        type = "lte_serving",
                        serving = true,
                        earfcn = parts[9] or "",
                        pci = parts[8] or "",
                        band = parts[10] or "",
                        rsrp = parts[14] or "-",
                        rsrq = parts[15] or "-",
                        sinr = parts[17] or "-",
                        scs = "-"
                    })
                elseif rat == "NR5G-SA" then
                    table.insert(cells, {
                        type = "nr5g_sa_serving",
                        serving = true,
                        earfcn = parts[10] or "",
                        pci = parts[8] or "",
                        band = parts[11] or "",
                        rsrp = parts[13] or "-",
                        rsrq = parts[14] or "-",
                        sinr = parts[15] or "-",
                        scs = scs_code_to_khz(parts[16] or "")
                    })
                end
            end
        end
        if line:find('+QENG: "NR5G%-NSA"') or line:find('+QENG:"NR5G%-NSA"') then
            local parts = {}
            for part in line:gmatch("([^,]+)") do
                table.insert(parts, (part:gsub("^%s+", ""):gsub("%s+$", ""):gsub('"', '')))
            end
            if #parts >= 8 then
                table.insert(cells, {
                    type = "nr5g_nsa_serving",
                    serving = true,
                    pci = parts[4] or "",
                    rsrp = parts[5] or "-",
                    sinr = parts[6] or "-",
                    rsrq = parts[7] or "-",
                    earfcn = parts[8] or "",
                    band = parts[9] or "",
                    scs = scs_code_to_khz(parts[11] or "")
                })
            end
        end
    end
    return cells
end

local function parse_neighbour_cells(raw)
    local cells = {}
    local lines = split_lines(raw)
    for _, line in ipairs(lines) do
        if line:find("neighbourcell intra") or line:find("neighbourcell inter") then
            local parts = {}
            for part in line:gmatch("([^,]+)") do
                table.insert(parts, (part:gsub("^%s+", ""):gsub("%s+$", ""):gsub('"', '')))
            end
            if #parts >= 6 then
                local nbr_type = "lte_intra"
                if line:find("neighbourcell inter") then
                    nbr_type = "lte_inter"
                end
                local earfcn = parts[3] or ""
                local pci = parts[4] or ""
                if earfcn ~= "-" and earfcn ~= "" and pci ~= "-" and pci ~= "" then
                    table.insert(cells, {
                        type = nbr_type,
                        serving = false,
                        earfcn = earfcn,
                        pci = pci,
                        band = "-",
                        rsrq = parts[5] or "-",
                        rsrp = parts[6] or "-",
                        sinr = parts[8] or "-",
                        scs = "-"
                    })
                end
            end
        end
        if line:find('"NR5G%-NSA"') and not line:find("servingcell") then
            local parts = {}
            for part in line:gmatch("([^,]+)") do
                table.insert(parts, (part:gsub("^%s+", ""):gsub("%s+$", ""):gsub('"', '')))
            end
            if #parts >= 8 then
                local pci = parts[4] or ""
                local earfcn = parts[8] or ""
                if pci ~= "-" and pci ~= "" and earfcn ~= "-" and earfcn ~= "" then
                    table.insert(cells, {
                        type = "nr5g_nsa",
                        serving = false,
                        pci = pci,
                        rsrp = parts[5] or "-",
                        sinr = parts[6] or "-",
                        rsrq = parts[7] or "-",
                        earfcn = earfcn,
                        band = parts[9] or "-",
                        scs = scs_code_to_khz(parts[11] or "")
                    })
                end
            end
        end
    end
    return cells
end

local function earfcn_to_nr_band(earfcn)
    local e = tonumber(earfcn)
    if not e then return "-" end
    if e >= 123400 and e <= 130400 then return "71"
    elseif e >= 620000 and e <= 680000 then return "77"
    elseif e >= 620000 and e <= 653333 then return "78"
    elseif e >= 386000 and e <= 398000 then return "25"
    elseif e >= 173800 and e <= 178800 then return "41"
    elseif e >= 151600 and e <= 160600 then return "66"
    elseif e >= 143400 and e <= 145600 then return "48"
    elseif e >= 149200 and e <= 160600 then return "2"
    elseif e >= 171800 and e <= 178800 then return "38"
    end
    return "-"
end

local function parse_qscan_cells(raw)
    local cells = {}
    local lines = split_lines(raw)
    for _, line in ipairs(lines) do
        if line:find('+QSCAN:') then
            local parts = {}
            for part in line:gmatch("([^,]+)") do
                table.insert(parts, (part:gsub("^%s+", ""):gsub("%s+$", ""):gsub('"', '')))
            end
            if #parts >= 8 then
                local rat_raw = parts[1]:match(':%s*"?([^"]+)"?$') or parts[1]:match("QSCAN:%s*(.+)$") or ""
                rat_raw = rat_raw:gsub('"', ''):gsub("^%s+", ""):gsub("%s+$", "")
                local earfcn = parts[4] or ""
                local pci = parts[5] or ""
                if earfcn ~= "" and earfcn ~= "-" and pci ~= "" and pci ~= "-" then
                    local is_nr = (rat_raw == "NR5G")
                    local band = "-"
                    if is_nr then
                        band = earfcn_to_nr_band(earfcn)
                    end
                    table.insert(cells, {
                        type = is_nr and "nr5g_scan" or "lte_scan",
                        serving = false,
                        earfcn = earfcn,
                        pci = pci,
                        band = band,
                        rsrp = parts[6] or "-",
                        rsrq = parts[7] or "-",
                        sinr = parts[8] or "-",
                        scs = "-",
                        mcc = parts[2] or "-",
                        mnc = parts[3] or "-"
                    })
                end
            end
        end
    end
    return cells
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
    local resp = result.response or ""
    local cme = resp:match("%+CME ERROR:%s*(%d+)")
    if cme then
        return nil, "CME_ERROR_" .. cme
    end
    local cms = resp:match("%+CMS ERROR:%s*(%d+)")
    if cms then
        return nil, "CMS_ERROR_" .. cms
    end
    if resp:match("\nERROR%s*$") or resp:match("^ERROR%s*$") then
        return nil, "AT_ERROR"
    end
    return resp, nil
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
                -- Extract per-carrier RSRP/RSRQ: always at band_index+3 and band_index+4
                local carrier_rsrp = nil
                local carrier_rsrq = nil
                local carrier_sinr = nil
                if tokens[band_index + 3] then
                    local v = tonumber(tokens[band_index + 3])
                    if v and v < 0 then carrier_rsrp = v end
                end
                if tokens[band_index + 4] then
                    local v = tonumber(tokens[band_index + 4])
                    if v and v < 0 then carrier_rsrq = v end
                end
                -- SINR: NR5G at band_index+5, LTE at band_index+6 (RSSI in between)
                local sinr_idx = (rat == "NR5G") and (band_index + 5) or (band_index + 6)
                if tokens[sinr_idx] then
                    local v = tonumber(tokens[sinr_idx])
                    if v then carrier_sinr = v end
                end
                table.insert(carriers, {
                    role = role,
                    rat = rat or "",
                    band = band or "",
                    band_label = band_label,
                    channel = channel or "",
                    bandwidth_mhz = bandwidth_mhz or "",
                    bandwidth_text = bandwidth_mhz and ("Bandwidth " .. bandwidth_mhz .. " MHz") or "Bandwidth unavailable",
                    rsrp = carrier_rsrp,
                    rsrq = carrier_rsrq,
                    sinr = carrier_sinr,
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

-- Parse AT+QRSRP/QRSRQ/QSINR: per-antenna values + sys_mode
-- Format: +QRSRP: <v0>,<v1>,<v2>,<v3>,<sys_mode>
local function parse_qsignal(summary, prefix)
    local escaped = prefix:gsub("(%W)", "%%%1")
    for line in (summary or ""):gmatch("([^\n]+)") do
        if line:find(escaped) then
            local body = line:gsub("^" .. escaped .. ":%s*", "")
            local values = {}
            local sys_mode = nil
            for token in body:gmatch("([^,]+)") do
                local trimmed = token:gsub("^%s+", ""):gsub("%s+$", "")
                local num = tonumber(trimmed)
                if num then
                    -- Skip -32768 (unavailable sentinel)
                    if num > -32768 then
                        table.insert(values, num)
                    end
                else
                    sys_mode = trimmed
                end
            end
            -- Return best (highest) value as primary, plus all valid values
            local best = nil
            for _, v in ipairs(values) do
                if not best or v > best then best = v end
            end
            return {
                values = values,
                best = best,
                sys_mode = sys_mode or ""
            }
        end
    end
    return nil
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

    local config, config_err = read_config()
    if not config then
        self:set_status(500)
        self:write({ ok = false, error = config_err or "config_read_failed" })
        return
    end

    if action == "state" then
        local payload, err = run_locked_transaction(config, function()
            local mode_raw = must_run_command(config, 'AT+QNWPREFCFG="mode_pref"')
            local acq_raw = soft_run_command(config, 'AT+QNWPREFCFG="rat_acq_order"')
            local nr5g_dis_raw = soft_run_command(config, 'AT+QNWPREFCFG="nr5g_disable_mode"')
            local lte_raw = must_run_command(config, 'AT+QNWPREFCFG="lte_band"')
            local nsa_raw = must_run_command(config, 'AT+QNWPREFCFG="nsa_nr5g_band"')
            local sa_raw = must_run_command(config, 'AT+QNWPREFCFG="nr5g_band"')
            local qnwinfo_raw, qnwinfo_err = soft_run_command(config, 'AT+QNWINFO')
            local qcainfo_raw, qcainfo_err = soft_run_command(config, 'AT+QCAINFO')
            local servingcell_raw, servingcell_err = soft_run_command(config, 'AT+QENG="servingcell"')

            return {
                ok = true,
                mode_pref = parse_pref_value("mode_pref", mode_raw) or "AUTO",
                rat_acq_order = acq_raw and parse_pref_value("rat_acq_order", acq_raw) or "",
                nr5g_disable_mode = nr5g_dis_raw and parse_pref_value("nr5g_disable_mode", nr5g_dis_raw) or "0",
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
        return
    end

    if action == "cell_state" then
        local payload, err = run_locked_transaction(config, function()
            local lte_raw, lte_err = soft_run_command(config, 'AT+QNWLOCK="common/4g"')
            local nr5g_raw, nr5g_err = soft_run_command(config, 'AT+QNWLOCK="common/5g"')

            local lte_status = lte_raw and parse_qnwlock_status(lte_raw, "common/4g") or { locked = false, detail = "" }
            local nr5g_status = nr5g_raw and parse_qnwlock_status(nr5g_raw, "common/5g") or { locked = false, detail = "" }

            return {
                ok = true,
                lte_locked = lte_status.locked,
                lte_detail = lte_status.detail,
                nr5g_locked = nr5g_status.locked,
                nr5g_detail = nr5g_status.detail
            }
        end)

        if not payload then
            local status = err == "at_channel_busy" and 409 or 502
            self:set_status(status)
            self:write({ ok = false, error = err })
            return
        end

        self:write(payload)
        return
    end

    if action == "cell_scan" then
        local saved_read_timeout = config.read_timeout_ms
        local saved_hard_timeout = config.hard_timeout_ms
        config.read_timeout_ms = 30000
        config.hard_timeout_ms = 60000
        local payload, err = run_locked_transaction(config, function()
            local serving_raw, serving_err = soft_run_command(config, 'AT+QENG="servingcell"')
            local neighbour_raw, neighbour_err = soft_run_command(config, 'AT+QENG="neighbourcell"')
            local qscan_raw, qscan_err = soft_run_command(config, 'AT+QSCAN=3')

            local cells = {}
            if serving_raw then
                local serving_cells = parse_serving_cell(serving_raw)
                for _, c in ipairs(serving_cells) do
                    table.insert(cells, c)
                end
            end
            if neighbour_raw then
                local nbr_cells = parse_neighbour_cells(neighbour_raw)
                for _, c in ipairs(nbr_cells) do
                    table.insert(cells, c)
                end
            end

            if qscan_raw then
                local seen = {}
                for _, c in ipairs(cells) do
                    seen[c.earfcn .. ":" .. c.pci] = true
                end
                local scan_cells = parse_qscan_cells(qscan_raw)
                for _, c in ipairs(scan_cells) do
                    if not seen[c.earfcn .. ":" .. c.pci] then
                        table.insert(cells, c)
                        seen[c.earfcn .. ":" .. c.pci] = true
                    end
                end
            end

            return {
                ok = true,
                cells = cells,
                serving_raw = serving_raw and summarize_response('AT+QENG="servingcell"', serving_raw) or ("unavailable: " .. tostring(serving_err)),
                neighbour_raw = neighbour_raw and summarize_response('AT+QENG="neighbourcell"', neighbour_raw) or ("unavailable: " .. tostring(neighbour_err)),
                qscan_raw = qscan_raw and summarize_response('AT+QSCAN=3', qscan_raw) or ("unavailable: " .. tostring(qscan_err))
            }
        end)
        config.read_timeout_ms = saved_read_timeout
        config.hard_timeout_ms = saved_hard_timeout

        if not payload then
            local status = err == "at_channel_busy" and 409 or 502
            self:set_status(status)
            self:write({ ok = false, error = err })
            return
        end

        self:write(payload)
        return
    end

    error(turbo.web.HTTPError(404))
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

    if action == "rat_acq_order" then
        local order, order_err = validate_rat_acq_order(self:get_argument("order", ""))
        if not order then
            self:set_status(400)
            self:write({ ok = false, error = order_err })
            return
        end

        local result, err = run_locked_transaction(config, function()
            local command = 'AT+QNWPREFCFG="rat_acq_order",' .. order
            local response = must_run_command(config, command)
            local readback_raw = must_run_command(config, 'AT+QNWPREFCFG="rat_acq_order"')
            return {
                ok = true,
                response = summarize_response(command, response),
                applied_order = parse_pref_value("rat_acq_order", readback_raw) or "",
                readback_summary = summarize_response('AT+QNWPREFCFG="rat_acq_order"', readback_raw)
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

    if action == "nr5g_disable" then
        local val, val_err = validate_nr5g_disable_mode(self:get_argument("value", ""))
        if not val then
            self:set_status(400)
            self:write({ ok = false, error = val_err })
            return
        end

        local result, err = run_locked_transaction(config, function()
            local command = 'AT+QNWPREFCFG="nr5g_disable_mode",' .. val
            local response = must_run_command(config, command)
            local readback_raw = must_run_command(config, 'AT+QNWPREFCFG="nr5g_disable_mode"')
            return {
                ok = true,
                response = summarize_response(command, response),
                applied_value = parse_pref_value("nr5g_disable_mode", readback_raw) or "",
                readback_summary = summarize_response('AT+QNWPREFCFG="nr5g_disable_mode"', readback_raw)
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

    if action == "cell_lock" then
        local cell_action, ca_err = validate_cell_lock_action(self:get_argument("action", ""))
        if not cell_action then
            self:set_status(400)
            self:write({ ok = false, error = ca_err })
            return
        end

        local cfun_restart = self:get_argument("cfun_restart", "") == "1"

        if cell_action == "lock_lte" then
            local num_cells, nc_err = validate_numeric(self:get_argument("num_cells", ""), "num_cells", 1, 10)
            if not num_cells then
                self:set_status(400)
                self:write({ ok = false, error = nc_err })
                return
            end

            local pair_parts, pp_err = validate_cell_pairs(self:get_argument("pairs", ""), tonumber(num_cells))
            if not pair_parts then
                self:set_status(400)
                self:write({ ok = false, error = pp_err })
                return
            end

            local command = 'AT+QNWLOCK="common/4g",' .. num_cells .. "," .. table.concat(pair_parts, ",")
            local saved_read_timeout = config.read_timeout_ms
            config.read_timeout_ms = 10000
            local result, err = run_locked_transaction(config, function()
                if cfun_restart then
                    soft_run_command(config, "AT+CFUN=0")
                end
                local response, cmd_err = soft_run_command(config, command)
                if not response then
                    return { ok = false, error = "Modem rejected LTE cell lock: " .. (cmd_err or "unknown error"), command_sent = command }
                end
                if cfun_restart then
                    soft_run_command(config, "AT+CFUN=1")
                end
                local readback_raw, rb_err = soft_run_command(config, 'AT+QNWLOCK="common/4g"')
                local lte_status = readback_raw and parse_qnwlock_status(readback_raw, "common/4g") or { locked = false, detail = "" }
                return {
                    ok = true,
                    command_sent = command,
                    response = summarize_response(command, response),
                    lte_locked = lte_status.locked,
                    lte_detail = lte_status.detail,
                    message = lte_status.locked and "LTE cell lock applied successfully." or "LTE cell lock command sent."
                }
            end)
            config.read_timeout_ms = saved_read_timeout

            if not result then
                local status = err == "at_channel_busy" and 409 or 502
                self:set_status(status)
                self:write({ ok = false, error = err })
                return
            end

            self:write(result)
            return
        end

        if cell_action == "lock_nr5g" then
            local earfcn, e_err = validate_numeric(self:get_argument("earfcn", ""), "earfcn", 0, 999999)
            if not earfcn then
                self:set_status(400)
                self:write({ ok = false, error = e_err })
                return
            end
            local pci, p_err = validate_numeric(self:get_argument("pci", ""), "pci", 0, 1007)
            if not pci then
                self:set_status(400)
                self:write({ ok = false, error = p_err })
                return
            end
            local scs, s_err = validate_scs_value(self:get_argument("scs", ""))
            if not scs then
                self:set_status(400)
                self:write({ ok = false, error = s_err })
                return
            end
            local band, b_err = validate_numeric(self:get_argument("band", ""), "band", 1, 512)
            if not band then
                self:set_status(400)
                self:write({ ok = false, error = b_err })
                return
            end

            local command = 'AT+QNWLOCK="common/5g",' .. earfcn .. "," .. pci .. "," .. scs .. "," .. band
            local saved_read_timeout = config.read_timeout_ms
            config.read_timeout_ms = 10000
            local result, err = run_locked_transaction(config, function()
                if cfun_restart then
                    soft_run_command(config, "AT+CFUN=0")
                end
                local response, cmd_err = soft_run_command(config, command)
                if not response then
                    return { ok = false, error = "Modem rejected NR5G-SA cell lock: " .. (cmd_err or "unknown error"), command_sent = command }
                end
                if cfun_restart then
                    soft_run_command(config, "AT+CFUN=1")
                end
                local readback_raw, rb_err = soft_run_command(config, 'AT+QNWLOCK="common/5g"')
                local nr5g_status = readback_raw and parse_qnwlock_status(readback_raw, "common/5g") or { locked = false, detail = "" }
                return {
                    ok = true,
                    command_sent = command,
                    response = summarize_response(command, response),
                    nr5g_locked = nr5g_status.locked,
                    nr5g_detail = nr5g_status.detail,
                    message = nr5g_status.locked and "NR5G-SA cell lock applied successfully." or "NR5G-SA cell lock command sent."
                }
            end)
            config.read_timeout_ms = saved_read_timeout

            if not result then
                local status = err == "at_channel_busy" and 409 or 502
                self:set_status(status)
                self:write({ ok = false, error = err })
                return
            end

            self:write(result)
            return
        end

        if cell_action == "unlock_lte" then
            local command = 'AT+QNWLOCK="common/4g",0'
            local result, err = run_locked_transaction(config, function()
                local response = must_run_command(config, command)
                local readback_raw, rb_err = soft_run_command(config, 'AT+QNWLOCK="common/4g"')
                local lte_status = readback_raw and parse_qnwlock_status(readback_raw, "common/4g") or { locked = false, detail = "" }
                return {
                    ok = true,
                    command_sent = command,
                    response = summarize_response(command, response),
                    lte_locked = lte_status.locked,
                    message = not lte_status.locked and "LTE cell lock removed successfully." or "LTE unlock command sent."
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

        if cell_action == "unlock_nr5g" then
            local command = 'AT+QNWLOCK="common/5g",0'
            local result, err = run_locked_transaction(config, function()
                local response = must_run_command(config, command)
                local readback_raw, rb_err = soft_run_command(config, 'AT+QNWLOCK="common/5g"')
                local nr5g_status = readback_raw and parse_qnwlock_status(readback_raw, "common/5g") or { locked = false, detail = "" }
                return {
                    ok = true,
                    command_sent = command,
                    response = summarize_response(command, response),
                    nr5g_locked = nr5g_status.locked,
                    message = not nr5g_status.locked and "NR5G-SA cell lock removed successfully." or "NR5G-SA unlock command sent."
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

    -- Only run extra signal crosscheck commands when requested (adds ~3 AT cmds)
    local want_crosscheck = (self:get_argument("crosscheck", "") == "1")

    local payload, err = run_locked_transaction(config, function()
        local qcainfo_raw, qcainfo_err = soft_run_command(config, 'AT+QCAINFO')
        local qeng_raw, qeng_err = soft_run_command(config, 'AT+QENG="servingcell"')
        local qtemp_raw, qtemp_err = soft_run_command(config, 'AT+QTEMP')
        local qnwinfo_raw, qnwinfo_err = soft_run_command(config, 'AT+QNWINFO')
        local qspn_raw, qspn_err = soft_run_command(config, 'AT+QSPN')
        local cops_raw, cops_err = soft_run_command(config, 'AT+COPS?')

        -- Firmware version: fetch once and cache for process lifetime
        if not _cached_firmware_version then
            local qgmr_raw = soft_run_command(config, 'AT+QGMR')
            if qgmr_raw then
                local fw = summarize_response("AT+QGMR", qgmr_raw)
                if fw and fw ~= "" and not fw:find("^unavailable") then
                    _cached_firmware_version = fw:gsub("^%s+", ""):gsub("%s+$", "")
                end
            end
        end

        -- Multi-source signal confirmation (opt-in to keep normal polling fast)
        local qrsrp_raw, qrsrq_raw, qsinr_raw
        if want_crosscheck then
            qrsrp_raw = soft_run_command(config, 'AT+QRSRP')
            qrsrq_raw = soft_run_command(config, 'AT+QRSRQ')
            qsinr_raw = soft_run_command(config, 'AT+QSINR')
        end

        local qcainfo_summary = qcainfo_raw and summarize_response("AT+QCAINFO", qcainfo_raw) or ("unavailable: " .. tostring(qcainfo_err))
        local qeng_summary = qeng_raw and summarize_response('AT+QENG="servingcell"', qeng_raw) or ("unavailable: " .. tostring(qeng_err))
        local qtemp_summary = qtemp_raw and summarize_response("AT+QTEMP", qtemp_raw) or ("unavailable: " .. tostring(qtemp_err))
        local qnwinfo_summary = qnwinfo_raw and summarize_response("AT+QNWINFO", qnwinfo_raw) or ("unavailable: " .. tostring(qnwinfo_err))
        local qspn_summary = qspn_raw and summarize_response("AT+QSPN", qspn_raw) or ("unavailable: " .. tostring(qspn_err))
        local cops_summary = cops_raw and summarize_response("AT+COPS?", cops_raw) or ("unavailable: " .. tostring(cops_err))
        local temperatures, primary_temperature_text = parse_qtemp(qtemp_summary)

        local crosscheck_data = nil
        if want_crosscheck then
            local qrsrp_summary = qrsrp_raw and summarize_response("AT+QRSRP", qrsrp_raw) or nil
            local qrsrq_summary = qrsrq_raw and summarize_response("AT+QRSRQ", qrsrq_raw) or nil
            local qsinr_summary = qsinr_raw and summarize_response("AT+QSINR", qsinr_raw) or nil
            crosscheck_data = {
                qrsrp = parse_qsignal(qrsrp_summary, "+QRSRP"),
                qrsrq = parse_qsignal(qrsrq_summary, "+QRSRQ"),
                qsinr = parse_qsignal(qsinr_summary, "+QSINR")
            }
        end

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
            primary_temperature_text = primary_temperature_text,
            firmware_version = _cached_firmware_version,
            signal_crosscheck = crosscheck_data
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
        if payload.running then
            -- Serve the frozen CA snapshot captured at test start
            local f = io.open("/tmp/ookla-speedtest-ca-snapshot.json", "r")
            if f then
                local raw = f:read("*a")
                f:close()
                local ok_decode, decoded = pcall(function() return JSON:decode(raw) end)
                if ok_decode and type(decoded) == "table" then
                    decoded.snapshot = true
                    payload.ca_info = decoded
                end
            end
        else
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
        os.remove("/tmp/ookla-speedtest-ca-snapshot.json")
        os.remove("/tmp/ookla-speedtest-ca-snapshot.json.tmp")
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

    -- Snapshot CA bands before the test starts so they can be shown during the run
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
            ca_snapshot.snapshot = true
            ca_snapshot.captured_at = os.date("!%Y-%m-%dT%H:%M:%SZ")
            local encoded = JSON:encode(ca_snapshot)
            if encoded then
                local tmp = "/tmp/ookla-speedtest-ca-snapshot.json.tmp"
                local dst = "/tmp/ookla-speedtest-ca-snapshot.json"
                local f = io.open(tmp, "w")
                if f then
                    f:write(encoded)
                    f:close()
                    os.rename(tmp, dst)
                end
            end
        end
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
        table.insert(handlers, 1, {"^/(band_locking_api)/(rat_acq_order)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(nr5g_disable)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(bands)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(cell_state)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(cell_scan)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(band_locking_api)/(cell_lock)$", BandLockingApiHandler})
        table.insert(handlers, 1, {"^/(at_terminal_api)/(run)$", AtTerminalApiHandler})
    end
}
