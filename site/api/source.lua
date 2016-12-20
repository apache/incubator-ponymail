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

-- This is source.lua - a script for displaying the source of an email

local elastic = require 'lib/elastic'
local aaa = require 'lib/aaa'
local user = require 'lib/user'
local cross = require 'lib/cross'
local utils = require 'lib/utils'

function handle(r)
    cross.contentType(r, "text/plain")
    local get = r:parseargs()
    local eid = (get.id or r.path_info):gsub("\"", ""):gsub("/", "")
    local doc = elastic.get("mbox", eid or "hmm", true)
    
    -- Try searching by mid if not found, for backward compat
    if not doc or not doc.mid then
        local docs = elastic.find("message-id:\"" .. r:escape(eid) .. "\"", 1, "mbox")
        if #docs == 1 then
            doc = docs[1]
        end
    end
    if doc and doc.mid then
        local account = user.get(r)
        if aaa.canAccessDoc(r, doc, account) then
            local doc_raw = elastic.get('mbox_source', doc.request_id)
            if doc_raw then
                r:puts(doc_raw.source)
            else
                r:puts("Could not find the email source, sorry!")
            end
            return cross.OK
        end
    end
    r:puts[[No such email, or you don't have access. Sorry!]]
    return cross.OK
end

cross.start(handle)