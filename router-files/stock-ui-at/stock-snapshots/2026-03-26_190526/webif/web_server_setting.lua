local M = {}

function M.post(name)
    local result_code = 500
    if name == "/usrdata/cache/web_https_cert/upload.zip" then
        if os.execute("/usr/bin/install_https_cert.sh") == 0 then
            result_code = 0
        end
    end

    -- processed_message, extra_messages, ping_url, ping_delay, result_code
    return "", "", "", 0, result_code
end

return M
