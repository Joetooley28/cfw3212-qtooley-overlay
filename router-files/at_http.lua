local socket = require("socket")
local JSON = require("JSON")

local validate = require("at_validate")
local at_lock = require("at_lock")
local backend = require("at_backend")

math.randomseed(os.time())

local STATIC_FILES = {
    ["/"] = { path = "index.html", content_type = "text/html; charset=utf-8" },
    ["/index.html"] = { path = "index.html", content_type = "text/html; charset=utf-8" },
    ["/app.js"] = { path = "app.js", content_type = "application/javascript; charset=utf-8" },
    ["/app.css"] = { path = "app.css", content_type = "text/css; charset=utf-8" }
}

local function json_encode(obj)
    if type(JSON.encode) == "function" then
        return JSON:encode(obj)
    end
    error("JSON encode function not available")
end

local function json_decode_file(path)
    local f, err = io.open(path, "rb")
    if not f then
        error("failed_to_open_config: " .. tostring(err))
    end
    local raw = f:read("*a")
    f:close()

    if type(JSON.decode) == "function" then
        return JSON:decode(raw)
    end
    error("JSON decode function not available")
end

local function read_file(path)
    local f, err = io.open(path, "rb")
    if not f then
        return nil, err
    end
    local raw = f:read("*a") or ""
    f:close()
    return raw, nil
end

local function log(level, msg)
    local line = string.format("[at-http] [%s] %s", level, msg)
    io.stderr:write(line .. "\n")
    io.stderr:flush()
end

local function send_body(client, status_code, content_type, body)
    local status_text = ({
        [200] = "OK",
        [400] = "Bad Request",
        [404] = "Not Found",
        [405] = "Method Not Allowed",
        [409] = "Conflict",
        [413] = "Payload Too Large",
        [415] = "Unsupported Media Type",
        [500] = "Internal Server Error",
        [502] = "Bad Gateway",
        [504] = "Gateway Timeout"
    })[status_code] or "OK"

    local response = table.concat({
        "HTTP/1.1 " .. status_code .. " " .. status_text,
        "Content-Type: " .. content_type,
        "Content-Length: " .. #body,
        "Connection: close",
        "",
        body
    }, "\r\n")

    client:send(response)
end

local function send_response(client, status_code, payload)
    send_body(client, status_code, "application/json", json_encode(payload))
end

local function recv_line(client)
    local line, err = client:receive("*l")
    if not line then
        return nil, err
    end
    return line
end

local function parse_request(client, max_body_bytes)
    local request_line, err = recv_line(client)
    if not request_line then
        return nil, "bad_request_line:" .. tostring(err)
    end

    local method, path = request_line:match("^([A-Z]+)%s+([^%s]+)%s+HTTP/%d%.%d$")
    if not method or not path then
        return nil, "bad_request_line"
    end

    local headers = {}
    while true do
        local line, line_err = recv_line(client)
        if not line then
            return nil, "bad_headers:" .. tostring(line_err)
        end
        if line == "" then
            break
        end
        local k, v = line:match("^([^:]+):%s*(.*)$")
        if k then
            headers[k:lower()] = v
        end
    end

    local content_length = tonumber(headers["content-length"] or "0")
    if content_length < 0 then
        return nil, "bad_content_length"
    end
    if content_length > max_body_bytes then
        return nil, "body_too_large"
    end

    local body = ""
    if content_length > 0 then
        local chunk, body_err = client:receive(content_length)
        if not chunk then
            return nil, "bad_body:" .. tostring(body_err)
        end
        body = chunk
    end

    return {
        method = method,
        path = path,
        headers = headers,
        body = body
    }, nil
end

local function serve_static(req, client)
    local static = STATIC_FILES[req.path]
    if not static then
        return false
    end

    local body, err = read_file(static.path)
    if not body then
        log("error", "static_read_failed:" .. tostring(static.path) .. ":" .. tostring(err))
        send_response(client, 500, { ok = false, error = "static_read_failed" })
        return true
    end

    send_body(client, 200, static.content_type, body)
    return true
end

local function handle_post_at(config, req)
    local content_type = (req.headers["content-type"] or ""):lower()
    if not content_type:find("application/json", 1, true) then
        return 415, { ok = false, error = "unsupported_media_type" }
    end

    local payload, decode_err = validate.decode_request(JSON, req.body)
    if not payload then
        return 400, { ok = false, error = decode_err }
    end

    local command, cmd_err = validate.validate_command(config, payload)
    if not command then
        return 400, { ok = false, error = cmd_err }
    end

    local fd, lock_err = at_lock.acquire(config.lock_path)
    if not fd then
        return 409, { ok = false, error = lock_err }
    end

    local ok, result = pcall(backend.run_transaction, config, command)
    at_lock.release(fd)

    if not ok then
        log("error", "backend_exception:" .. tostring(result))
        return 502, { ok = false, error = "backend_internal_error" }
    end

    if not result.ok and result.error then
        if result.error == "at_channel_busy" then
            return 409, result
        end
        return 502, result
    end

    if result.timed_out then
        result.ok = false
        result.error = "timeout"
        return 504, result
    end

    if result.truncated then
        result.ok = false
        result.error = "response_too_large"
        return 413, result
    end

    return 200, result
end

local function handle_client(config, client)
    client:settimeout(5)

    local req, req_err = parse_request(client, config.max_body_bytes or 512)
    if not req then
        log("warn", "request_parse_failed:" .. tostring(req_err))
        send_response(client, 400, { ok = false, error = "bad_request" })
        return
    end

    if req.method == "GET" then
        if serve_static(req, client) then
            return
        end
        send_response(client, 404, { ok = false, error = "not_found" })
        return
    end

    if req.path ~= "/at" then
        send_response(client, 404, { ok = false, error = "not_found" })
        return
    end

    if req.method ~= "POST" then
        send_response(client, 405, { ok = false, error = "method_not_allowed" })
        return
    end

    local status, payload = handle_post_at(config, req)
    send_response(client, status, payload)
end

local function main()
    local config_path = arg[1] or "/usrdata/at-http/config.json"
    local config = json_decode_file(config_path)

    if not config.backend_mode or config.backend_mode == "" then
        config.backend_mode = "smd7_direct"
    end

    local server, err = socket.bind(config.bind_address or "127.0.0.1", tonumber(config.port or 8088))
    if not server then
        error("bind_failed: " .. tostring(err))
    end

    server:settimeout(1)

    log("info", string.format(
        "listening on %s:%d backend_mode=%s",
        config.bind_address or "127.0.0.1",
        tonumber(config.port or 8088),
        config.backend_mode
    ))

    while true do
        local client = server:accept()
        if client then
            local ok, handle_err = pcall(handle_client, config, client)
            if not ok then
                log("error", "handler_exception:" .. tostring(handle_err))
                pcall(send_response, client, 500, { ok = false, error = "internal_error" })
            end
            client:close()
        end
    end
end

main()
