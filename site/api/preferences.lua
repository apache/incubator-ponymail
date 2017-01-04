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
local utils = require 'lib/utils'

--[[
    Remove nulls values from a table
    This is for use in tidying up account.credentials.altemail
    which may contain null entries.
    Rather than continually check for them, remove them from
    the input before use.
]]
local function filtertable(input)
    -- table.remove can affect pairs()
    -- so repeat until no more to do
    repeat
        local isClean = true
        for k, v in pairs(input) do
            if not v or v == JSON.null then
                table.remove(input, k)
                isClean = false
                break
            end
        end
    until isClean
end

--[[
Get login details (if logged in), mail list counts and descriptions

Parameters: (cookie required)
  - logout: Whether to log out of the system (optional)
  - associate=$email - associate the account with the $email address
  - verify&hash=$hash - verify an association request $hash
  - removealt=$email - remove an alternate $email address
  - save - save preferences as specified (does not merge)
  - addfav=$list - add a favourite $list
  - remfav=$list - remove a favourite $list
]]--
function handle(r)
    local now = r:clock()
    cross.contentType(r, "application/json")
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
        r:puts[[{"logout": true}]]
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

        if get.associate == account.credentials.email then
            r:puts(JSON.encode{error="The primary mail address cannot be added as an alternate"})
            return cross.OK
        end


        account.credentials.altemail = account.credentials.altemail or {}
        filtertable(account.credentials.altemail)
        local duplicateRequest = false
        for k, v in pairs(account.credentials.altemail) do
            if v.email == get.associate then -- duplicate request
                if v.verified then -- already exists
                    r:puts(JSON.encode{error="That email is already defined as an alternate"})
                    -- OK to return here as we don't need to update anything
                    return cross.OK
                else -- pending verification, update the hash
                    v.hash = hash -- update all pending requests to the new hash
                    -- cannot return here in case there are multiple entries
                    -- also we need to mail the new hash to the user
                    duplicateRequest = true
                end
            end
        end

        local hash = r:md5(math.random(1,999999) .. os.time() .. account.cid)
        local scheme = "https"
        if r.port == 80 then
            scheme = "http"
        end
        local domain = ("%s://%s:%u/"):format(scheme, r.hostname, r.port)
        if r.headers_in['Referer'] and r.headers_in['Referer']:match("merge%.html") then
            domain = r.headers_in['Referer']:gsub("/merge%.html", "/")
        end
        local vURL = ("%sapi/preferences.lua?verify=true&hash=%s"):format(domain, hash)
        
        local mldom = r.headers_in['Referer'] and r.headers_in['Referer']:match("https?://([^/:]+)") or r.hostname
        if not mldom then mldom = r.hostname end
        
        -- send email
        local source = smtp.message{
                headers = {
                    subject = "Confirm email address association in Pony Mail",
                    to = get.associate,
                    from = ("\"Pony Mail\"<no-reply@%s>"):format(mldom)
                    },
                body = ([[
You (or someone else) has requested to associate the email address '%s' with the account '%s' in Pony Mail.
If you wish to complete this association, please visit
%s
whilst logged in to Pony Mail.
Note: if you have repeated the association request, only the last URL will work.
 ...Or if you didn't request this, just ignore this email.

With regards,
Pony Mail - Email for Ponies and People.
]]):format(get.associate, account.credentials.email, vURL)
            }
        
        -- send email!
        local rv, er = smtp.send{
            from = ("\"Pony Mail\"<no-reply@%s>"):format(r.hostname),
            rcpt = get.associate,
            source = source,
            server = config.mailserver,
            port = config.mailport or nil -- if not specified, use the default
        }
         -- only update the account if the mail was sent OK
        if rv then
            if not duplicateRequest then
                table.insert(account.credentials.altemail, { email = get.associate, hash = hash, verified = false})
            end
            user.save(r, account, true)
        end
        r:puts(JSON.encode{requested = rv or er})
        return cross.OK
    end
    
    -- verify alt email?
    if get.verify and get.hash and account and account.credentials.altemail then
        filtertable(account.credentials.altemail)
        local verified = false
        for k, v in pairs(account.credentials.altemail) do
            if v.hash == get.hash then
                account.credentials.altemail[k].verified = true
                account.credentials.altemail[k].hash = nil
                verified = true
                -- fix all the matches
            end
        end
        user.save(r, account, true)
        -- response goes back to the browser direct
        cross.contentType(r, "text/plain")
        if verified then
            r:puts("Email address verified! Thanks for shopping at Pony Mail!\n")
        else
            r:puts("Either you supplied an invalid hash or something else went wrong.\n")
        end
        return cross.OK
    end
    
    -- remove alt email?
    if get.removealt and account and account.credentials.altemail then
        filtertable(account.credentials.altemail)
        for k, v in pairs(account.credentials.altemail) do
            if v.email == get.removealt then
                table.remove(account.credentials.altemail, k)
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

    -- don't allow failed options to drop-thru
    for _, v in pairs({'associate', 'verify', 'removealt', 'save', 'addfav', 'remfav'}) do
        if get[v] then
            if not account then
                r:puts(JSON.encode{error="Not logged in"})
            else
                r:puts(JSON.encode{error="Missing or invalid parameter(s)"})
            end
            return cross.OK
        end
    end

    -- Get lists (cached if possible)
    local lists = {}
    local NOWISH = math.floor(os.time() / 600)
    local PM_LISTS_KEY = "pm_lists_cache_" .. r.hostname .. "-" .. NOWISH
    local cache = r:ivm_get(PM_LISTS_KEY)
    if cache then
        lists = JSON.decode(cache)
    else
        -- aggregate the documents by listname, privacy flag, recent docs

        local alldocs = elastic.raw{
            size = 0, -- we don't need the hits themselves
            aggs = {
                listnames = {
                    terms = {
                        field = "list_raw",
                        size = 500000
                    },
                    aggs = {
                        -- split list into public and private buckets
                        privacy = {
                            terms = {
                                field = "private"
                            },
                            aggs = {
                                -- Create a single bucket of recent mails
                                recent = {
                                    range = {
                                        field = "date",
                                        ranges = { {from = "now-90d"} }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        -- Now process the docs that are visible to the user
        for _, entry in pairs (alldocs.aggregations.listnames.buckets) do
            local listname = entry.key:lower()
            local _, list, domain = aaa.parseLid(listname)
            -- TODO is it necessary to check the lengths?
            if list and domain and #list > 0 and #domain > 3 then
                -- check public and private (only one may be present)
                for _, privacy in pairs(entry.privacy.buckets) do
                    local isPublic = privacy.key_as_string == 'false'
                    -- do the user have access?
                    if isPublic or aaa.canAccessList(r, listname, account)  then
                        -- there is only a single recent bucket; access it directly
                        local recent_count = privacy.recent.buckets[1].doc_count
                        -- create the domain entry if necessary
                        lists[domain] = lists[domain] or {}
                        -- check if we have a list entry yet
                        if lists[domain][list] then
                            lists[domain][list] = lists[domain][list] + recent_count
                        else
                            lists[domain][list] = recent_count -- init the entry
                        end
                    end
                end
            end
        end
        -- save temporary list in cache
        r:ivm_set(PM_LISTS_KEY, JSON.encode(lists))
    end
    
        -- do we need to remove junk?
    if config.listsDisplay then
        for k, v in pairs(lists) do
            if not k:match(config.listsDisplay) then
                lists[k] = nil
            end
        end
    end

    
    -- Get notifs
    local notifications = 0
    if account then
        local _, notifs = pcall(function() return elastic.find("seen:0 AND recipient:" .. r:sha1(account.cid), 10, "notifications") end)
        if notifs and #notifs > 0 then
            notifications = #notifs
        end
    end
     
    account = account or {}
    local stat, descs = pcall(function() return elastic.find("*", 9999, "mailinglists", "name") end)
    if not stat or not descs then
        descs = {} -- ensure descs is valid
    end
    -- try to extrapolate foo@bar.tld here
    for k, v in pairs(descs) do
        local _, l, d = aaa.parseLid(v.list:lower())
        if l and d then
            descs[k].lid = ("%s@%s"):format(l, d)
        else
            descs[k].lid = v.list
        end
    end
    
    local alts = {}
    if account and account.credentials and type(account.credentials.altemail) == "table" then
        filtertable(account.credentials.altemail)
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