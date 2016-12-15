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

-- This is aaa.lua - AAA filter with portal validation.
-- It checks that an oauth validated account was logged in through a specific
-- OAuth provider, and if used, allows access to private lists.
-- To use this as your AAA lib, replace aaa.lua in site/api/lib with this file.

local config = require 'lib/config'

-- Allow anyone logged in through Google+ access to private emails
-- This is a direct string match, not a GLOB
local valid_portal = "www.googleapis.com"  
local grant_access_to = "*" -- use * for access to all, or specify a (sub)domain to grant access to

-- Get rights (full or no access)
local function getRights(r, usr)
    if not usr.credentials then
        return {}
    end
    local email = usr.credentials.email or "|||"
    local xemail = email:match("([-a-zA-Z0-9._@]+)") -- whitelist characters
    local rights = {}
    
    -- bad char in email?
    if not email or xemail ~= email then
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
    
    -- Check if admin or if the right oauth portal was used
    if usr.internal.admin or oauth_domain == valid_portal then
        table.insert(rights, grant_access_to)
    end
    return rights
end

-- module defs
return {
    rights = getRights
}
