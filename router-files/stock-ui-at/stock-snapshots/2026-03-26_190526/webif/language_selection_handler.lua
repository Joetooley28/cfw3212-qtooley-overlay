--[[
    Handling language selection

    Copyright (C) 2022 Casa Systems Inc.
--]]

local turbo = require("turbo")
require('luardb')
require("stringutil")

local supported_languages = require("supported_languages")

local DEFAULT_LANG_RDB = "service.webui.language"
local DEFAULT_LANGUAGE = "en"
local num_langs = 0
for lang, _ in pairs(supported_languages) do
    num_langs = num_langs + 1
    if num_langs == 1 then
        DEFAULT_LANGUAGE = lang
    end
end

local LanguageSelectionHandler = class("LanguageSelectorHandler", turbo.web.RequestHandler)

local function set_language_cookie(reqHandler, language)
    reqHandler:set_cookie("language", language, "/", -1, 60*60*24*365, false, true, "strict")
end

function LanguageSelectionHandler:post()
    local csrf_session = getCsrfSession()
    csrf_session.prepareSession(self)
    assertValidCsrfToken(self, self:get_argument("csrfToken", ""))
    csrf_session.updateSession(self)
    local language = self:get_argument("language")
    if not supported_languages[language] then
        error(turbo.web.HTTPError(400))
    end
    set_language_cookie(self, language)
end

local function select_language(reqHandler)
    if num_langs <= 1 then
        return DEFAULT_LANGUAGE
    end

    local language = reqHandler:get_cookie("language")
    if type(language) == "string" and supported_languages[language] then
        -- consider to save to user profile
        if reqHandler.session.user then
            local user_lang_rdb = "admin.user."..reqHandler.session.user..".language"
            local saved_language = luardb.get(user_lang_rdb)
            if saved_language ~= language then
                luardb.set(user_lang_rdb, language, "p")
                -- save as default language if there is one account
                local accounts_data = luardb.get("admin.user.accounts")
                local accounts = type(accounts_data) == "string" and accounts_data:explode(',') or {}
                if #accounts == 1 then
                    luardb.set(DEFAULT_LANG_RDB, language, "p")
                end
            end
        end
        set_language_cookie(reqHandler, language)
        return language
    end

    -- no language from cookie, consider user profile or default language
    if reqHandler.session.user then
        local user_lang_rdb = "admin.user."..reqHandler.session.user..".language"
        language = luardb.get(user_lang_rdb)
    end
    if not language then
        language = luardb.get(DEFAULT_LANG_RDB)
    end
    if language then
        return language
    end

    -- otherwise, consider Accept-Language header
    local agent_langs = reqHandler.request.headers:get("Accept-Language", true)
    if type(agent_langs) == "string" then
        local agent_langs_list = agent_langs:explode(",")
        for _, lang in pairs(agent_langs_list) do
            lang = lang:match("[%w%-]+")
            if supported_languages[lang] then
                return lang
            end
        end
    end

    return DEFAULT_LANGUAGE
end

return {
    ReqHandler = LanguageSelectionHandler,
    select_language = select_language
}
