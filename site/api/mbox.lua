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

-- This is mbox.lua - a script for generating mbox archives

local elastic = require 'lib/elastic'
local cross = require 'lib/cross'
local user = require 'lib/user'
local aaa = require 'lib/aaa'
require 'lib/utils'

local days = {
    31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 30, 31 
}

function leapYear(year)
    if (year % 4 == 0) then
        if (year%100 == 0)then                
            if (year %400 == 0) then                    
                return true
            end
        else                
            return true
        end
        return false
    end
end

--[[
    Parse the source to construct a valid 'From ' line.

    Look for:
    Return-Path: <dev-return-648-archive-asf-public=cust-asf.ponee.io@ponymail.incubator.apache.org>
    ...
    Received: from cust-asf.ponee.io (cust-asf.ponee.io [163.172.22.183])
      by cust-asf2.ponee.io (Postfix) with ESMTP id 9B3A0200BD9
      for <archive-asf-public-internal@cust-asf2.ponee.io>; Fri,  9 Dec 2016 13:48:01 +0100 (CET)
    ...
]]--
function getFromLine(r, source)
    local replyTo = source:match("Return%-Path: +<(.-)>")
    if not replyTo then replyTo = "MAILER-DAEMON" end

    local received = source:match("Received: +from .-; +(.-)[\r\n]")
    if not received then received = "" end
    local recd = r.date_parse_rfc(received) or 0
    local timeStamp = os.date('%c',  recd) -- ctime format

    return "From " .. replyTo .. " " .. timeStamp
end

function handle(r)
    r.content_type = "application/mbox"
    local get = r:parseargs()
    if get.list and get.date then
        local lid = ("<%s>"):format(get.list:gsub("@", "."):gsub("[<>]", ""))
        local flid = get.list:gsub("[.@]", "_")
        local month = get.date:match("(%d+%-%d+)")
        if not month then
            r.content_type = "text/plain"
            r:puts("Wrong date format given!\n")
            return cross.OK
        end
        if r.headers_out then
            r.headers_out['Content-Disposition'] = "attachment; filename=" .. flid .. "_" .. month .. ".mbox"
        end
        local y, m = month:match("(%d+)%-(%d+)")
        m = tonumber(m)
        y = tonumber(y)
        local d
        if m == 2 and leapYear(y) then
            d = 29
        else
            d = days[m]
        end
        
        -- fetch all results from the list (up to 10k results), make sure to get the 'private' element
        local docs = elastic.raw {
            _source = {'mid','private'},
            query = {
                bool = {
                    must = {
                        {
                            range = {
                                date = {
                                    gte = ("%04d/%02d/%02d 00:00:00"):format(y,m,1),
                                    lte = ("%04d/%02d/%02d 23:59:59"):format(y,m,d)
                                }
                            }
                        },
                        {
                            term = {
                                list_raw = lid
                            }
                        }
                    }
                }
            },
            sort = {
                {
                    epoch = {
                        order = "asc"
                    }
                }  
            },
            size = 10000
        }

        local account = user.get(r)
        local rights = nil
        local listAccessible = nil -- not yet initialised
        -- for each email, get the actual source of it to plop into the mbox file
        for k, v in pairs(docs.hits.hits) do
            v = v._source
            -- aaa.rights() can be expensive, so only do it once per download
            if v.private and listAccessible == nil then
                -- we are dealing with a single list here so only need to check once
                if account then
                    local rights = aaa.rights(r, account)
                    listAccessible = canAccessList(rights, lid)
                else
                    listAccessible = false
                end
            end
            if listAccessible or not v.private then
                local doc = elastic.get('mbox_source', v.mid)
                if doc and doc.source then
                    r:puts(getFromLine(r, doc.source))
                    r:puts("\n")
                    -- pick out individual lines (including last which may not have EOL)
                    for line in doc.source:gmatch("[^\r\n]*\r?\n?") do
                        -- check if 'From ' needs to be escaped
                        if line:match("^From ") then r:puts(">") end
                        -- TODO consider whether to optionally prefix '>From ', '^>>From ' etc. 
                        -- If so, just change the RE to "^>*From "
                        r:puts(line) -- original line
                    end
                    r:puts("\n")
                end
            end
        end
    else
        r.content_type = "text/plain"
        r:puts("Both list and date are required!\n")
    end
    return cross.OK
end

cross.start(handle)
