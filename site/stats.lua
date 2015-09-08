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
local JSON = require 'cjson'
local elastic = require 'lib/elastic'

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


function showThread(r, thread)
    r:puts("<ul>")
    for k, eml in pairs(thread) do
        r:puts("<li>" .. eml.subject .. " (" .. eml.date ..") ")
        if eml.children and #eml.children > 0 then
            r:puts(": <br/>")
            showThread(r, eml.children)
        end
        r:puts("</li>")
    end
    r:puts("</ul>")
end

function handle(r)
    r.content_type = "application/json"
    local now = r:clock()
    local get = r:parseargs()
    if not get.list or not get.domain then
        r:puts("{}")
        return apache2.OK
    end
    local qs = "*"
    local dd = 30
    local maxresults = 3000
    if get.d and tonumber(get.d) and tonumber(get.d) > 0 then
        dd = tonumber(get.d)
    end
    if get.q and #get.q > 0 then
        x = {}
        local q = get.q
        for k, v in pairs({'from','subject','body'}) do
            y = {}
            for word in q:gmatch("(%S+)") do
                table.insert(y, ("(%s:\"%s\")"):format(v, r:escape_html(word) ))
            end
            table.insert(x, "(" .. table.concat(y, " AND ") .. ")")
        end
        qs = table.concat(x, " OR ")
    end
    local listraw = "<" .. get.list .. "." .. get.domain .. ">"
    local listdata = {
        name = get.list,
        domain = get.domain
    }
    
    local daterange = {gt = "now-"..dd.."d" }
    if get.s and get.e then
        local em = tonumber(get.e:match("(%d+)$"))
        local ey = tonumber(get.e:match("^(%d+)"))
        ec = days[em]
        if em == 2 and leapYear(ey) then
            ec = ec + 1
        end
        daterange = {        
            gte = get.s:gsub("%-","/").."/01 00:00:00",
            lte = get.e:gsub("%-","/").."/" .. ec .. " 23:59:59",
        }
    end
    local wc = false
    local sterm = {
                    term = {
                        list_raw = listraw
                    }
                }
    if get.list == "*" then
        wc = true
        sterm = {
                    wildcard = {
                        list = "*." .. get.domain
                    }
                }
        maxresults = 1000
    end
    if get.domain == "*" then
        wc = true
        sterm = {
                    wildcard = {
                        list = "*"
                    }
                }
        maxresults = 1000
    end
    local doc = elastic.raw {
        aggs = {
            from = {
                terms = {
                    field = "from_raw",
                    size = 100
                }
            }
        },
        
        query = {
            
            bool = {
                must = {
                    {
                        query_string = {
                            default_field = "subject",
                            query = qs
                        }
                    },
                    {
                    range = {
                        date = daterange
                    }
                }, sterm
                    
            }}
            
        }
    }
    local top10 = {}

    for x,y in pairs (doc.aggregations.from.buckets) do
        local eml = y.key:match("<(.-)>") or y.key:match("%S+@%S+") or "unknown"
        local gravatar = r:md5(eml)
        local name = y.key:match("([^<]+)%s*<.->") or y.key:match("%S+@%S+")
        name = name:gsub("\"", "")
        table.insert(top10, {
            id = y.key,
            email = eml,
            gravatar = gravatar,
            name = name,
            count = y.doc_count
        })
    end
    listdata.participants = top10
    
    -- Get years active
    local doc = elastic.raw {

        query = {
            bool = {
                must = {
                    {
                    range = {
                        date = {
                            gt = "0",
                        }
                    }
                },sterm
            }}
        },
        
        sort = {
            {
                date = {
                    order = "asc"
                }
            }  
        },
        size = 1
    }
    local firstYear = tonumber(os.date("%Y", doc.hits.hits[1] and doc.hits.hits[1]._source.epoch or os.time()))
    
    
    -- Get threads
    local threads = {}
    local emails = {}
    local emls = {}
    local doc = elastic.raw {
        _source = {'message-id','in-reply-to','to','from','subject','epoch','date','references','list_raw'},
        query = {
            bool = {
                must = {
                    {
                        query_string = {
                            default_field = "subject",
                            query = qs
                        }
                    },
                    {
                    range = {
                        date = daterange
                    }
                }, sterm
            }}
        },
        
        sort = {
            {
                date = {
                    order = "desc"
                }
            }  
        },
        size = maxresults
    }
    local h = #doc.hits.hits
    for k = #doc.hits.hits, 1, -1 do
        local v = doc.hits.hits[k]
        local email = v._source
        local mid = email['message-id']
        local irt = email['in-reply-to']
        email.id = v._id
        email.irt = irt
        emails[mid] = {
            tid = v._id,
            id = mid,
            nest = 1,
            from = email['from'],
            epoch = email['epoch'],
            date = email.date,
            subject = email['subject'],
            list = email['list_raw']:gsub("[<>]+", ""),
            children = {
                
            }
        }
        if not irt or #irt == 0 then
            irt = email.subject:gsub("^[a-zA-Z]+:%s+", "")
        end
        if not emails[irt] then
            for ref in email.references:gmatch("([^%s]+)") do
                if emails[ref] then
                    irt = ref
                    break
                end
            end
        end
        
        -- If we can't match by in-reply-to or references, match/group by subject, ignoring Re:/Fwd:/etc
        if not emails[irt] then
            irt = email.subject:gsub("^[a-zA-Z]+:%s+", "")
            while irt:match("^[a-zA-Z]+:%s+") do
                irt = irt:gsub("^[a-zA-Z]+:%s+", "")
            end
        end
        
        if emails[irt] then
            if emails[irt].nest < 20 then
                emails[mid].nest = emails[irt].nest + 1
                table.insert(emails[irt].children, emails[mid])
            end
        else
            if (#email['in-reply-to'] > 0) then
                emails[irt] = {
                    tid = v._id,
                    id = irt,
                    nest = 1,
                    epoch = email['epoch'],
                    from = email['from'],
                    subject = email['subject'],
                    list = email['list_raw']:gsub("[<>]+", ""),
                    date = email.date,
                    children = {
                        emails[mid]
                    }
                }
                emails[mid].nest = emails[irt].nest + 1
                table.insert(threads, emails[irt])
            else
                table.insert(threads, emails[mid])
            end
        end
        table.insert(emls, email)
    end
    
    
    JSON.encode_max_depth(500)
    listdata.max = maxresults
    listdata.using_wc = wc
    listdata.no_threads = #threads
    listdata.thread_struct = threads
    listdata.firstYear = firstYear
    listdata.list = listraw:gsub("^([^.]+)%.", "%1@"):gsub("[<>]+", "")
    listdata.emails = emls
    listdata.hits = h
    listdata.searchlist = listraw
    listdata.took = r:clock() - now
    r:puts(JSON.encode(listdata))
    
    return apache2.OK
end