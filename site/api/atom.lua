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
local cross = require 'lib/cross'

require 'lib/utils'

local emls_thrd

-- func for fetching all child emails of a parent topic
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
            table.insert(emls_thrd, doc)
        else
            docs[k] = nil
        end
    end
    return children
end

function handle(r)
    cross.contentType(r, "application/xhtml+xml")
    local t = {}
    local now = r:clock()
    local tnow = now
    local get = r:parseargs()

    -- make sure we have a list or a thread to display results from
    if not get.list and not get.mid then
        r:puts("<>")
        return cross.OK
    end

    -- default to any subject/body, 30 day view
    -- but accept whatever the browser demands
    local qs = "*"
    local dd = 30
    local maxresults = 40
    local account = user.get(r)
    local rights = nil
    local listid = r:escape_html(get.list or "")
    local listraw = "<" .. listid:gsub("@", ".") .. ">"

    -- search terms for ES
    local sterm = {
                    term = {
                        list_raw = listraw
                    }
                }

    local emls = {}
    emls_thrd = {}

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
                        },
                        {
                            range = {
                                date = {
                                    gt = "now-1M"
                                }
                            }
                        }
                    }
                }
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

        -- for each email found, check if we can access it and then digest it if so
        for k = #doc.hits.hits, 1, -1 do
            local v = doc.hits.hits[k]
            local email = v._source
            local canUse = true
            if email.private then
                if account and not rights then
                    rights = aaa.rights(r, account)
                end
                canUse = false
                if account then
                    local lid = email.list_raw:match("<[^.]+%.(.-)>")
                    local flid = email.list_raw:match("<([^.]+%..-)>")
                    for k, v in pairs(rights or {}) do
                        if v == "*" or v == lid or v == flid then
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
        -- get the parent email
        local doc = elastic.get("mbox", get.mid)
        if doc then
            -- make sure we have the real parent
            local parent = findParent(r, doc, elastic)

            -- we got the original email, now let's find and process all kids
            if parent then
                table.insert(emls_thrd, parent)
                fetchChildren(r, parent)
                -- ensure access and process all children
                for k, doc in pairs(emls_thrd) do
                    local canUse = true
                    if doc.private then
                        canUse = false
                        if account and not rights then
                            rights = aaa.rights(r, account)
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
           r:escape_html(eml.body:gsub("\x0F", ""))
           ))
    end
    r:puts[[</feed>]]
    return cross.OK
end

cross.start(handle)