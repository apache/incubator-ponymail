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


function handle(r)
    r.content_type = "application/json"
    local t = {}
    local now = r:clock()
    local tnow = now
    local get = r:parseargs()
    if not get.list or not get.domain then
        r:puts("{}")
        return apache2.OK
    end
    local qs = "*"
    local dd = 30
    local maxresults = 5000
    local account = user.get(r)
    local rights = nil
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
    
    -- Debug time point 1
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
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
    
    -- Debug time point 2
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
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
                        range = {
                            date = daterange
                        }
                    },
                    {
                        query_string = {
                            default_field = "subject",
                            query = qs
                        }
                    },
                    sterm
                    
            }}
            
        }
    }
    local top10 = {}

    -- Debug time point 3
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
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
    
    
    -- Debug time point 4
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    local cloud = nil
    if config.wordcloud then
        cloud = {}
        -- Word cloud!
        local doc = elastic.raw {
            aggregations = {
            cloud = {
                significant_terms =  {
                    field =  "subject",
                    size = 10,
                    chi_square = {}
                }
            }
        },
            
            query = {
                
                bool = {
                    must = {
                        {
                            range = {
                                date = daterange
                            }
                        }, 
                        {
                            query_string = {
                                default_field = "subject",
                                query = qs
                            }
                        },
                        sterm, {
                            term = {
                                private = false
                            }
                        }
                        
                }}
                
            }
        }
        
        for x,y in pairs (doc.aggregations.cloud.buckets) do
            cloud[y.key] = y.doc_count
        end
    end
    -- Debug time point 4
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    -- Get years active
    local nowish = math.floor(os.time()/600)
    local firstYear = r:ivm_get("firstYear:" .. nowish .. ":" ..get.list .. "@" .. get.domain)
    if not firstYear or firstYear == "" then
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
        firstYear = tonumber(os.date("%Y", doc.hits.hits[1] and doc.hits.hits[1]._source.epoch or os.time()))
        r:ivm_set("firstYear:" .. nowish .. ":" .. get.list .. "@" .. get.domain, firstYear)
    end
    
    -- Get years active
    local lastYear = r:ivm_get("lastYear:" .. nowish .. ":" ..get.list .. "@" .. get.domain)
    if not lastYear or lastYear == "" then
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
                        order = "desc"
                    }
                }  
            },
            size = 1
        }
        lastYear = tonumber(os.date("%Y", doc.hits.hits[1] and doc.hits.hits[1]._source.epoch or os.time()))
        r:ivm_set("lastYear:"  .. nowish .. ":" ..get.list .. "@" .. get.domain, lastYear)
    end
    
    
    -- Debug time point 5
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    -- Get threads
    local threads = {}
    local emails = {}
    local emails_full = {}
    local emls = {}
    local doc = elastic.raw {
        _source = {'message-id','in-reply-to','from','subject','epoch','references','list_raw', 'private'},
        query = {
            bool = {
                must = {
                    {
                        range = {
                            date = daterange
                        }
                    },
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
                date = {
                    order = "desc"
                }
            }  
        },
        size = maxresults
    }
    local h = #doc.hits.hits
    
    -- Debug time point 6
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    for k = #doc.hits.hits, 1, -1 do
        local v = doc.hits.hits[k]
        local email = v._source
        local canUse = true
        if email.private then
            if account and not rights then
                rights = aaa.rights(account.credentials.uid or account.credentials.email)
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
            emails[mid] = {
                tid = v._id,
                nest = 1,
                epoch = email.epoch,
                children = {
                    
                }
            }
            
            if not irt or irt == JSON.null or #irt == 0 then
                irt = email.subject:gsub("^[a-zA-Z]+:%s+", "")
            end
            if not emails[irt] and email.references and email.references ~= JSON.null then
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
                        tid = v._id
                    }
                    emails[mid].nest = emails[irt].nest + 1
                    table.insert(threads, emails[irt])
                else
                    table.insert(threads, emails[mid])
                end
            end
            email.references = nil
            email.to = nil
            email['in-reply-to'] = nil
            table.insert(emls, email)
        else
            for k, v in pairs(top10) do
                local eml = email.from:match("<(.-)>") or email.from:match("%S+@%S+") or "unknown"
                if v.email == eml then
                    v.count = v.count - 1
                end
            end
        end
    end
    
    for k, v in pairs(top10) do
        if v.count == 0 then
            top10[k] = nil
        end
    end
    
    -- Debug time point 7
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    JSON.encode_max_depth(500)
    listdata.max = maxresults
    listdata.using_wc = wc
    listdata.no_threads = #threads
    listdata.thread_struct = threads
    listdata.firstYear = firstYear
    listdata.lastYear = lastYear
    listdata.list = listraw:gsub("^([^.]+)%.", "%1@"):gsub("[<>]+", "")
    listdata.emails = emls
    listdata.hits = h
    listdata.searchlist = listraw
    listdata.participants = top10
    listdata.cloud = cloud
    listdata.took = r:clock() - now
    
    
    -- Debug time point 8
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    listdata.debug = t
    
    r:puts(JSON.encode(listdata))
    
    return apache2.OK
end