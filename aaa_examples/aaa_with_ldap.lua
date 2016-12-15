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

-- This is aaa_site.lua - site-specific AAA filter for ASF.

-- Get a list of PMCs the user is a part of
local function getPMCs(r, uid)
    local groups = {}
    local ldapdata = io.popen( ([[ldapsearch -x -LLL "(|(memberUid=%s)(member=uid=%s,ou=people,dc=apache,dc=org))" cn]]):format(uid,uid) )
    local data = ldapdata:read("*a")
    for match in data:gmatch("dn: cn=([-a-zA-Z0-9]+),ou=pmc,ou=committees,ou=groups,dc=apache,dc=org") do
        table.insert(groups, match)
    end
    return groups
end


-- Is $uid a member of the ASF?
local function isMember(r, uid)
    
    -- First, check the 30 minute cache
    local NOWISH = math.floor(os.time() / 1800)
    local MEMBER_KEY = "isMember_" .. NOWISH .. "_" .. uid
    local t = r:ivm_get(MEMBER_KEY)
    
    -- If cached, then just return the value
    if t then
        return tonumber(t) == 1
    
    -- Otherwise, look in LDAP
    else
        local ldapdata = io.popen([[ldapsearch -x -LLL -b cn=member,ou=groups,dc=apache,dc=org]])
        local data = ldapdata:read("*a")
        for match in data:gmatch("memberUid: ([-a-z0-9_.]+)") do
            -- Found it?
            if match == uid then
                -- Set cache
                r:ivm_set(MEMBER_KEY, "1")
                return true
            end
        end
    end
    
    -- Set cache
    r:ivm_set(MEMBER_KEY, "0")
    return false
end

-- Get a list of domains the user has private email access to (or wildcard if org member)
local function getRights(r, usr)
    local uid = usr.credentials.uid
    local rights = {}
    -- Check if uid has member (admin) rights
    if usr.internal.admin or isMember(r, uid) then
        table.insert(rights, "*")
    -- otherwise, get PMC list and construct array
    else
        local list = getPMCs(r, uid)
        for k, v in pairs(list) do
            table.insert(rights, v .. ".apache.org")
        end
    end
    return rights
end

-- module defs
return {
    rights = getRights,
    validateParams = true
}
