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

-- This is email.lua - a script for fetching a document (email)

local JSON = require 'cjson'
local elastic = require 'lib/elastic'
local aaa = require 'lib/aaa'
local user = require 'lib/user'

function handle(r)
    r.content_type = "application/json"
    local get = r:parseargs()
    local eid = (get.id or ""):gsub("\"", "")
    local doc = elastic.get("mbox", eid or "hmm")
    
    -- Try searching by mid if not found, for backward compat
    if not doc or not doc.subject then
        local docs = elastic.find("message-id:\"" .. r:escape(eid) .. "\"", 1, "mbox")
        if #docs == 1 then
            doc = docs[1]
        end
    end
    if doc then
        local canAccess = false
        if doc.private then
            local account = user.get(r)
            if account then
                local lid = doc.list_raw:match("<[^.]+%.(.-)>")
                for k, v in pairs(aaa.rights(r, account.credentials.uid or account.credentials.email)) do
                    if v == "*" or v == lid then
                        canAccess = true
                        break
                    end
                end
            else
                r:puts(JSON.encode{
                    error = "You must be logged in to view this email"
                })
                return apache2.OK
            end
        else
            canAccess = true
        end
        if canAccess then
            r:puts(JSON.encode(doc))
        else
            r:puts(JSON.encode{
                    error = "You do not have access to view this email, sorry."
                })
            return apache2.OK
        end
    else
        r:puts[[{}]]
    end
    return apache2.OK
end