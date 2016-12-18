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
local utils = require 'lib/utils'

local days = {
    31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 30, 31 
}

local function sortEmail(thread)
    if thread.children and type(thread.children) == "table" then
        table.sort (thread.children, function (k1, k2) return k1.epoch > k2.epoch end )
        for k, v in pairs(thread.children) do
            sortEmail(v)
        end
    end
end

-- findSubject: match an email with an earlier one with the same topic
-- used for orphaned emails
local function findSubject(gblob, blob, subject, epoch, maxAge)
    local subj = subject:gsub("^[A-Za-z]:%s+", "")
    for k, v in pairs(blob) do
        if v.subject and v.subject == subj and v.epoch < epoch and (not maxAge or (maxAge and v.epoch >= (epoch - (maxAge*86400)))) then
            local mid = v['message-id']
            if gblob[mid] then
                return gblob[mid]
            end
        end
    end
    return nil
end

local function leapYear(year)
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

-- extract canonical email name from from field
local function extractCanonName(from)
    local name = from:match("([^<]+)%s*<.->") or from:match("%S+@%S+") or from:match("%((.-)%)") or "unknown"
    return name:gsub("\"", ""):gsub("%s+$", "")
end

function handle(r)
    cross.contentType(r, "application/json")
    local t = {}
    local now = r:clock()
    local tnow = now
    local get = r:parseargs()
    local lastEmail = 0
    -- statsOnly: Whether to only send statistical info (for n-grams etc), and not the
    -- thread struct and message bodies
    -- Param: quick
    local statsOnly = get.quick
    -- Param: list=<listname> or '*' (required)
    -- Param: domain=<domain> or '*' (required)
    if not get.list or not get.domain then
        r:puts("{}")
        return cross.OK
    end
    local qs = "*" -- positive query
    local nqs = "" -- negative query
    local dd = "lte=1M"
    local maxresults = config.maxResults or 5000
    local account = user.get(r)
    local rights = nil
    -- Param: d=nnnnn (numeric)
    -- does not appear to be supported below
    if get.d and tonumber(get.d) and tonumber(get.d) > 0 then
        dd = tonumber(get.d)
    end
    local x
    local nx
    local y
    local z
    local ec
    -- Param: q=query
    if get.q and #get.q > 0 then
        x = {}
        nx = {}
        local q = get.q:gsub("+", " ") -- apache quirk?
        for k, v in pairs({'from','subject','body'}) do
            y = {}
            z = {}
            local words = {}
            
            -- first, grab all "foo bar" quotes
            for lword in q:gmatch([[("[^"]+")]]) do
                table.insert(words, lword)
            end
            -- then cut them out of the query
            for _, word in pairs(words) do
                q = q:gsub('"' .. word:gsub('[.%-%%%?%+]', "%%%1") .. '"', "")
            end
            
            -- then remaining single words
            for word in q:gmatch("(%S+)") do
                table.insert(words, word)
            end
            
            for _, word in pairs(words) do
                local preface = ""
                if word:match("^%-") then
                    preface = "-"
                    word = word:sub(2)
                end
                if preface == "" then
                    table.insert(y, ("%s:\"%s\""):format(v, r:escape_html( word:gsub("[()\"]+", "") )))
                else
                    table.insert(z, ("%s:\"%s\""):format(v, r:escape_html( word:gsub("[()\"]+", "") )))
                end
            end
            if #y > 0 then
                table.insert(x, "(" .. table.concat(y, " AND ") .. ")")
            end
            if #z > 0 then
                table.insert(nx, "(" .. table.concat(z, " OR ") .. ")")
            end
        end
        qs = table.concat(x, " OR ")
        if qs == "" then
            qs = "*"
        end
        nqs = table.concat(nx, " OR ")
    end
    
    local listraw = "<" .. get.list .. "." .. get.domain .. ">"
    local listdata = {
        name = get.list,
        domain = get.domain
    }

    z = {}
    -- Param: header_from=
    -- Param: header_subject=
    -- Param: header_body=
    -- Param: header_to=
    for k, v in pairs({'from','subject','body', 'to'}) do
        if get['header_' .. v] then
            local word = get['header_' .. v]
            table.insert(z, ("(%s:\"%s\")"):format(v, r:escape_html( word:gsub("[()\"]+", "") )))
        end
    end
    if #z > 0 then
        if #qs > 0 and qs ~= "*" then
            qs = qs .. " AND (" .. table.concat(z, " AND ") .. ")"
        else
            qs = table.concat(z, " AND ")
        end
    end
    
    -- Debug time point 1
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    local daterange = {gt = "now-1M", lte = "now+1d" }
    -- Param: dfrom=.*ddd (days ago to start)
    -- Param: dto=dddd.* (total days to match)
    -- Must both be present
    if get.dfrom and get.dto then
        local ef = tonumber(get.dfrom:match("(%d+)$")) or 0
        local et = tonumber(get.dto:match("^(%d+)")) or 0
        if ef > 0 and et > 0 then
            if et > ef then
                et = ef
            end
            daterange = {
                gte = "now-" .. ef .. "d",
                lte = "now-" .. (ef-et) .. "d"
            }
        end
    end
    if not get.d then
        get.d = dd
    end
    
    -- d=YYYY-mm translates into s+e being equal to d
    -- Param: d=yyyy-mm
    if not (get.s and get.e) and get.d and get.d:match("^%d+%-%d+$") then
        get.s = get.d
        get.e = get.d
    end
    -- Param: d=.*lte=n[wMyd].* (how long ago to start search)
    -- from now-nP to now+1d (P=period)
    if get.d then
        local lte = get.d:match("lte=([0-9]+[wMyd])")
        if lte then
            daterange.lte = "now+1d"
            daterange.gte = "now-" .. lte
            daterange.gt = nil
        end
    end
    -- Param: d=.*gte=n[wMyd].* (how long ago to end search)
    -- before now-nP (P=period)
    if get.d then
        local gte = get.d:match("gte=([0-9]+[wMyd])")
        if gte then
            daterange.gte = nil
            daterange.gt = nil
            daterange.lte = "now-" .. gte
        end
    end
    -- Param: d=.*dfr=yyyy-mm-dd.*
    -- start date for search
    if get.d then
        local y,m,d = get.d:match("dfr=(%d+)%-(%d+)%-(%d+)")
        if y and m and d then
            daterange.gte = ("%04u/%02u/%02u 00:00:00"):format(y,m,d)
            daterange.gt = nil
        end
    end
    -- Param: d=.*dto=yyyy-mm-dd.*
    -- end date for search
    if get.d then
        local y,m,d = get.d:match("dto=(%d+)%-(%d+)%-(%d+)")
        if y and m and d then
            daterange.lte = ("%04u/%02u/%02u 23:59:59"):format(y,m,d)
            daterange.gt = nil
        end
    end
    -- Param: s=yyyy-m[m]
    -- Param: e=yyyy-m[m]
    if get.s and get.e then
        local em = tonumber(get.e:match("%-(%d%d?)$"))
        local ey = tonumber(get.e:match("^(%d%d%d%d)"))
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
    end
    if get.domain == "*" then
        wc = true
        sterm = {
            wildcard = {
                list = "*"
            }
        }
    end
    
    local top10 = {}
    local allparts = 0
    -- Check for changes?
    -- Param: since=epoch (optional, defaults to now)
    if get.since then
        local epoch = tonumber(get.since) or os.time()
        local doc = elastic.raw {
            _source = {'message-id'},
            query = {
                bool = {
                    must = {
                        {
                            range = {
                                epoch = {
                                    gt = epoch
                                }
                            }
                        },
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
                    },
                    must_not = {
                        {
                            query_string = {
                                default_field = "subject",
                                query = nqs
                            }
                        }
                    }
                }
            },
            size = 1
        }
        local h = #doc.hits.hits
        if h == 0 then
            r:puts(JSON.encode{
                changed = false,
                took = r:clock() - tnow
            })
            return cross.OK
        end
    end
    
    if config.slow_count then
        -- Debug time point 2
        table.insert(t, r:clock() - tnow)
        tnow = r:clock()
        
        local doc = elastic.raw {
            size = 0, -- we don't need the hits themselves
            aggs = {
                from = {
                    terms = {
                        field = "from_raw",
                        size = 10
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
                    },
                    must_not = {
                        {
                            query_string = {
                                default_field = "subject",
                                query = nqs
                            }
                        }
                    }
                }
            }
        }
        
    
        -- Debug time point 3
        table.insert(t, r:clock() - tnow)
        tnow = r:clock()
        
        for x,y in pairs (doc.aggregations.from.buckets) do
            local eml = utils.extractCanonEmail(y.key)
            local gravatar = r:md5(eml:lower())
            local name = extractCanonName(y.key)
            table.insert(top10, {
                email = eml,
                gravatar = gravatar,
                name = name,
                count = y.doc_count
            })
        end
    end
    
    -- Debug time point 4
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    local cloud = nil
    if config.wordcloud and not statsOnly then
        cloud = {}
        -- Word cloud!
        local doc = elastic.raw {
            size = 0, -- we don't need the hits themselves
            aggs = {
                subdoc = {
                    filter = {
                       limit = {value = 100} -- Max 100 x N documents used for this, otherwise it's too slow
                   },
                    aggs = {
                        cloud = {
                            significant_terms =  {
                                field =  "subject",
                                size = 10,
                                chi_square = {}
                            }
                        }
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
                        sterm,
                        {
                            term = {
                                private = false
                            }
                        }
                    },
                    must_not = {
                        {
                            query_string = {
                                default_field = "subject",
                                query = nqs
                            }
                        }
                    }
                }
            }
        }
        for x,y in pairs (doc.aggregations.subdoc.cloud.buckets) do
            cloud[y.key] = y.doc_count
        end
    end
    -- Debug time point 5
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    -- Get years active
    local NOWISH = math.floor(os.time()/600)
    local FIRSTYEAR_KEY = "firstYear:" .. NOWISH .. ":" .. get.list .. "@" .. get.domain
    local LASTYEAR_KEY = "lastYear:" .. NOWISH .. ":" .. get.list .. "@" .. get.domain
    local firstYear = r:ivm_get(FIRSTYEAR_KEY)
    local lastYear = r:ivm_get(LASTYEAR_KEY)
    if (not firstYear or firstYear == "" or not lastYear or lastYear == "") and not statsOnly then
        local doc = elastic.raw {
            size = 0,
            query = {
                bool = {
                    must = {
                        {
                            range = {
                                date = {
                                    gt = "1970/01/01 00:00:00",
                                }
                            }
                        },
                        sterm
                    }
                }
            },
            aggs = {
                first = {
                   min =  {
                      field = "date"
                  }
              },
              last = {
                   max = {
                    field = "date"
                  }
                }
            }
        }
        local first = doc.aggregations.first.value
        if first == JSON.null then first = os.time() else first = first/1000 end
        firstYear = tonumber(os.date("%Y", first))
        r:ivm_set(FIRSTYEAR_KEY, firstYear)

        local last = doc.aggregations.last.value
        if last == JSON.null then last = os.time() else last = last/1000 end
        lastYear = tonumber(os.date("%Y", last))
        r:ivm_set(LASTYEAR_KEY, lastYear)
    end
    
    -- Debug time point 6
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()

    -- Get threads
    local threads = {}
    local emails = {}
    local emails_full = {}
    local emls = {}
    local senders = {}
    
    local dhh = {}
    
    -- construct thread query
    local squery = {
            _source = {'message-id','in-reply-to','from','subject','epoch','references','list_raw', 'private', 'attachments', 'body'},
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
                },
                    must_not = {
                        {
                            query_string = {
                                default_field = "subject",
                                query = nqs
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
    
    -- If max results limit is beyond 10k, we have to do a scan/scroll to fetch it.
    if maxresults > 10000 then
        local sid = elastic.scan(squery) -- get scroll ID
        if sid then -- if results
            local js, sid = elastic.scroll(sid)
            while js and js.hits and js.hits.hits and #js.hits.hits > 0 do -- scroll as long as we get new results
                for k, v in pairs(js.hits.hits) do
                    table.insert(dhh, v)
                end
                if not sid then -- break if last scroll
                    break
                end
                js, sid = elastic.scroll(sid)
            end
        end
    -- otherwise, we can just do a standard raw query
    else
        local doc = elastic.raw(squery)
        dhh = doc.hits.hits
    end

    local h = 0
    
    -- Debug time point 7
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    -- Sometimes ES screws up, so let's sort for it!
    table.sort (dhh, function (k1, k2) return k1._source.epoch > k2._source.epoch end )
    
    for k = #dhh, 1, -1 do
        local v = dhh[k]
        local email = v._source
        local eepoch = tonumber(email.epoch)
        if eepoch > lastEmail then
            lastEmail = eepoch
        end
        if aaa.canAccessDoc(r, email, account) then

            h = h + 1

            -- This is needed by ths slow_count method            
            local eml = utils.extractCanonEmail(email.from)
            local gravatar = r:md5(eml:lower())
            email.gravatar = gravatar

            if not config.slow_count then
                local name = extractCanonName(email.from)
                local eid = ("%s <%s>"):format(name, eml)
                senders[eid] = senders[eid] or {
                    email = eml,
                    gravatar = gravatar,
                    name = name,
                    count = 0
                }
                senders[eid].count = senders[eid].count + 1
            end
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
            local refpoint = email['in-reply-to'] or email['references'] or ""
            local point = emails[irt] or (#refpoint > 0 and findSubject(emails, emls, irt, email.epoch))
            -- Try a little harder??
            if not point and email.subject:match("^[A-Za-z]+:%s+") then  -- if this is a 'Re:' or 'Aw:' or 'Fwd:', try to find parent anyway
                point = findSubject(emails, emls, irt, email.epoch, 30) -- at most, go back 30 days. if not, then they don't belong together...I guess
            end
                
            if point then
                if point.nest < 50 then
                    point.nest = point.nest + 1
                    table.insert(point.children, emails[mid])
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
                if not statsOnly then
                    threads[#threads].body = #email.body < 300 and email.body or email.body:sub(1,300) .. "..."
                end
            end
            email.references = nil
            email.to = nil
            email['in-reply-to'] = nil
            if not account and config.antispam then
                email.from = email.from:gsub("(%S+)@(%S+)", function(a,b) return a:sub(1,2) .. "..." .. "@" .. b end)
            end
            if email.attachments then
                email.attachments = #email.attachments
            else
                email.attachments = 0
            end
            email.body = nil
            if not statsOnly then
                table.insert(emls, email)
            else
                table.insert(emls, {epoch= email.epoch})
            end
        elseif config.slow_count then
            for k, v in pairs(top10) do
                if v.email == utils.extractCanonEmail(email.from) then
                    v.count = v.count - 1
                    break -- don't count the e-mail again
                end
            end
        end
    end
    
    if not config.slow_count and not statsOnly then
        local stable = {}
        for k, v in pairs(senders) do
            table.insert(stable, v)
        end
        table.sort(stable, function(a,b) return a.count > b.count end )
        allparts = #stable
        for k, v in pairs(stable) do
            if k <= 10 then
                table.insert(top10, v)
            else
                break
            end
        end
    end

    -- drop any non-participants and count the remainders
    -- count the participants
    if config.slow_count then
        local top10_copy = top10
        top10 = {}
        for k, v in pairs(top10_copy) do
            if v.count > 0 then
                table.insert(top10, v)
                allparts = allparts + 1
            end
        end
    end

    -- anonymize emails if not logged in - anti-spam!
    if not account and config.antispam then
        for k, v in pairs(top10) do
            top10[k].email = top10[k].email:gsub("(%S+)@(%S+)", function(a,b) return a:sub(1,2) .. "..." .. "@" .. b end)
        end
    end
    
    -- Debug time point 8
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    sortEmail(threads)
    
    -- Debug time point 9
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    if JSON.encode_max_depth then
        JSON.encode_max_depth(500)
    end
    listdata.max = maxresults
    listdata.using_wc = wc
    listdata.no_threads = #threads
    if not statsOnly then
        listdata.thread_struct = threads
    end
    listdata.firstYear = firstYear
    listdata.lastYear = lastYear
    listdata.list = listraw:gsub("^([^.]+)%.", "%1@"):gsub("[<>]+", "")
    listdata.emails = emls
    listdata.hits = h
    listdata.searchlist = listraw
    listdata.participants = top10
    listdata.cloud = cloud
    listdata.took = r:clock() - now
    listdata.numparts = allparts
    
    -- date of last email seen
    if lastEmail == 0 then
        lastEmail = os.time()
    end
    
    listdata.unixtime = lastEmail
    
    -- Debug time point 9
    table.insert(t, r:clock() - tnow)
    tnow = r:clock()
    
    listdata.debug = t
    listdata.slow_count = config.slow_count -- debug
    
    r:puts(JSON.encode(listdata))
    
    return cross.OK
end

cross.start(handle)
