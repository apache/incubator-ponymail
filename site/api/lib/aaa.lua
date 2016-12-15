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
]]

--[[
    This is aaa.lua - generic AAA module.
    It includes a basic version of the API.
    However the default does not grant any rights.

    Each site must provide their own customised AAA module.
    The site-specific module must be called 'aaa_site.lua'
    and be located in the lib/ directory.
 ]]

local config = require 'lib/config'

local aaa_site = nil 
pcall(function() aaa_site = require 'lib/aaa_site' end)
--[[
    The module is expected to return the following:
    {
        rights = function(r, account) to get the rights
        validateParams = true/false (optional)
    }
]]

--Basic parameter validation
local function validateParams(r, account)
    if not account.credentials then
        return false -- no credentials, cannot grant rights
    end
    -- Check that we used oauth, bail if not
    local oauth_domain = account.internal and account.internal.oauth_used or nil
    if not oauth_domain then
        return false -- no valid auth
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
        return false
    end

    -- if the uid exists, then validate it
    local uid = account.credentials.uid
    if uid and (not uid:match("^[-a-zA-Z0-9._]+$") or uid:sub(1,1) == '-') then
        return false
    end
    -- TODO is there any further common validation possible?
    -- not sure it makes sense to validate an email address here;
    -- if required it should be done by the site module
    return true
end

--[[
    Get the set of rights to be used for checking access to private documents.

    The default implementation returns an empty set of rights.
]]
local function getRights(r, account)
    if aaa_site then -- we have a site override module
        -- should we pre-validate the params?
        if aaa_site.validateParams then
            if not validateParams(r, account) then
                return {}
            end
        end
        return aaa_site.rights(r, account)
    else
        return {}
    end
end

--[[ 
  parse a listid
  returns the full lid, listname and the domain from "<listname.domain>"
   where listname cannot contain any "." chars
]]--
local function parseLid(lid)
    return lid:match("^<(([^.]+)%.(.-))>$")
end


-- does the account have the rights to access the mailing list?
-- N.B. will fail if rights or list_raw are invalid
local function canAccessList(r, lid, account)
    if not account then return false end
    -- check the rights cache
    local rights = account._rights_ 
    if not rights then
        rights = getRights(r, account)
        account._rights_ = rights
    end
    -- we don't need the name
    local flid, _ , domain = parseLid(lid)
    for _, v in pairs(rights) do
        if v == "*" or v == flid or v == domain then
            return true
        end
    end
    return false
end

-- does the account have the rights to access the document?
-- N.B. will fail if doc is invalid
local function canAccessDoc(r, doc, account)
    if doc.private then
        -- if not account then return false end (done by canAccessList)
        -- assume that rights are list-based
        return canAccessList(doc.list_raw, account)
    else
        return true
    end
end

--[[
    Note that the functions do not check their parameters.
    This is because they may be called frequently.
]]--

-- module defs
return {
    rights = getRights,
    parseLid = parseLid,
    canAccessList = canAccessList,
    canAccessDoc = canAccessDoc
}
