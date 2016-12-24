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

-- This is oauth.lua - an oauth providing script for ponymail

local JSON = require 'cjson'
local http = require 'socket.http'
local elastic = require 'lib/elastic'
local https = require 'ssl.https'
local user = require 'lib/user'
local cross = require 'lib/cross'
local config = require 'lib/config'

function handle(r)
    cross.contentType(r, "application/json")
    local get = r:parseargs()
    local post = r:parsebody()
    local valid, json
    local scheme = "https"
    if r.port == 80 then
        scheme = "http"
    end
    
    local oauth_domain = ""
    if config.oauth_fields and config.oauth_fields[get.key] then
        for k, v in pairs(config.oauth_fields[get.key]) do
            r.args = r.args .. ("&%s=%s"):format(k,v)
        end
        if config.oauth_fields[get.key].oauth_token then
            get.oauth_token = config.oauth_fields[get.key].oauth_token
        end
    end
    
    -- Persona callback
    if get.mode and get.mode == "persona" then
        oauth_domain = "verifier.login.persona.org"
        local result = https.request("https://verifier.login.persona.org/verify", ("assertion=%s&audience=%s://%s:%u/"):format(post.assertion, scheme, r.hostname, r.port))
        valid, json = pcall(function() return JSON.decode(result) end)
        
    -- Google Auth callback
    elseif get.oauth_token and get.oauth_token:match("^https://www.google") and get.code then
        oauth_domain = "www.googleapis.com"
        local result = https.request("https://www.googleapis.com/oauth2/v4/token",
                                     ("client_secret=%s&code=%s&client_id=%s&grant_type=authorization_code&redirect_uri=%s" ):format(
                                        r:escape(config.oauth_fields.google.client_secret),
                                        r:escape(get.code),
                                        r:escape(config.oauth_fields.google.client_id),
                                        r:escape(config.oauth_fields.google.redirect_uri)
                                        ))
        valid, json = pcall(function() return JSON.decode(result) end)
        if valid and json and json.access_token then
            r:err(result)
            local ac = json.access_token
            local result = https.request("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" .. r:escape(ac))
            valid, json = pcall(function() return JSON.decode(result) end)
        else
            json = nil
            valid = false
        end
    -- GitHub Auth callback
    elseif get.oauth_token and get.key == 'github' then
        local result = https.request(get.oauth_token, r.args)
        local token = result:match("(access_token=[a-f0-9]+)")
        if token then
            local result = https.request("https://api.github.com/user/emails?" .. token)
            valid, json = pcall(function() return JSON.decode(result) end)
            if valid and json then
                json = json[1]
            end
        end
        
    -- OAuth.online callback
    elseif get.oauth_token and get.key == 'online' then
        local result = https.request("https://verify.oauth.online/token", r.args)
        valid, json = pcall(function() return JSON.decode(result) end)
        
    -- Generic callback (like ASF Oauth2)
    elseif get.state and get.code and get.oauth_token then
        oauth_domain = get.oauth_token:match("https?://(.-)/")
        local result = https.request(get.oauth_token, r.args)
        valid, json = pcall(function() return JSON.decode(result) end)

    --[[
        CAS or other internal auth mechanism though request or env headers:
        Remember to set the 'internal' field vars in config.lua to enable this, for instance:
        ...
        oauth_fields = {
            internal = {
                email = 'CAS-EMAIL',
                name = 'CAS-NAME',
                uid = 'REMOTE-USER',
                env = 'subprocess' -- use environment vars instead of request headers
            }
        },
        oauth_admin = { "localhost" },
        ...
    ]]--
    elseif get.key == 'internal' and config.oauth_fields['internal'] then
        oauth_domain = "localhost"
        local tbl = r.headers_in
        if config.oauth_fields['internal'].env and config.oauth_fields['internal'].env == 'subprocess' then
            tbl = r.subprocess_env
        end
        json = {
            email = tbl[config.oauth_fields['internal']['email'] or 0],
            name = tbl[config.oauth_fields['internal']['name'] or 0],
            uid = tbl[config.oauth_fields['internal']['uid'] or 0]
        }
        -- if httpd borks, bail!
        if json.uid == '(null)' or json.email == '(null)' then
            json = nil
        end
        -- Only use internal thing if localhost is trusted
        for k, v in pairs(config.admin_oauth or {}) do
            if r.strcmp_match(oauth_domain, v) then
                valid = true
                break
            end
        end
    end
    
    -- Did we get something useful from the backend?
    if valid and json then
        local eml = json.email
        local fname = json.fullname or json.name or json.email
        local admin = json.isMember
        
        -- If we got an email and a name, log in the user and set cookie etc
        if eml and fname then
            local cid = json.uid or json.email
            -- Does the user exist already?
            local oaccount = user.get(r, cid)
            local usr = {}
            if oaccount then
                usr.preferences = oaccount.preferences
            else
                usr.preferences = {}
            end
            usr.gauth = get.id_token
            usr.fullname = fname
            
            -- if the oauth provider can set admin status, do so if needed
            local authority = false
            for k, v in pairs(config.admin_oauth or {}) do
                if r.strcmp_match(oauth_domain, v) then
                    authority = true
                    break
                end
            end
            if authority then
                usr.admin = admin
            end
            
            usr.email = eml
            usr.uid = json.uid
            usr.oauth_used = oauth_domain
            user.update(r, cid, usr)
            r:puts[[{"okay": true, "msg": "Logged in successfully!"}]]
        
        -- didn't get email or name, bork!
        else
            r:puts[[{"okay": false, "msg": "Erroneous or missing response from backend!"}]]
        end
    -- Backend borked, let the user know
    else
        r:puts[[{"okay": false, "msg": "Invalid oauth response!"}]]
    end
    return cross.OK
end

cross.start(handle) 