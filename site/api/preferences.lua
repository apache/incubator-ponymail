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
local smtp = require 'socket.smtp'
local config = require 'lib/config'
local aaa = require 'lib/aaa'

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
    
    -- associating an email address??
    if get.associate and account and get.associate:match("^%S+@%S+$") then
        local fp, lp = get.associate:match("([^@]+)@([^@]+)")
        if config.no_association then
            for k, v in pairs(config.no_association) do
                if r.strcmp_match(lp:lower(), v) or v == "*" then
                    r:puts(JSON.encode{error="You cannot associate email addresses from this domain"})
                    return cross.OK
                end
            end
        end
        
        local hash = r:md5(math.random(1,999999) .. os.time() .. account.cid)
        account.credentials.altemail = account.credentials.altemail or {}
        table.insert(account.credentials.altemail, { email = get.associate, hash = hash, verified = false})
        user.save(r, account, true)
        local scheme = "https"
        if r.port == 80 then
            scheme = "http"
        end
        local domain = ("%s://%s:%u/"):format(scheme, r.hostname, r.port)
        if r.headers_in['Referer'] and r.headers_in['Referer']:match("merge%.html") then
            domain = r.headers_in['Referer']:gsub("/merge%.html", "/")
        end
        local vURL = ("%sapi/preferences.lua?verify=true&hash=%s"):format(domain, hash)
        
        
        -- send email
        local source = smtp.message{
                headers = {
                    subject = "Confirm email address merge in Pony Mail"
                    },
                body = ([[
You (or someone else) has requested to merge this email address with the account '%s' in Pony Mail.
If you wish to complete this merge, please visit %s
 ...Or don't if you didn't request this

With regards,
Pony Mail - Email for Ponies and People.
]]):format(account.credentials.email, vURL)
            }
        
        -- send email!
        local rv, er = smtp.send{
            from = ("\"Pony Mail\"<no-reply@%s>"):format(r.hostname),
            rcpt = get.associate,
            source = source,
            server = config.mailserver
        }
        r:puts(JSON.encode{requested = rv or er})
        return cross.OK
    end
    
    -- verify alt email?
    if get.verify and get.hash and account and account.credentials.altemail then
        local verified = false
        for k, v in pairs(account.credentials.altemail) do
            if v.hash == get.hash then
                account.credentials.altemail[k].verified = true
                verified = true
                break
            end
        end
        user.save(r, account, true)
        r.content_type = "text/plain"
        if verified then
            r:puts("Email address verified! Thanks for shopping at Pony Mail!\n")
        else
            r:puts("Either you supplied an invalid hash or something else went wrong.\n")
        end
        return cross.OK
    end
    
    -- remove alt email?
    if get.removealt and account and account.credentials.altemail then
        for k, v in pairs(account.credentials.altemail) do
            if v.email == get.removealt then
                account.credentials.altemail[k] = nil
                break
            end
        end
        user.save(r, account, true)
        r:puts(JSON.encode{removed = true})
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
       
    -- Adding a favorite list
    if get.addfav and account then
        local add = get.addfav
        local favs = account.favorites or {}
        local found = false
        -- ensure it's not already there....
        for k, v in pairs(favs) do
            if v == add then
                found = true
                break
            end
        end
        -- if not found, add it
        if not found then
            table.insert(favs, add)
        end
        -- save prefs
        account.favorites = favs
        user.favs(r, account)
        r:puts[[{"saved": true}]]
        return cross.OK
    end
    
    -- Removing a favorite list
    if get.remfav and account then
        local rem = get.remfav
        local favs = account.favorites or {}
        -- ensure it's here....
        for k, v in pairs(favs) do
            if v == rem then
                favs[k] = nil
                break
            end
        end
        -- save prefs
        account.favorites = favs
        user.favs(r, account)
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
        
        -- hide private lists?
        -- this invalidates any cache there is and forces a check for
        -- private emails inside lists. If found and the current user
        -- does not have access, the list is hidden
        if config.hidePrivate then
            local pdoc = elastic.raw {
                aggs = {
                    from = {
                        terms = {
                            field = "list_raw",
                            size = 500000
                        }
                    }
                },
                query = {
                    bool = {
                        must = {
                            {
                                range = {
                                        date = { gte = "now-90d" }
                                    },
                            },
                            {
                                term = {
                                    private = true
                                }
                            }
                        }
                    }
                }
            }
            local rights = {}
            if account then
                rights = aaa.rights(r, account)
            end
            for x,y in pairs (pdoc.aggregations.from.buckets) do
                local canAccess = false
                local list, domain = y.key:match("^<?(.-)%.(.-)>?$")
                local flid = list .. "." .. domain
                for k, v in pairs(rights) do
                    if v == "*" or v == domain or v == flid then
                        canAccess = true
                        break
                    end
                end
                if not canAccess then
                    lists[domain] = lists[domain] or {}
                    lists[domain][list] = nil
                end
            end
        else
            r:ivm_set("pm_lists_cache_" ..r.hostname .."-" .. nowish, JSON.encode(lists))
        end
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
    
    local alts = {}
    if account and account.credentials and type(account.credentials.altemail) == "table" then
        for k, v in pairs(account.credentials.altemail) do
            if v.verified then
                table.insert(alts, v.email)
            end
        end
    end
    r:puts(JSON.encode{
        lists = lists,
        descriptions = descs,
        preferences = account.preferences,
        login = {
            favorites = account.favorites,
            credentials = account.credentials,
            notifications = notifications,
            alternates = alts
        },
        took = r:clock() - now
    })
    
    return cross.OK
end

cross.start(handle)