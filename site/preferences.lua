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


function handle(r)
    local now = r:clock()
    r.content_type = "application/json"
    local now = r:clock()
    local get = r:parseargs()
    
    
    local login = {
        loggedIn = false
    }
    
    local prefs = nil -- Default to JS prefs if not logged in
    
    -- prefs?
    local ocookie = r:getcookie("pony")
    if ocookie and #ocookie > 43 then
        local cookie, eml = r:unescape(ocookie):match("([a-f0-9]+)==(.+)")
        if cookie and #cookie >= 40 and eml then
            local js = elastic.get('account', r:sha1(eml))
            if js and js.email then
                login = {
                    loggedIn = true,
                    email = js.email,
                    fullname = js.fullname
                }
                prefs = js.preferences
            end
            
            -- while we're here, are you logging out?
            if get.logout and login.loggedIn == true then
                elastic.index(r, r:sha1(eml), 'account', JSON.encode{
                    email = js.email,
                    uid = js.uid,
                    fullname = js.fullname,
                    admin = js.admin,
                    cookie = 'nil',
                    preferences = js.preferences
                })
                r:setcookie("pony", "----")
                r:puts[[{"logut": true}]]
                return apache2.OK
            end
            
            -- Or are you saving your preferences?
            if get.save and login.loggedIn == true then
                prefs = {}
                for k, v in pairs(get) do
                    if k ~= 'save' then
                        prefs[k] = v
                    end
                end
                elastic.index(r, r:sha1(eml), 'account', JSON.encode{
                    email = js.email,
                    fullname = js.fullname,
                    uid = js.uid,
                    admin = js.admin,
                    cookie = r:unescape(ocookie),
                    preferences = prefs
                })
                r:puts[[{"saved": true}]]
                return apache2.OK
            end
        end
    end
    
    -- Get lists
    local doc = elastic.raw {
        aggs = {
            from = {
                terms = {
                    field = "list_raw",
                    size = 500000
                }
            }
        }
    }
    local lists = {}
    
    for x,y in pairs (doc.aggregations.from.buckets) do
        local list, domain = y.key:match("^<?(.-)%.(.-)>?$")
        if not domain:match("%..-%..-%..-") and domain:match("^[-_a-z0-9.]+$") and list:match("^[-_a-z0-9.]+$") then
            lists[domain] = lists[domain] or {}
            lists[domain][list] = y.doc_count
        end
    end
    
     
    
    
    r:puts(JSON.encode{
        lists = lists,
        preferences = prefs,
        login = login,
        took = r:clock() - now
    })
    
    return apache2.OK
end