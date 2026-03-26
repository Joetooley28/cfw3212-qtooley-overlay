--[[
    A handler module to process runtime configuration requests

    Copyright (C) 2021 Casa Systems Inc.
--]]
require("lfs")
require("support")
require('srvrUtils')
local bit = require("bit")
local luardb = require("luardb")
local g_turbo_dir = "/usr/share/lua/5.1/webif"
local turbo = require("turbo")
local SessionRequestHandler = require("session_handler")

local codeBit2CfgType = {
    [1] = " rdb",
    [2] = " cert",
    [4] = " mbn",
    [8] = " efs"
}

local RuntimeConfigHandler = class("RuntimeConfigHandler", SessionRequestHandler)

function RuntimeConfigHandler:post(url)
    turbo.log.debug('RuntimeConfigHandler:post('..url..')')

    luardb.set("runtime.config.webui.message", "")
    luardb.set("runtime.config.webui.result", -1)
    local configFile = self:get_argument("file", "")
    if configFile ~= "/tmp/runtime_config/webui_rtconf.star" or not file_exists(configFile) then
        error(turbo.web.HTTPError(400, "Invalid file"))
    end

    local cmd = "/usr/bin/apply_late_configs.sh "..configFile
    local result = os.execute(cmd)
    local response = {}
    if not result then
        error(turbo.web.HTTPError(500, "failed to apply configs"))
        return
    end

    local exitCode = result / 256
    response.result = exitCode
    if exitCode == 128 then
        response.message = luardb.get("runtime.config.message") or ""
    elseif exitCode ~= 0 then
        local message = "Failed to apply config type"
        for codeBit, type in pairs(codeBit2CfgType) do
            if bit.band(exitCode, codeBit) == codeBit then
                message = message..type
            end
        end
        response.message = message
    end
    luardb.set("runtime.config.webui.message", response.message or "")
    luardb.set("runtime.config.webui.result", response.result)
    self:write(response)
end

function RuntimeConfigHandler:get(url)
    turbo.log.debug('RuntimeConfigHandler:get('..url..')')

    local message = luardb.get("runtime.config.webui.message") or ""
    local result = luardb.get("runtime.config.webui.result") or -1
    self:write({result = result, message = message})
end

-----------------------------------------------------------------------------------------------------------------------
-- Module configuration
-----------------------------------------------------------------------------------------------------------------------
local module = {}
function module.init(handlers)
    table.insert(handlers, {"^/(ApplyRuntimeConfig)$", RuntimeConfigHandler})
end

return module
