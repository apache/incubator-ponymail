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
local config = require 'lib/config'
local utils = require 'lib/utils'

local emls_thrd

-- func that fetches all children of an original topic email thingy
local function fetchChildren(r, pdoc, c, biglist, account)
    c = (c or 0) + 1
    -- don't fetch more than 250 subtrees, we don't want to nest ad nauseam
    if c > 250 then
        return {}
    end
    -- biglist is for making sure we dont' fetch something twice
    biglist = biglist or {}
    local children = {}
    -- find any emails that reference this one
    local docs = elastic.findFast('in-reply-to:"' .. r:escape(pdoc['message-id'])..'"', 50, "mbox")
    for k, doc in pairs(docs) do
        -- if we haven't seen this email before, check for its kids and add it to the bunch
        if (not biglist[doc['message-id']]) and aaa.canAccessDoc(r, doc, account) then
            biglist[doc['message-id']] = true
            local mykids = fetchChildren(r, doc, c, biglist, account)
            if not account and config.antispam then
                doc = utils.anonymizeHdrs(doc)
            end
            local dc = {
                tid = doc.mid,
                mid = doc.mid,
                subject = doc.subject,
                from = doc.from,
                id = doc.request_id,
                epoch = doc.epoch,
                children = mykids,
                irt = doc['in-reply-to']
            }
            table.insert(children, dc)
            table.insert(emls_thrd, dc)
        else
            biglist[doc['message-id']] = true
            docs[k] = nil
        end
    end
    return children
end

function handle(r)
    cross.contentType(r, "application/json")
    local now = r:clock()
    local get = r:parseargs()
    local eid = (get.id or ""):gsub("\"", "")
    local _, doc = pcall(function() return elastic.get("mbox", eid or "hmm") end)
    emls_thrd = {}
    -- Try searching by mid if not found, for backward compat
    if not doc or not doc.mid then
        local docs = elastic.find("message-id:\"" .. r:escape(eid) .. "\"", 1, "mbox")
        if #docs == 1 then
            doc = docs[1]
        end
        if #docs == 0 and #eid == 18 then
            docs = elastic.find("mid:" .. r:escape(eid) .. "*", 1, "mbox")
        end
        if #docs == 1 then
            doc = docs[1]
        end
    end
    if get.timetravel then
        doc = utils.findParent(r, doc, elastic)
    end
    local doclist = {}
    
    -- did we find an email?
    if doc then
        local account = user.get(r)
        if doc and doc.mid and aaa.canAccessDoc(r, doc, account) then
            if not account and config.antispam then
                doc = utils.anonymizeHdrs(doc)
            end
            table.insert(emls_thrd, doc)
            doc.children = fetchChildren(r, doc, 1, nil, account)
            doc.tid = doc.mid
            doc.id = doc.request_id
            --doc.body = nil
            r:puts(JSON.encode({
                took = r:clock() - now,
                thread = doc,
                emails = emls_thrd,
            }))
            return cross.OK
        end
    end
    r:puts[[{"No such e-mail or you do not have access to it."}]]
    return cross.OK
end

cross.start(handle)