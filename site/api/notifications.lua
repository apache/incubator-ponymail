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
local cross = require 'lib/cross'

function handle(r)
    r.content_type = "application/json"
    local now = r:clock()
    local get = r:parseargs()
    
    -- make sure we're logged in
    local account = user.get(r)
    if account then
        
        -- callback from the browser when the user has viewed an email. mark it as seen.
        if get.seen then
            local mid = get.seen
            if mid and #mid > 0 then
                local doc = elastic.get("notifications", mid)
                if doc and doc.seen then
                    elastic.update("notifications", doc.request_id, { seen = 1 })
                    r:puts[[{"marked": true}]]
                    return cross.OK
                end
            end
            r:puts[[{}]]
            return cross.OK
        end
        local peml = {}
        local rights = nil
        
        -- Find all recent notification docs, up to 50 latest results
        local docs = elastic.find("recipient:\"" .. r:sha1(account.cid) .. "\"", 50, "notifications")
        for k, doc in pairs(docs) do
            local canUse = true
            -- check we have rights to view this notification (it might be from a private email we shouldn't see)
            if doc.private then
                if not rights then
                    rights = aaa.rights(r, account)
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
            -- if we can see the email, push the notif to the list
            if canUse then
                doc.id = doc['message-id']
                doc.tid = doc.id
                doc.nid = doc.request_id
                doc.irt = doc['in-reply-to']
                table.insert(peml, doc)
            end
        end
        -- spit out JSON
        r:puts(JSON.encode{
            notifications = peml
        })
    else
        r:puts[[{}]]
    end
    return cross.OK
end

cross.start(handle)