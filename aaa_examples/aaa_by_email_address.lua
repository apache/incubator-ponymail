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

-- This is aaa.lua - AAA filter with email validation.
-- It checks that an oauth validated email account matches *@foocorp.com and if
-- so, grants access to private emails.
-- To use this as your AAA lib, replace aaa.lua in site/api/lib with this file.

local config = require 'lib/config'

-- validated emails ending with @foocorp.com have access to all private emails
-- This is a GLOB, so could also be *@internal.foocorp.com, or *-admin@foocorp.com etc
-- This AAA module requires strcmp_match which is only found in Apache httpd currently.
local valid_email = "*@foocorp.com" 
local grant_access_to = "*" -- use * for access to all, or specify a (sub)domain to grant access to
local useAlternates = false -- also check against alternate email addresses??

-- Is email a valid foocorp email?
local function validateEmail(r, email)
    -- do a GLOB match, testing email aginst valid_email
    if r:strcmp_match(valid_email, email) then
        return true
    end
    return false
end


-- Get a list of domains the user has private email access to (or wildcard if org member)
local function getRights(r, usr)
    if not usr.credentials then
        return {}
    end
    local email = usr.credentials.email or "|||"
    local xemail = email:match("([-a-zA-Z0-9._@]+)") -- whitelist characters
    local rights = {}
    
    -- bad char in email?
    if not email or exmail ~= email then
        return rights
    end
    
    -- Check that we used oauth, bail if not
    local oauth_domain = usr.internal and usr.internal.oauth_used or nil
    if not oauth_domain then
        return {}
    end
    
    -- check if oauth was through an oauth portal that can give privacy rights
    local authority = false
    for k, v in pairs(config.admin_oauth or {}) do
        if r.strcmp_match(oauth_domain, v) then
            authority = true
            break
        end
    end
    
    -- if not a 'good' oauth, then let's forget all about it
    if not authority then
        return rights
    end
    
    -- first, check against primary address
    local validEmail = validateEmail(r, email)
    
    -- if enabled, check against alternates
    if useAlternates then
        if usr and usr.credentials and type(usr.credentials.altemail) == "table" then
            for k, v in pairs(usr.credentials.altemail) do
                if validateEmail(r, v.email) then
                    validEmail = true
                    break
                end
            end
        end
    end
    
    -- Check if email matches foocorp.com
    if usr.internal.admin or validateEmail(r, email) then
        table.insert(rights, grant_access_to)
    end
    return rights
end

-- module defs
return {
    rights = getRights
}
