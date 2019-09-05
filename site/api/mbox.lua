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
local utils = require 'lib/utils'

--[[
    Parse the source to construct a valid 'From ' line.

    e.g.
    From dev-return-648-archive-asf-public=cust-asf.ponee.io@ponymail.incubator.apache.org Fri Dec 09 2016 12:48:01 2016

    Note that the timestamp must be in the same format as unix ctime and must be in UTC
    All the fields have constant width, i.e. the day of the month is zero-padded
    (There are some existing archives that use space padding instead).

    Look for:
    Return-Path: <dev-return-648-archive-asf-public=cust-asf.ponee.io@ponymail.incubator.apache.org>
    ...
    Received: from cust-asf.ponee.io (cust-asf.ponee.io [163.172.22.183])
      by cust-asf2.ponee.io (Postfix) with ESMTP id 9B3A0200BD9
      for <archive-asf-public-internal@cust-asf2.ponee.io>; Fri,  9 Dec 2016 13:48:01 +0100 (CET)
    ...
]]--
local function getFromLine(r, source)
    local replyTo = source:match("Return%-Path: +<(.-)>")
    if not replyTo then replyTo = "MAILER-DAEMON" end

    local received = source:match("Received: +from .-; +(.-)[\r\n]")
    if not received then received = "" end
    local recd = r.date_parse_rfc(received) or 0
    local timeStamp = os.date('!%a %b %d %H:%M:%S %Y',  recd) -- ctime format in UTC

    return "From " .. replyTo .. " " .. timeStamp
end

local function writeMbox(r, docs)
    -- for each email, get the actual source of it to plop into the mbox file
    for k, v in pairs(docs.hits.hits) do
        v = v._source
        local doc = elastic.get('mbox_source', v.mid)
        if doc and doc.source then
            local checkFirst -- should we check the first line?
            if not doc.source:match('^From ') then -- only add the header if there is none
                r:puts(getFromLine(r, doc.source))
                r:puts("\n")
                checkFirst=true
            else
                checkFirst=false
            end
            
            -- pick out individual lines (including last which may not have EOL)
            -- it's tricky to add the prefix to the output unless the From is at the start of a line
            -- so it's easier to just skip the first match if necessary
            for line in doc.source:gmatch("[^\r\n]*\r?\n?") do
                -- check if 'From ' needs to be escaped
                if checkFirst and line:match("^From ") then r:puts(">") end
                checkFirst=true
                -- TODO consider whether to optionally prefix '>From ', '^>>From ' etc. 
                -- If so, just change the RE to "^>*From "
                r:write(line) -- original line
            end
            r:puts("\n")
        end
    end
end

function handle(r)
    cross.contentType(r, "application/mbox")
    local get = r:parseargs()
    if get.list and get.date then
        local lid = ("<%s>"):format(get.list:gsub("@", "."):gsub("[<>]", ""))
        local flid = get.list:gsub("[.@]", "_")
        local y, m = get.date:match("^(%d+)%-(%d+)$")
        if not (y and m) then
            cross.contentType(r, "text/plain")
            r:puts("Wrong date format given!\n")
            return cross.OK
        end
        m = tonumber(m)
        y = tonumber(y)
        local d = utils.lastDayOfMonth(y,m)
        if not d then
            cross.contentType(r, "text/plain")
            r:puts("Invalid date given!\n")
            return cross.OK
        end

        if r.headers_out then
            r.headers_out['Content-Disposition'] = ("attachment; filename=%s_%04d-%02d.mbox"):format(flid,y,m)
        end

        local DATERANGE = {
            range = {
                date = {
                    gte = ("%04d/%02d/%02d 00:00:00"):format(y,m,1),
                    lte = ("%04d/%02d/%02d 23:59:59"):format(y,m,d)
                }
            }
        }

        local LIST = {
            term = {
                list_raw = lid
            }
        }

        -- Pre-process the list to find its size and whether there are any private mails
        local squery = {
            query = {
                bool = {
                    must = {
                        DATERANGE,
                        LIST
                    }
                }
            },
            size = 0, -- no data wanted this time
            aggs = {
                privacy = {
                    terms = {
                        field = "private"
                    }
                }
            }
        }

        -- find list details
        local docs = elastic.raw(squery)
        local total_docs = docs.hits.total

        local fetchPrivate = false -- should we try to fetch private messages?
        for _, privacy in pairs(docs.aggregations.privacy.buckets) do
            -- do we have a private message?
            if privacy.key_as_string == "true" and privacy.doc_count > 0 then
                -- if so, are we allowed access?
                fetchPrivate = aaa.canAccessList(r, lid, user.get(r))
                break
            end
        end

        -- Now set up the data query
        local MUST
        if fetchPrivate then
            MUST = {
                DATERANGE,
                LIST
            }
        else -- either there are no private messages or we don't have access
            MUST = {
                DATERANGE,
                LIST,
                {
                    term = {
                        private = false
                    }
                }
            }
        end

        -- create the actual query
        local squery = {
            _source = {'mid'},
            query = {
                bool = {
                    must = MUST
                }
            },
            sort = {
                {
                    epoch = {
                        order = "asc"
                    }
                }
            },
            size = elastic.MAX_RESULT_WINDOW
        }

        if total_docs > elastic.MAX_RESULT_WINDOW then
            local docs, sid = elastic.scroll(squery)
            while docs and docs.hits and docs.hits.hits and #docs.hits.hits > 0 do -- scroll as long as we get new results
                writeMbox(r, docs)
                docs, sid = elastic.scroll(sid)
            end
            elastic.clear_scroll(sid) -- we're done with the sid, release it
        else
            local docs = elastic.raw(squery)
            writeMbox(r, docs)
        end
    else
        cross.contentType(r, "text/plain")
        r:puts("Both list and date are required!\n")
    end
    return cross.OK
end

cross.start(handle)
