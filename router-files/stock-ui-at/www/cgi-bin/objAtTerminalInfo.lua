package.path = package.path .. ";/usrdata/at-stock-ui/?.lua"

local function read_config()
  local JSON = require("JSON")
  local f = io.open("/usrdata/at-stock-ui/config.json", "rb")
  if not f then
    return nil
  end
  local raw = f:read("*a") or ""
  f:close()
  if type(JSON.decode) == "function" then
    return JSON:decode(raw)
  end
  return nil
end

local function resolve_device_path(config)
  if not config then
    return ""
  end
  local selected = config.backend_modes and config.backend_modes[config.backend_mode or ""]
  return selected and selected.device_path or ""
end

objHandler = {
  pageURL='/at_terminal.html',
  authenticatedOnly=true,
  readGroups={root=true,admin=true},
  writeGroups={root=true,admin=true},
  get=function(authenticated, requestHandler)
    local config = read_config() or {}
    return {
      currentUser = requestHandler.session.user or "",
      backendMode = config.backend_mode or "",
      devicePath = resolve_device_path(config),
      validation = "Single-line AT only. Blocks CR/LF, semicolon chaining, and shell metacharacters.",
      lockPath = config.lock_path or "",
      testedFirmware = "USC_1.1.79.0 / RG520NNADAR03A03M4G"
    }
  end,
  validate=function(o, requestHandler)
    return true
  end,
  set=function(authenticated, o, requestHandler)
    return 0
  end
}
