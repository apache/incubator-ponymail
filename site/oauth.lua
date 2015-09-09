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
local JSON = require 'cjson'
local http = require 'socket.http'
local elastic = require 'lib/elastic'
local https = require 'ssl.https'


function handle(r)
    r.content_type = "application/json"
    local get = r:parseargs()
    local post = r:parsebody()
    local valid, json
    if get.mode and get.mode == "persona" then
        local result = https.request("https://verifier.login.persona.org/verify", ("assertion=%s&audience=https://%s:%u/"):format(post.assertion, r.hostname, r.port))
        r:err(("assertion=%s&audience=https://ponymail:443/"):format(post.assertion))
        r:err(result)
        valid, json = pcall(function() return JSON.decode(result) end)
        
    end
    if get.state and get.code and get.oauth_token then
        local result = https.request(get.oauth_token, r.args)
        valid, json = pcall(function() return JSON.decode(result) end)
    end
    if valid and json then
        local eml = json.email
        local fname = json.fullname or json.email
        local admin = json.isMember
        if eml and fname then
            local uid = json.uid
            local cookie = r:sha1(r.useragent_ip .. ':' .. (math.random(1,9999999)*os.time()) .. r:clock())
            
            -- Does this account exists? If so, grab the prefs first
            local prefs = nil
            local odoc = elastic.get('account', r:sha1(uid or eml))
            if odoc and odoc.preferences then
                prefs = odoc.preferences
            end
            elastic.index(r, r:sha1(uid or eml), 'account', JSON.encode{
                uid = uid,
                email = eml,
                fullname = fname,
                admin = admin,
                cookie = cookie,
                preferences = prefs
            })
            r:setcookie("pony",cookie .. "==" .. (uid or eml))
            r:puts[[{"okay": true, "msg": "Logged in successfully!"}]]
        else
            r:puts[[{"okay": false, "msg": "Erroneous or missing response from backend!"}]]
        end
    else
        r:puts[[{"okay": false, "msg": "Invalid oauth response!"}]]
    end
    return apache2.OK
end