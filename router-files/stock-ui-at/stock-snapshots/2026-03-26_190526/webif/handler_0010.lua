--[[
    A handler module to process server certificate requests

    Copyright (C) 2020 Casa Systems Inc.
--]]
require("lfs")
local luardb = require("luardb")
local turbo = require("turbo")
local SessionRequestHandler = require("session_handler")

local function runKeyGenCmd(cmd)
    local res = shellExecute(cmd, false)
    if #res > 0 then
        return 0, res
    else
        return 1, "error"
    end
end

local ServerCertiInfoHandler = class("ServerCertiInfoHandler", turbo.web.RequestHandler)

-- get server certificate information
function ServerCertiInfoHandler:get(url)
    turbo.log.debug('ServerCertiInfoHandler:get('..url..')')

    local cmd = string.format("ca_keygen.sh info")
    local result, messages = runKeyGenCmd(cmd)

    --[[ certificate information example
        # ca_keygen.sh.sh info
        server_certificate = "AU,NSW,Lane Cove,Casa Systems,,Kwonhee.Han@Casa-systems.com/Dec 11 20:37:22 2020 GMT,Dec 9 20:37:22 2030 GMT/";
        server_certificate_serial_no = "51A48E2B3013B93A114C9C7A13D2B4E138E78EB9";
        server_secret_time = "";
    ]]--

    if result == 0 then
        local response = { result = 0 }
        local msg = string.explode(messages, "\n")
        for _, v in ipairs(msg) do
            if string.find(v, '=') then
                v = string.gsub(v, "^\n", "")
                local idx, val = string.match(v, "([^%s]+)%s*=%s*(.+)")
                if idx and val then
		            val = string.gsub(val, ";$", "")
                    val = string.gsub(string.gsub(val, "^\"", ""), "\"$", "")
                    response[idx] = val
                end
            end
        end
        self:write(response)
    else
        error(turbo.web.HTTPError(500))
    end
end

local ServerCertiGenHandler = class("ServerCertiGenHandler", SessionRequestHandler)

-- generate server certificate
function ServerCertiGenHandler:post(url)
    turbo.log.debug('ServerCertiGenHandler:post('..url..')')

    -- Should call os.execute rather than other server functions in order to
    -- send the response back as soon as possible and keep running time-consuming
    -- process in background
    local result = os.execute("ca_keygen.sh ca")
    luardb.set("service.webserver.use_default_https_cert", 0)
    if result == 0 then
        self:write({ result = 0 })
    else
        error(turbo.web.HTTPError(500))
    end
end

return {
    init = function(handlers)
        table.insert(handlers, {"^/(genServerCerti)/info$", ServerCertiInfoHandler})
        table.insert(handlers, {"^/(genServerCerti)/gen_ca$", ServerCertiGenHandler})
    end
}
