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
        
        -- for each email, get the actual source of it to plop into the mbox file
        for k, v in pairs(docs.hits.hits) do
            v = v._source
            if not v.private then
                local doc = elastic.get('mbox_source', v.mid)
                if doc and doc.source then
                    r:puts("From \n")
                    r:puts(doc.source)
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
