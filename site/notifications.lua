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

-- This is thread.lua - a script for fetching a thread based on a message
-- that is in said thread.

local JSON = require 'cjson'
local elastic = require 'lib/elastic'
local aaa = require 'lib/aaa'
local user = require 'lib/user'

function handle(r)
    r.content_type = "application/json"
    local now = r:clock()
    local get = r:parseargs()
    local account = user.get(r)
    if account then
        local peml = {}
        local rights = nil
        if not doc or not doc.subject then
            local docs = elastic.find("recipient:\"" .. r:sha1(account.cid) .. "\"", 50, "notifications")
            for k, doc in pairs(docs) do
                local canUse = true
                if doc.private then
                    if not rights then
                        rights = aaa.rights(r, account.credentials.uid or account.credentials.email)
                    end
                    canUse = false
                    if account then
                        local lid = doc.list:match("<[^.]+%.(.-)>")
                        for k, v in pairs(rights or {}) do
                            if v == "*" or v == lid then
                                canUse = true
                                break
                            end
                        end
                    end
                end
                if canUse then
                    doc.id = doc['message-id']
                    doc.tid = doc.id
                    table.insert(peml, doc)
                end
            end
            r:puts(JSON.encode{
                notifications = peml
            })
        end
    else
        r:puts[[{}]]
    end
    return apache2.OK
end