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
    if get.state and get.code and get.oauth_token then
        local result = https.request(get.oauth_token, r.args)
        local valid, json = pcall(function() return JSON.decode(result) end)
        if valid and json then
            local eml = json.email
            local fname = json.fullname
            local admin = json.isMember
            if eml and fname then
                local cookie = r:sha1(r.useragent_ip .. ':' .. (math.random(1,9999999)*os.time()) .. r:clock())
                elastic.index(r, r:sha1(eml), 'account', JSON.encode{
                    email = eml,
                    fullname = fname,
                    admin = admin,
                    cookie = cookie
                })
                r:setcookie("pony",cookie .. "==" .. eml)
                r:puts[[{"okay": true, "msg": "Logged in successfully!"}]]
            end
        else
            r:puts[[{"okay": false, "msg": "Invalid oauth response!"}]]
        end
    else
        r:puts[[{"okay": false, "msg": "No OAuth creds provided"}]]
    end
    return apache2.OK
end