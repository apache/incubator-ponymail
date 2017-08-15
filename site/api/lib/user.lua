--[[
 Licensed to the Apache Software Foundation (ASF) under one or more
 contributor license agreements.  See the NOTICE file distributed with
 this work for additional information regarding copyright ownership.
 The ASF licenses this file to You under the Apache License, Version 2.0
 (the "License"); you may not use this file except in compliance with
 the License.  You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
]]--

local elastic = require 'lib/elastic'
local config = require 'lib/config'
local JSON = require 'cjson'

-- allow local override of secure cookie attribute
-- Note: the config item is named to make it more obvious that enabling it is not recommended
-- This makes the expression below a bit more complicated
local SECURE = not(config.allow_insecure_cookie or false)

-- Get user data from DB
local function getUser(r, override)
    local ocookie = r:getcookie("ponymail")
    local login = {}
    if override or (ocookie and #ocookie > 43) then
        local cookie, cid = r:unescape(ocookie or ""):match("([a-f0-9]+)==(.+)")
        if override or (cookie and #cookie >= 40 and cid) then
            local js = elastic.get('account', r:sha1(override or cid), true)
            if js and js.credentials and (override or (cookie == js.internal.cookie)) then
                
                login = {
                    credentials = {
                        email = js.credentials.email,
                        fullname = js.credentials.fullname,
                        uid = js.credentials.uid,
                        altemail = js.credentials.altemail
                    },                    
                    cid = cid,
                    internal = {
                        cookie = cookie,
                        admin = js.internal.admin,
                        oauth_used = js.internal.oauth_used,
                        ip = r.useragent_ip
                    },
                    preferences = js.preferences,
                    favorites = js.favorites
                }
                return login
            end
        end
    end
    return nil
end

-- Update or set up a new user
local function updateUser(r, cid, data)
    local cookie = r:sha1(r.useragent_ip .. ':' .. (math.random(1,9999999)*os.time()) .. r:clock())
    
    -- Does this account exists? If so, grab the prefs first
    local prefs = nil
    local favs = nil
    local oaccount = getUser(r, cid)
    if oaccount and oaccount.preferences then
        prefs = oaccount.preferences
        favs = oaccount.favorites
    end
    elastic.index(r:sha1(cid), 'account', {
        credentials = {
            uid = data.uid,
            email = data.email,
            fullname = data.fullname,
            altemail = data.altemail or (oaccount and oaccount.credentials.altemail) or {}
        },
        internal = {
            admin = data.admin,
            cookie = cookie,
            oauth_used = data.oauth_used,
            ip = r.useragent_ip
        },
        cid = cid,
        preferences = prefs,
        favorites = favs
    })
    r:setcookie{
        key = "ponymail",
        value = cookie .. "==" .. (cid),
        secure = SECURE,
        httponly = true,
        path = "/"
    }
end


-- Log out a user
local function logoutUser(r, usr)
    if usr and usr.cid then
        local js = elastic.get('account', r:sha1(usr.cid))
        js.internal.cookie = 'nil'
        elastic.index(r:sha1(usr.cid), 'account', js)
    end
    r:setcookie{
        key = "ponymail",
        value = "-----",
        path = "/"
    }
end


-- Save preferences
local function savePreferences(r, usr, alts)
    if usr and usr.cid then
        local js = elastic.get('account', r:sha1(usr.cid))
        js.preferences = usr.preferences
        if alts then
            js.credentials.altemail = usr.credentials.altemail
        end
        elastic.index(r:sha1(usr.cid), 'account', js)
    end
end

-- Save favorites
local function saveFavorites(r, usr)
    if usr and usr.cid then
        local js = elastic.get('account', r:sha1(usr.cid))
        js.favorites = usr.favorites
        elastic.index(r:sha1(usr.cid), 'account', js)
    end
end

return {
    get = getUser,
    logout = logoutUser,
    save = savePreferences,
    update = updateUser,
    favs = saveFavorites
}