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

local emls_thrd

-- func that fetches all children of an original topic email thingy
function fetchChildren(r, pdoc, c, biglist, rights)
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
        local canAccess = true
        if doc.private then
            canAccess = false
            local lid = doc.list_raw:match("<[^.]+%.(.-)>")
            local flid = doc.list_raw:match("<([^.]+%..-)>")
            for k, v in pairs(rights) do
                if v == "*" or v == lid or v == flid then
                    canAccess = true
                    break
                end
            end
        end
        
        if canAccess and (not biglist[doc['message-id']]) then
            biglist[doc['message-id']] = true
            local mykids = fetchChildren(r, doc, c, biglist, rights)
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

-- find the original topic starter
function findParent(r, doc)
    local step = 0
    -- max 50 steps up in the hierarchy
    while step < 50 do
        step = step + 1
        if not doc['in-reply-to'] then
            break
        end
        local docs = elastic.find('message-id:"' .. r:escape(doc['in-reply-to'])..'"', 1, "mbox")
        if #docs == 0 then
            break
        end
        doc = docs[1]
    end
    return doc
end


function handle(r)
    r.content_type = "application/json"
    local now = r:clock()
    local get = r:parseargs()
    local eid = (get.id or ""):gsub("\"", "")
    local _, doc = pcall(function() return elastic.get("mbox", eid or "hmm") end)
    emls_thrd = {}
    -- Try searching by mid if not found, for backward compat
    if not doc or not doc.subject then
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
        doc = findParent(r, doc)
    end
    local doclist = {}
    
    -- did we find an email=
    if doc then
        local canAccess = false
        local rights = {}
        -- if private, can we access it?
        if doc.private then
            local account = user.get(r)
            if account then
                local lid = doc.list_raw:match("<[^.]+%.(.-)>")
                local flid = doc.list_raw:match("<([^.]+%..-)>")
                rights = aaa.rights(r, account)
                for k, v in pairs(rights) do
                    if v == "*" or v == lid or v == flid then
                        canAccess = true
                        break
                    end
                end
            else
                r:puts(JSON.encode{
                    error = "You must be logged in to view this email"
                })
                return cross.OK
            end
        else
            canAccess = true
        end
        if canAccess and doc and doc.mid then
            table.insert(emls_thrd, doc)
            doc.children = fetchChildren(r, doc, 1, nil, rights)
            doc.tid = doc.mid
            doc.id = doc.request_id
            --doc.body = nil
            r:puts(JSON.encode({
                took = r:clock() - now,
                thread = doc,
                emails = emls_thrd,
            }))
        else
            r:puts(JSON.encode{
                    error = "You do not have access to view this email, sorry."
                })
            return cross.OK
        end
    else
        r:puts[[{}]]
    end
    return cross.OK
end

cross.start(handle)