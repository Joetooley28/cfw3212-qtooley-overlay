--[[
    A handler module to process settings backup and restore requests

    Copyright (C) 2021 Casa Systems Inc.
--]]
require("lfs")
require("support")
require('srvrUtils')
local luardb = require("luardb")
local g_turbo_dir = "/usr/share/lua/5.1/webif"
local turbo = require("turbo")
local SessionRequestHandler = require("session_handler")

local function getPasswordArg(appHandler)
    local password = appHandler:get_argument("password", "")
    if not password == "" and not password:match("^[a-zA-Z0-9+=/]+$") then
        error(turbo.web.HTTPError(400, "Bad request"))
    end
    return password
end

local function saveOrRestoreSettings(appHandler, action, password, restoreFactory)
    -- password is base64 encoded string and will be base64 decoded in settings_backup.sh.
    restoreFactory = restoreFactory or 0
    local cmd = "/usr/bin/settings_backup.sh "..action.." "..password.." "..restoreFactory
    local result  = executeCommand(cmd)
    if not result or result[1] == "error" then
        error(turbo.web.HTTPError(500, "failed to "..action.." current settings"))
        return
    end
    return result
end

local SettingsBackupHandler = class("SettingsBackupHandler", SessionRequestHandler)

function SettingsBackupHandler:post(url)
    turbo.log.debug('SettingsBackupHandler:post('..url..')')
    local password = getPasswordArg(self)
    local result = saveOrRestoreSettings(self, "save", password)

    -- /www/config is symlinked to V_EXPORTCONFPATH (/tmp/config for Cassini)
    local data = { filename = "/config/"..result[1] }
    self:write({ result = 0, data = data })
end

local SettingsRestoreHandler = class("SettingsRestoreHandler", SessionRequestHandler)

function SettingsRestoreHandler:post(url)
    turbo.log.debug('SettingsRestoreHandler:post('..url..')')
    local restoreFactory = self:get_argument("restoreFactory", "0")
    if tostring(restoreFactory) ~= "0" and tostring(restoreFactory) ~= "1" then
        error(turbo.web.HTTPError(400, "Invalid restoreFactory param value: "..restoreFactory))
    end
    local password = getPasswordArg(self)
    local result = saveOrRestoreSettings(self, "restore", password, restoreFactory)

    local data = {}
    for _, v in ipairs(result) do
        local rdbVal = v:explode("=")
        data[rdbVal[1]] = rdbVal[2]
        turbo.log.debug(string.format("data[%s] = %s", rdbVal[1], rdbVal[2]))
    end

    self:write({ result = 0, data = data })
end

local RestoreConfigHandler = class("RestoreConfigHandler", turbo.web.RequestHandler)

--[[
    When the user uses the device for the first time or restores the factory, it is in an unauthenticated state.
    Guide the user to configure.
--]]
function RestoreConfigHandler:post(url)
    turbo.log.debug('RestoreConfigHandler:post('..url..')')
    local password = getPasswordArg(self)
    local result = saveOrRestoreSettings(self, "restore", password, restoreFactory)

    local data = {}
    for _, v in ipairs(result) do
        local rdbVal = v:explode("=")
        data[rdbVal[1]] = rdbVal[2]
        turbo.log.debug(string.format("data[%s] = %s", rdbVal[1], rdbVal[2]))
    end

    self:write({ result = 0, data = data })
    luardb.set("service.webui.need_generate_default_password", "0")
end

return {
    init = function(handlers)
        table.insert(handlers, {"^/(BackupSettings)$", SettingsBackupHandler})
        table.insert(handlers, {"^/(RestoreSettings)$", SettingsRestoreHandler})
        table.insert(handlers, {"^/(restoreConfig)$", RestoreConfigHandler})
    end
}
