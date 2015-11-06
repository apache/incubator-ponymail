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

-- This is atom.lua - the Atom feed for lists

local JSON = require 'cjson'
local elastic = require 'lib/elastic'
local user = require 'lib/user'
local aaa = require 'lib/aaa'
local config = require 'lib/config'
local cross = require 'lib/cross'


function fetchChildren(r, pdoc, c, biglist)
    c = (c or 0) + 1
    if c > 250 then
        return {}
    end
    biglist = biglist or {}
    local children = {}
    local docs = elastic.find('in-reply-to:"' .. r:escape(pdoc['message-id'])..'"', 50, "mbox")
    for k, doc in pairs(docs) do
        if not biglist[doc['message-id']] then
            biglist[doc['message-id']] = true
            local mykids = fetchChildren(r, doc, c, biglist)
            local dc = {
                private = doc.private,
                tid = doc.mid,
                mid = doc.mid,
                list_raw = doc.list_raw,
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
            docs[k] = nil
        end
    end
    return children
end


function findParent(r, doc)
    local step = 0
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
    cross.contentType(r, "application/xhtml+xml")
    local t = {}
    local now = r:clock()
    local tnow = now
    local get = r:parseargs()
    if not get.list and not get.mid then
        r:puts("<>")
        return cross.OK
    end
    local qs = "*"
    local dd = 30
    local maxresults = 40
    local account = user.get(r)
    local rights = nil
    local listid = r:escape_html(get.list or "")
    local listraw = "<" .. listid:gsub("@", ".") .. ">"
    
    local sterm = {
                    term = {
                        list_raw = listraw
                    }
                }
    
    
    local emls = {}
    
    -- Get threads from list ID?
    if get.list then
        local threads = {}
        local emails = {}
        local emails_full = {}
        local doc = elastic.raw {
            _source = {'message-id','body','from','subject','epoch','list_raw', 'private'},
            query = {
                bool = {
                    must = {
                        sterm,
                        {
                            query_string = {
                                default_field = "subject",
                                query = qs
                            }
                        }
                }}
            },
            
            sort = {
                {
                    epoch = {
                        order = "desc"
                    }
                }  
            },
            size = maxresults
        }
        local h = #doc.hits.hits
        
        -- Debug time point 7
        table.insert(t, r:clock() - tnow)
        tnow = r:clock()
        
        for k = #doc.hits.hits, 1, -1 do
            local v = doc.hits.hits[k]
            local email = v._source
            local canUse = true
            if email.private then
                if account and not rights then
                    rights = aaa.rights(r, account.credentials.uid or account.credentials.email)
                end
                canUse = false
                if account then
                    local lid = email.list_raw:match("<[^.]+%.(.-)>")
                    for k, v in pairs(rights or {}) do
                        if v == "*" or v == lid then
                            canUse = true
                            break
                        end
                    end
                end
            end
            if canUse then
                local mid = email['message-id']
                local irt = email['in-reply-to']
                email.id = v._id
                email.irt = irt
                email.references = nil
                email.to = nil
                email['in-reply-to'] = nil
                table.insert(emls, 1, email)
            end
        end
        
    -- Or get a thread?
    elseif get.mid then
        local doc = elastic.get("mbox", get.mid)
        if doc then
            local parent = findParent(r, doc)
            if parent then
                fetchChildren(r, parent)
                for k, doc in pairs(emls_thrd) do
                    local canUse = true
                    if doc.private then
                        canUse = false
                        if account and not rights then
                            rights = aaa.rights(r, account.credentials.uid or account.credentials.email)
                        end
                        if account then
                            local lid = doc.list_raw:match("<[^.]+%.(.-)>")
                            for k, v in pairs(rights or {}) do
                                if v == "*" or v == lid then
                                    canUse = true
                                    break
                                end
                            end
                        end
                    end
                    if canUse then
                        table.insert(emls, doc)
                    end
                end
            end
        end
    end
    
    -- Generate the XML
    local scheme = "https"
    if r.port == 80 then
        scheme = "http"
    end
    local hostname = ("%s://%s:%u"):format(scheme, r.hostname, r.port)
    r:puts(([[<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>%s Archives</title>
<link rel="self" href="%s/atom.lua?list=%s"/>
<link href="%s/list.html?%s"/>
<id>%s/list.html?%s</id>
    ]]):format(listid, hostname, listid, hostname, listid, hostname, listid) )
    for k, eml in pairs(emls) do
        local date = os.date("%Y-%m-%dT%H:%M:%S", eml.epoch) .. "Z"
        r:puts(([[
<entry>
<title>%s</title>
<author><name>%s</name></author>
<link rel="alternate" href="%s/thread.html/%s"/>
<id>urn:uuid:%s</id>
<updated>%s</updated>
<content type="xhtml">
<div xmlns="http://www.w3.org/1999/xhtml">
<pre>
%s
</pre>
</div>
</content>
</entry>
]]):format(r
           :escape_html(eml.subject),
           r:escape_html(eml.from),
           hostname,
           r:escape_html(eml['message-id']),
           r:escape_html(eml['message-id']),
           date,
           r:escape_html(eml.body)
           ))
    end
    r:puts[[</feed>]]
    return cross.OK
end

cross.start(handle)