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
        return apache2.OK
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
        return apache2.OK
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
    
     
    account = account or {}
    
    r:puts(JSON.encode{
        lists = lists,
        preferences = account.preferences,
        login = {
            credentials = account.credentials,
        },
        took = r:clock() - now
    })
    
    return apache2.OK
end