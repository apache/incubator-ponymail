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

-- This is preferences.lua - an account info agent

local JSON = require 'cjson'
local elastic = require 'lib/elastic'
local user = require 'lib/user'
local cross = require 'lib/cross'

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
    local account = user.get(r)
    
    -- while we're here, are you logging out?
    if get.logout and account then
        user.logout(r, account)
        r:puts[[{"logut": true}]]
        return cross.OK
    end

    -- Or are you saving your preferences?
    if get.save and account then
        prefs = {}
        for k, v in pairs(get) do
            if k ~= 'save' then
                prefs[k] = v
            end
        end
        account.preferences = prefs
        user.save(r, account)
        r:puts[[{"saved": true}]]
        return cross.OK
    end
       
    
    -- Get lists (cached if possible)
    local lists = {}
    local nowish = math.floor(os.time() / 300)
    local cache = r:ivm_get("pm_lists_cache_" ..r.hostname .."-" .. nowish)
    if cache then
        lists = JSON.decode(cache)
    else
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
        
        local ndoc = elastic.raw {
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
                        date = { gte = "now-90d" }
                    }
            }
        }
        
        for x,y in pairs (doc.aggregations.from.buckets) do
            local list, domain = y.key:match("^<?(.-)%.(.-)>?$")
            if domain and domain:match("^[-_a-z0-9.]+$") and list:match("^[-_a-z0-9.]+$") then
                lists[domain] = lists[domain] or {}
                lists[domain][list] = 0
            end
        end
        for x,y in pairs (ndoc.aggregations.from.buckets) do
            local list, domain = y.key:match("^<?(.-)%.(.-)>?$")
            if domain and domain:match("^[-_a-z0-9.]+$") and list:match("^[-_a-z0-9.]+$") then
                lists[domain] = lists[domain] or {}
                lists[domain][list] = y.doc_count
            end
        end
        r:ivm_set("pm_lists_cache_" ..r.hostname .."-" .. nowish, JSON.encode(lists))
    end
    
    -- Get notifs
    local notifications = 0
    if account then
        local notifs = elastic.find("seen:0 AND recipient:" .. r:sha1(account.cid), 10, "notifications")
        if notifs and #notifs > 0 then
            notifications = #notifs
        end
    end
     
    account = account or {}
    local descs = elastic.find("*", 9999, "mailinglists", "name")
    
    -- try to extrapolate foo@bar.tld here
    for k, v in pairs(descs) do
        local l, d = v.list:match("<([^.]+)%.(.-)>")
        if l and d then
            descs[k].lid = ("%s@%s"):format(l, d)
        else
            descs[k].lid = v.list
        end
    end
    
    r:puts(JSON.encode{
        lists = lists,
        descriptions = descs,
        preferences = account.preferences,
        login = {
            credentials = account.credentials,
            notifications = notifications
        },
        took = r:clock() - now
    })
    
    return cross.OK
end

cross.start(handle)