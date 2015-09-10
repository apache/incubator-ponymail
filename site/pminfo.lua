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

function handle(r)
    r.content_type = "application/json"
    local t = {}
    local now = r:clock()
    local tnow = now
    local get = r:parseargs()
    local qs = "*"
    local domain = get.domain or ""
    if #domain < 2 then
        domain = "*"
    end
    local dd = 14
    local maxresults = 100000
    local listdata = {}

    
    local nowish = math.floor(os.time() / 900)
    
    local cache = r:ivm_get("pminfo_cache_" ..r.hostname .."-" .. nowish)
    if cache then
        r:puts(cache)
        return apache2.OK
    end

    -- Debug time point 1
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    local daterange = {gt = "now-"..dd.."d" }
    
    local sterm = {
            wildcard = {
                list = "*." .. domain
            }
        }
    
    --[[ Get active lists ]]--
    local doc = elastic.raw {
        query = {
            
            bool = {
                must = {
                    {
                    range = {
                        date = daterange
                    }
                }, {
                        term = {
                            private = false
                        }
                    },
                    sterm
                    
            }}
            
        },
        aggs = {
            from = {
                terms = {
                    field = "list_raw",
                    size = 100000
                }
            }
        }
    }
    local lists = {}
    local nal = 0

    for x,y in pairs (doc.aggregations.from.buckets) do
        local list, domain = y.key:match("^<?(.-)%.(.-)>?$")
        if not domain:match("%..-%..-%..-") and domain:match("^[-_a-z0-9.]+$") and list:match("^[-_a-z0-9.]+$") then
            lists[domain] = lists[domain] or {}
            lists[domain][list] = y.doc_count
            nal = nal + 1
        end
    end
    
    -- Debug time point 2
    
    --[[ Get total number of participants ]]--
    local doc = elastic.raw {
        size = 0,
        query = {
            
            bool = {
                must = {
                    {
                    range = {
                        date = daterange
                    }
                }, {
                        term = {
                            private = false
                        }
                    },sterm
                    
            }}
            
        },
        aggs = {
            from = {
                cardinality = {
                    field = "from_raw"
                }
            }
        }
    }
    local no_senders = doc.aggregations.from.value
    
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    --[[ Get historgram of emails ]]
    local doc = elastic.raw {
        aggs = {
            weekly = {
                date_histogram = {
                    field = "date",
                    interval = "1d"
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
                }, {
                        term = {
                            private = false
                        }
                    },sterm
                    
            }}
            
        }
    }
    local activity = {}
    
    for k, v in pairs (doc.aggregations.weekly.buckets) do
        table.insert(activity, {v.key, v.doc_count})
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
                    range = {
                        date = daterange
                    }
                }, {
                        term = {
                            private = false
                        }
                    },sterm
                    
            }}
            
        }
    }
    local active_senders = {}
    
    
    
    -- Debug time point 3
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    for x,y in pairs (doc.aggregations.from.buckets) do
        local eml = y.key:match("<(.-)>") or y.key:match("%S+@%S+") or "unknown"
        local gravatar = r:md5(eml)
        local name = y.key:match("([^<]+)%s*<.->") or y.key:match("%S+@%S+")
        name = name:gsub("\"", "")
        table.insert(active_senders, {
            id = y.key,
            email = eml,
            gravatar = gravatar,
            name = name,
            count = y.doc_count
        })
    end
    listdata.participants = active_senders
    
    
    
    -- Debug time point 4
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    
    -- Get threads
    local threads = {}
    local emails = {}
    local emails_full = {}
    local emls = {}
    local doc = elastic.raw {
        _source = {'message-id','in-reply-to','to','from','subject','epoch','references','list_raw'},
        query = {
            bool = {
                must = {
                    {
                    range = {
                        date = daterange
                    }
                }, {
                        term = {
                            private = false
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
        size = maxresults
    }
    local h = #doc.hits.hits
    
    -- Debug time point 6
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    for k = #doc.hits.hits, 1, -1 do
        local v = doc.hits.hits[k]
        local email = v._source
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
                    epoch = email.epoch,
                    tid = v._id
                }
                emails[mid].nest = emails[irt].nest + 1
                table.insert(threads, emails[irt])
            else
                table.insert(threads, emails[mid])
            end
        end
        table.insert(emls, email)
    end
    
    -- Debug time point 7
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    JSON.encode_max_depth(500)
    listdata.max = maxresults
    listdata.no_threads = #threads
    listdata.hits = h
    listdata.participants = no_senders
    listdata.top100 = active_senders
    listdata.no_active_lists = nal
    listdata.active_lists = lists
    listdata.took = r:clock() - now
    listdata.activity = activity
    
    -- Debug time point 8
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    listdata.debug = t
    local output = JSON.encode(listdata)
    r:ivm_set("pminfo_cache_" ..r.hostname .."-" .. nowish, output)
    r:puts(output)
    
    return apache2.OK
end