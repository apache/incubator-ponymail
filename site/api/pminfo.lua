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
 
 pminfo.lua  Pony Mail Information module
]]--

local JSON = require 'cjson'
local elastic = require 'lib/elastic'
local cross = require 'lib/cross'

function handle(r)
    cross.contentType(r, "application/json")
    local t = {}
    local now = r:clock()
    local tnow = now
    local DD = 14
    local MAXRESULTS = 10000 -- max value for from + size in a single query

    
    local NOWISH = math.floor(os.time() / 1800)
    local PMINFO_CACHE_KEY = "pminfo_cache_" .. r.hostname .. "-" .. NOWISH
    
    local cache = r:ivm_get(PMINFO_CACHE_KEY)
    if cache then
        r:puts(cache)
        return cross.OK
    end

    -- Debug time point 1
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    local daterange = {gt = "now-"..DD.."d", lt = "now+1d" }
    
    -- common query
    local QUERY = {
            bool = {
                must = {
                    {
                        range = {
                            date = daterange
                        }
                    }, 
                    {
                        term = {
                            private = false
                        }
                    }
                }
            }
    }

    --[[ Get active lists ]]--
    local doc = elastic.raw {
        size = 0, -- we don't need the hits themselves
        query = QUERY,
        aggs = {
            nlists = { -- total active lists
                cardinality = {
                    field = "list_raw"
                }
            },
            cards = { -- total participants
                cardinality = {
                    field = "from_raw"
                }
            },
            weekly = { -- histogram of emails
                date_histogram = {
                    field = "date",
                    interval = "1d"
                }
            }
        }
    }

    local nal = doc.aggregations.nlists.value -- number of active lists
    
    local total_docs = doc.hits.total
    
    local no_senders = doc.aggregations.cards.value
    
    -- Debug time point 2
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    local activity = {}
    
    for k, v in pairs (doc.aggregations.weekly.buckets) do
        table.insert(activity, {v.key, v.doc_count})
    end
        
    -- Debug time point 3
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
        
    -- Debug time point 4
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    
    -- Get threads
    local num_threads = 0
    local emails = {}
    local squery = {
        _source = {'message-id','in-reply-to','subject','references','epoch'},
        query = QUERY,
        sort = {
            {
                epoch = {
                    order = "desc"
                }
            }
        },
        size = MAXRESULTS
    }
    local hits = {}
    -- check if we need to use scrolling
    if total_docs > MAXRESULTS then
        local sid = elastic.scan(squery)
        if sid then
            doc, sid = elastic.scroll(sid)
            while doc and doc.hits and doc.hits.hits and #doc.hits.hits > 0 do -- scroll as long as we get new results
                for k, v in pairs(doc.hits.hits) do
                    table.insert(hits, v)
                end
                doc, sid = elastic.scroll(sid)
            end
        end
        -- scroll/scan ignores the sort order!
        table.sort (hits, function (k1, k2) return k1._source.epoch > k2._source.epoch end )
    else
        local doc = elastic.raw(squery)
        hits = doc.hits.hits
    end
    
    -- Debug time point 5
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    for k = #hits, 1, -1 do
        local v = hits[k]
        local email = v._source
        local mid = email['message-id']
        local irt = email['in-reply-to']
        email.id = v._id
        email.irt = irt
        emails[mid] = {
            tid = v._id,
            nest = 1,
            children = {
                
            }
        }
        
        if not irt or #irt == 0 then
            irt = email.subject:gsub("^[a-zA-Z]+:%s+", "")
        end
        if not emails[irt] then
            for ref in email.references:gmatch("(%S+)") do
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
            if (#email['in-reply-to'] > 0) then
                emails[irt] = {
                    children = {
                        emails[mid]
                    },
                    nest = 1,
                    tid = v._id
                }
                emails[mid].nest = emails[irt].nest + 1
            end
            num_threads = num_threads + 1
        end
    end
    
    -- Debug time point 6
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    JSON.encode_max_depth(500)
    local listdata = {}
    listdata.max = MAXRESULTS
    listdata.no_threads = num_threads
    listdata.hits = total_docs
    listdata.participants = no_senders
    listdata.no_active_lists = nal
    listdata.took = r:clock() - now
    listdata.activity = activity
    
    -- Debug time point 7
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    listdata.debug = t
    local output = JSON.encode(listdata)
    r:ivm_set(PMINFO_CACHE_KEY, output)
    r:puts(output)
    
    return cross.OK
end

cross.start(handle)