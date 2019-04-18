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

local JSON = require 'cjson'

-- Get a list of PMCs the user is a part of
local function getPMCs(uid)
    local groups = {}
    -- Check for valid chars. Important since the uid is passed to the shell.
    if not uid:match("^[-a-z0-9_.]+$") then
        return groups
    end
    local ldapdata = io.popen( ([[ldapsearch -x -LLL -b ou=project,ou=groups,dc=apache,dc=org "(owner=uid=%s,ou=people,dc=apache,dc=org)" dn]]):format(uid) )
    local data = ldapdata:read("*a")
    for match in data:gmatch("dn: cn=([-a-zA-Z0-9]+),ou=project,ou=groups,dc=apache,dc=org") do
        table.insert(groups, match)
    end
    return groups
end


-- Is $uid a member of the ASF?
local function isMember(uid)
    -- Check for valid chars. Important since the uid is passed to the shell.
    if not uid:match("^[-a-z0-9_.]+$") then
        return false
    end
    local ldapdata = io.popen(([[ldapsearch -x -LLL -b cn=member,ou=groups,dc=apache,dc=org '(memberUid=%s)' dn]]):format(uid))
    -- This returns a string starting with 'dn: cn=member,ou=groups,dc=apache,dc=org' or the empty string.
    local data = ldapdata:read("*a")
    return nil ~= data:match("dn: cn=member,ou=groups,dc=apache,dc=org")
end

-- Is $uid a committer of the ASF?
local function isCommitter(uid)
    -- Check for valid chars. Important since the uid is passed to the shell.
    if not uid:match("^[-a-z0-9_.]+$") then
        return false
    end
    local ldapdata = io.popen(([[ldapsearch -x -LLL -b ou=people,dc=apache,dc=org '(uid=%s)' dn]]):format(uid))
    -- This returns a string starting with 'dn: uid=uid,ou=people,dc=apache,dc=org' or the empty string.
    local data = ldapdata:read("*a")
    return nil ~= data:match(("dn: uid=%s,ou=people,dc=apache,dc=org"):format(uid))
end

-- additional top-level lists (*.apache.org) to which committers are entitled
local LISTS = {"committers", "list2"} -- etc

-- Get a list of domains the user has private email access to (or wildcard if org member)
local function getRights(r, usr)
    local uid = usr.credentials.uid

    -- First, check the 30 minute cache
    local NOWISH = math.floor(os.time() / 1800)
    local USER_KEY = "aaa_rights_" .. NOWISH .. "_" .. uid
    local t = r:ivm_get(USER_KEY)
    if t then
        return JSON.decode(t)
    end

    local rights = {}
    -- Check if uid has member (admin) rights
    if usr.internal.admin or isMember(uid) then
        table.insert(rights, "*")
    -- otherwise, get PMC list and construct array
    else
        -- Add the PMC lists
        local list = getPMCs(uid)
        for k, v in pairs(list) do
            table.insert(rights, v .. ".apache.org")
        end
        -- Add the lists for all committers
        if isCommitter(uid) then
            for k, v in ipairs(LISTS) do
                table.insert(rights, v .. ".apache.org")
            end
        end
    end
    r:ivm_set(USER_KEY, JSON.encode(rights))
    return rights
end

-- module defs
return {
    rights = getRights,
    validateParams = true
}
