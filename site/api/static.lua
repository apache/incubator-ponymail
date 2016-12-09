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

-- This is stats.lua - the main stats/ML rendering script for the web.

local JSON = require 'cjson'
local elastic = require 'lib/elastic'
local user = require 'lib/user'
local aaa = require 'lib/aaa'
local config = require 'lib/config'
local cross = require 'lib/cross'

local days = {
    31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 30, 31 
}

function sortEmail(thread)
    if thread.children and type(thread.children) == "table" then
        table.sort (thread.children, function (k1, k2) return k1.epoch > k2.epoch end )
        for k, v in pairs(thread.children) do
            sortEmail(v)
        end
    end
end

function showThreads(r, thread, emails)
    r:puts("<ul>\n")
    for k, v in pairs(thread.children) do
        local email = nil
        for x,y in pairs(emails) do
            if y['message-id'] == v.mid then
                email = y
                break
            end
        end
        if email then
            local from = r:escape_html(email.from:gsub("(%S+@)", function(a) return a:sub(1,3) .. "...@" end))
            r:puts(([[<li><a href="/thread.html/%s">%s</a> - %s<br/><blockquote>%s</blockquote>]]):format(email['message-id'], email.subject, from, r:escape_html(v.body or "")) )
            showThreads(r, v, emails)
            r:puts("</li>")
        end
    end
    r:puts("</ul>\n")    
end

function handle(r)
    cross.contentType(r, "text/html")
    local t = {}
    local now = r:clock()
    local tnow = now
    local get = r:parseargs()
    local pinfo = r.path_info:gsub("^/", "")
    
    r:puts[[<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    </head>
    <body>
    ]]
    -- List view
    if pinfo:match("^/?([^@]+)@([^@]+)$") then
        local listid = pinfo:match("^/?([^@]+@[^@]+)$"):gsub("@", ".")
        r:puts("<h2>" .. r:escape_html(listid) .. " list archive, last 30 days</h2>\
               <p style='color:#963; font-size: 125%;'>You are viewing the static version of this archive.<br/> \
               For the interactive version, please visit: <a href='/list.html?" .. pinfo:gsub("[<>]", "") .. "'>This page</a></p>")
        local threads = {}
        local emails = {}
        local emails_full = {}
        local emls = {}
        local senders = {}
        local doc = elastic.raw {
            _source = {'message-id','in-reply-to','from','subject','epoch','references','list_raw', 'private', 'attachments', 'body'},
            query = {
                bool = {
                    must = {
                        {
                            range = {
                                date = {
                                    gte = "now-30d"
                                }
                            }
                        },
                        {
                            term = {
                                list_raw = ("<%s>"):format(listid)
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
            size = 1000
        }
        local h = #doc.hits.hits
        table.sort (doc.hits.hits, function (k1, k2) return k1._source.epoch > k2._source.epoch end )
        
        for k = #doc.hits.hits, 1, -1 do
            local v = doc.hits.hits[k]
            local email = v._source
            local canUse = true
            if email.private then
                canUse = false
            end
            if canUse then
                local mid = email['message-id']
                local irt = email['in-reply-to']
                email.id = v._id
                email.irt = irt
                emails[mid] = {
                    tid = v._id,
                    mid = mid,
                    nest = 1,
                    epoch = email.epoch,
                    children = {
                        
                    }
                }
                
                if not irt or irt == JSON.null or #irt == 0 then
                    irt = ""
                end
                if not emails[irt] and email.references and email.references ~= JSON.null then
                    for ref in email.references:gmatch("([^%s]+)") do
                        if emails[ref] then
                            irt = ref
                            break
                        end
                    end
                end
                
                if not irt or irt == JSON.null or #irt == 0 then
                    irt = email.subject:gsub("^[a-zA-Z]+:%s+", "")
                end
                
                -- If we can't match by in-reply-to or references, match/group by subject, ignoring Re:/Fwd:/etc
                if not emails[irt] then
                    irt = email.subject:gsub("^[a-zA-Z]+:%s+", "")
                    while irt:match("^[a-zA-Z]+:%s+") do
                        irt = irt:gsub("^[a-zA-Z]+:%s+", "")
                    end
                end
                if emails[irt] then
                    if emails[irt].nest < 50 then
                        emails[mid].nest = emails[irt].nest + 1
                        table.insert(emails[irt].children, emails[mid])
                    end
                else
                    if (email['in-reply-to'] ~= JSON.null and #email['in-reply-to'] > 0) then
                        emails[irt] = {
                            children = {
                                emails[mid]
                            },
                            nest = 1,
                            epoch = email.epoch,
                            mid = irt,
                            tid = v._id
                        }
                        emails[mid].nest = emails[irt].nest + 1
                        table.insert(threads, emails[irt])
                    else
                        table.insert(threads, emails[mid])
                    end
                    threads[#threads].body = #email.body < 300 and email.body or email.body:sub(1,300) .. "..."
                end
                email.references = nil
                email.to = nil
                email['in-reply-to'] = nil
                if email.attachments then
                    email.attachments = #email.attachments
                else
                    email.attachments = 0
                end
                email.body = nil
                table.insert(emls, email)
            end
        end
        showThreads(r, {children = threads }, emls)
    -- Domain view
    elseif pinfo:match("^/?([^@]+)$") then
        local adomain = pinfo:match("^/?([^@]+)$")
        local dd = 90
        local daterange = {gt = "now-"..dd.."d" }
        local doc = elastic.raw {
            size = 0, -- we don't need the hits themselves
            aggs = {
                from = {
                    terms = {
                        field = "list_raw",
                        size = 500000
                    }
                }
            },
            query = {
                range = {
                        date = daterange
                    }
            }
        }
        local lists = {}
        
        for x,y in pairs (doc.aggregations.from.buckets) do
            local list, domain = y.key:match("<(%S-)%.(.-)>")
            if domain and (domain:lower() == adomain:lower()) then
                lists[list] = y.doc_count
            end
        end
        local a = 0
        for k, v in pairs(lists) do
            a = a + 1
            r:puts(([[<a href="/api/static.lua/%s@%s">%s@%s list: %u new emails</a><br/>]]):format(k, adomain, k, adomain, v))
        end
        if a == 0 then
            r:puts("Hm, no activity found on any list matching this domain")
        end
    -- Email view
    elseif pinfo:match("^/?<.+>$") then
        
    -- ??? just list domains here
    else
        local dd = 90
        local daterange = {gt = "now-"..dd.."d" }
        local doc = elastic.raw {
            size = 0, -- we don't need the hits themselves
            aggs = {
                from = {
                    terms = {
                        field = "list_raw",
                        size = 500000
                    }
                }
            },
            query = {
                range = {
                        date = daterange
                    }
            }
        }
        local lists = {}
        
        for x,y in pairs (doc.aggregations.from.buckets) do
            local list, domain = y.key:match("<(%S-)%.(.-)>")
            if domain then
                lists[domain] = (lists[domain] or 0) + y.doc_count
            end
        end
        local a = 0
        for k, v in pairs(lists) do
            a = a + 1
            r:puts(([[<a href="/api/static.lua/%s">%s lists: %u new emails here.</a><br/>]]):format(k, k, v))
        end
        if a == 0 then
            r:puts("Hm, no activity found on any list matching any domains")
        end
    end
    r:puts("</body></html>")
    return cross.OK
end

cross.start(handle)
