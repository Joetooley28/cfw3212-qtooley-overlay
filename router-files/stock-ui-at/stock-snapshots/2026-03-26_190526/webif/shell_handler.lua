--[[
    Simple shell output handler class.
    Copyright (C) 2021 Casa Systems Inc.
--]]

local turbo = require("turbo")
local SessionRequestHandler = require("session_handler")

local ShellHandler = class("ShellHandler", SessionRequestHandler)

function ShellHandler:prepare()
    ShellHandler.super.prepare(self)
    if type(self.options) ~= "string" then
        error("ShellHandler not initialized with correct parameters.")
    end
    self.cmd = self.options
end

--- GET method for shell command output.
-- @param path The path captured from request.
function ShellHandler:get(path)
    local file, err
    local dis_level = {"emerg","alert","crit","err","warn","notice","info","debug"}
    local level = self:get_argument('level','')
    if level ~= '' then
      local cmd = self.cmd..'| grep "'
      for k,v in ipairs(dis_level) do
        if v == level then
            cmd = cmd..'\\.'..v..'"'
            break
        end
        cmd = cmd..'\\.'..v..'\\|'
      end
      file, err = io.popen(cmd, "r")
    else
      file, err = io.popen(self.cmd, "r")
    end
    if not file then
        error(turbo.web.HTTPError(404))
    end

    self:write_chunked_file(file)
    file:close()
end
return ShellHandler
