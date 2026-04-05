local JSON = require("JSON")

local M = {}

M.paths = {
    config = "/usrdata/at-stock-ui/screensaver_settings.json",
    release_info = "/usrdata/at-stock-ui/JTOOLS_RELEASE.txt",
    release_cache = "/tmp/qtooley-release-check-cache.json"
}

M.release = {
    owner = "Joetooley28",
    repo = "cfw3212-qtooley-overlay",
    api_latest = "https://api.github.com/repos/Joetooley28/cfw3212-qtooley-overlay/releases/latest",
    cache_ttl_seconds = 300
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

local function file_mtime(path)
    local handle = io.popen("busybox stat -c %Y " .. string.format("%q", path) .. " 2>/dev/null", "r")
    if not handle then
        return nil
    end
    local raw = handle:read("*a") or ""
    handle:close()
    local value = tonumber((raw:gsub("%s+", "")))
    return value
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

local function shell_quote(value)
    value = tostring(value or "")
    return "'" .. value:gsub("'", "'\\''") .. "'"
end

local function run_capture(command)
    local handle = io.popen("(" .. command .. ") 2>&1", "r")
    if not handle then
        return nil
    end
    local raw = handle:read("*a") or ""
    handle:close()
    return raw
end

local function command_exists(name)
    local raw = run_capture("command -v " .. shell_quote(name) .. " >/dev/null 2>&1; echo $?")
    return trim(raw) == "0"
end

local function to_int(value)
    local n = tonumber(value)
    if not n then
        return nil
    end
    n = math.floor(n)
    return n
end

local function read_release_label()
    local raw = read_file(M.paths.release_info)
    if not raw then
        return ""
    end
    for line in raw:gmatch("([^\r\n]+)") do
        local label = line:match("^Release label:%s*(.+)$")
        if label and label ~= "" then
            return trim(label)
        end
    end
    return ""
end

local function read_release_date()
    local raw = read_file(M.paths.release_info)
    if not raw then
        return ""
    end
    for line in raw:gmatch("([^\r\n]+)") do
        local value = line:match("^Release date:%s*(.+)$")
        if value and value ~= "" then
            return trim(value)
        end
    end
    return ""
end

local function fetch_latest_release_info()
    local fetch_cmd = ""
    if command_exists("curl") then
        fetch_cmd = "curl -fsSL " .. shell_quote(M.release.api_latest)
    elseif command_exists("wget") then
        fetch_cmd = "wget -qO- " .. shell_quote(M.release.api_latest)
    else
        return {
            ok = false,
            error = "no_fetch_tool",
            status_text = "Router does not have curl or wget for update checks."
        }
    end

    local raw = run_capture(fetch_cmd)
    local decoded = decode_json(raw or "")
    if type(decoded) ~= "table" then
        return {
            ok = false,
            error = "release_decode_failed",
            status_text = "Could not decode latest release info from GitHub."
        }
    end

    local asset_name = ""
    if type(decoded.assets) == "table" then
        for _, asset in ipairs(decoded.assets) do
            if type(asset) == "table" and type(asset.name) == "string" and asset.name:match("^stock%-ui%-at%-installer%-.+%.zip$") then
                asset_name = asset.name
                break
            end
        end
    end

    local result = {
        ok = true,
        latest_version = trim(decoded.tag_name or decoded.name or ""),
        latest_name = trim(decoded.name or ""),
        latest_published_at = trim(decoded.published_at or ""),
        release_url = trim(decoded.html_url or ""),
        zip_asset_name = asset_name,
        checked_at = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }

    write_file(M.paths.release_cache, encode_json(result))
    return result
end

local function read_cached_latest_release_info()
    local raw = read_file(M.paths.release_cache)
    local decoded = decode_json(raw)
    if type(decoded) ~= "table" then
        return nil
    end
    local mtime = file_mtime(M.paths.release_cache)
    if not mtime then
        return nil
    end
    if (os.time() - mtime) > M.release.cache_ttl_seconds then
        return nil
    end
    return decoded
end

local function latest_release_info(force_refresh)
    if force_refresh then
        return fetch_latest_release_info()
    end
    local cached = read_cached_latest_release_info()
    if cached then
        return cached
    end
    return fetch_latest_release_info()
end

local function update_status(current_version, latest_info)
    if not latest_info or latest_info.ok == false then
        return {
            update_available = false,
            status = "unknown",
            status_text = latest_info and latest_info.status_text or "Latest release information is unavailable."
        }
    end

    local latest_version = trim(latest_info.latest_version or "")
    if current_version ~= "" and latest_version ~= "" and current_version == latest_version then
        return {
            update_available = false,
            status = "current",
            status_text = "This router is already on the latest published Qtooley release."
        }
    end

    if latest_version ~= "" then
        return {
            update_available = true,
            status = "update_available",
            status_text = "A newer Qtooley release is available on GitHub."
        }
    end

    return {
        update_available = false,
        status = "unknown",
        status_text = "Latest release information is unavailable."
    }
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
    local settings = decode_json(read_file(M.paths.config))
    if settings then
        return normalize_settings(settings)
    end
    -- Migration: try reading from old quick_overview_settings.json on first use
    local old = decode_json(read_file("/usrdata/at-stock-ui/quick_overview_settings.json"))
    if old then
        local migrated = normalize_settings(old)
        write_file(M.paths.config, encode_json(migrated))
        return migrated
    end
    return normalize_settings({})
end

function M.write_config(value)
    return write_file(M.paths.config, encode_json(normalize_settings(value)))
end

function M.get_settings(force_refresh)
    local current_version = read_release_label()
    local current_date = read_release_date()
    local latest = latest_release_info(force_refresh == true)
    local update = update_status(current_version, latest)

    return {
        ok = true,
        settings = M.read_config(),
        release = {
            current_version = current_version,
            current_release_date = current_date,
            latest_version = latest and latest.latest_version or "",
            latest_name = latest and latest.latest_name or "",
            latest_published_at = latest and latest.latest_published_at or "",
            release_url = latest and latest.release_url or "",
            zip_asset_name = latest and latest.zip_asset_name or "",
            checked_at = latest and latest.checked_at or "",
            update_available = update.update_available,
            status = update.status,
            status_text = update.status_text
        }
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
