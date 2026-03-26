--[[
    Copyright (C) 2022 Casa Systems Inc.
--]]

require('srvrUtils')
local turbo = require("turbo")

local SessionRequestHandler = class("SessionRequestHandler", turbo.web.RequestHandler)

function SessionRequestHandler:getUrl(url)
    return url
end

function SessionRequestHandler:getCsrfToken()
    return self:get_argument("csrfToken", "")
end

function SessionRequestHandler:prepare()
    local csrf_session = getCsrfSession()
    csrf_session.prepareSession(self)
    csrf_session.updateSession(self)

    local url = self:getUrl(unpack(self._url_args))
    local method = self.request.method:lower()

    assertValidUrl(url)
    if needsAuthentication(url) then
        assertValidLogin(self)
        assertValidGroup(self, url, method)
    end

    if method ~= "get" and method ~= "head" and method ~= "options" then
        assertValidCsrfToken(self, self:getCsrfToken())
    end
end

return SessionRequestHandler
