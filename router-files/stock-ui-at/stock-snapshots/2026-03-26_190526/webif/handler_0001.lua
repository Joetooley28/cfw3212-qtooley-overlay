--[[
    Encrypted debuginfo downloading/generating module
    Copyright (C) 2022 Casa Systems Inc.
--]]

require('srvrUtils')
local turbo = require("turbo")
local SessionRequestHandler = require("session_handler")

local DebuginfoXDownloadHandler = class("DebuginfoXDownloadHandler", SessionRequestHandler)

-- Download encrypted debuginfo tarball
function DebuginfoXDownloadHandler:get(url)
    turbo.log.debug('DebuginfoXHandler:get('..url..')')
    local targetDebuginfoX = "/usrdata/cache/debuginfoX.tar.gz"

    local file = io.open(targetDebuginfoX, "r")
    if not file then
        error(turbo.web.HTTPError(404))
    end

    self:add_header('Content-Type', 'application/gzip')
    self:write_chunked_file(file)
    file:close()
end

local DebuginfoXGenerateHandler = class("DebuginfoXGenerateHandler", SessionRequestHandler)

-- generate encrypted debuginfo tarball
function DebuginfoXGenerateHandler:post(url)
    turbo.log.debug('DebuginfoXHandler:post('..url..')')

    local result = os.execute("debuginfoX.sh")
    if result == 0 then
        self:write({ result = 0 })
    else
        error(turbo.web.HTTPError(500))
    end
end

return {
    init = function(handlers)
        table.insert(handlers, {"^/(debuginfoX)/generate$", DebuginfoXGenerateHandler})
        table.insert(handlers, {"^/(debuginfoX)/download$", DebuginfoXDownloadHandler})
    end
}
