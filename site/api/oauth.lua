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

function handle(r)
    r.content_type = "application/json"
    local get = r:parseargs()
    local post = r:parsebody()
    local valid, json
    local scheme = "https"
    if r.port == 80 then
        scheme = "http"
    end
    if get.mode and get.mode == "persona" then
        local result = https.request("https://verifier.login.persona.org/verify", ("assertion=%s&audience=%s://%s:%u/"):format(post.assertion, scheme, r.hostname, r.port))
        r:err(("assertion=%s&audience=%s://ponymail:443/"):format(post.assertion, scheme))
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
            local cid = json.uid or json.email
            -- Does the user exist already?
            local oaccount = user.get(r, cid)
            local usr = {}
            if oaccount then
                usr.preferences = oaccount.preferences
            else
                usr.preferences = {}
            end
            usr.fullname = fname
            usr.admin = admin
            usr.email = eml
            usr.uid = json.uid
            user.update(r, cid, usr)
            r:puts[[{"okay": true, "msg": "Logged in successfully!"}]]
        else
            r:puts[[{"okay": false, "msg": "Erroneous or missing response from backend!"}]]
        end
    else
        r:puts[[{"okay": false, "msg": "Invalid oauth response!"}]]
    end
    return cross.OK
end