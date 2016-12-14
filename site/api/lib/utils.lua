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

-- This is lib/utils.lua - utility methods

-- find the original topic starter
local function findParent(r, doc, elastic)
    local step = 0
    -- max 50 steps up in the hierarchy
    while step < 50 do
        step = step + 1
        local irt = doc['in-reply-to']
        if not irt then
            break -- won't happen because irt is always present currently
        end
        -- Extract the reference, if any
        irt = irt:match("(<[^>]+>)")
        if not irt then
            break
        end
        local docs = elastic.find('message-id:"' .. r:escape(irt)..'"', 1, "mbox")
        if #docs == 0 then
            break
        end
        doc = docs[1]
    end
    return doc
end


--[[ 
  parse a listid
  returns the full lid, listname and the domain from "<listname.domain>"
   where listname cannot contain any "." chars
]]--
local function parseLid(lid)
    return lid:match("^<(([^.]+)%.(.-))>$")
end


-- does the user have the rights to access the mailing list?
-- N.B. will fail if rights or list_raw are invalid
local function canAccessList(lid, rights)
    -- we don't need the name
    local flid, _ , domain = parseLid(lid)
    for _, v in pairs(rights) do
        if v == "*" or v == flid or v == domain then
            return true
        end
    end
    return false
end

-- does the user have the rights to access the document?
-- N.B. will fail if doc is invalid; may fail if rights is invalid
local function canAccessDoc(doc, rights)
    if doc.private then
        return canAccessList(doc.list_raw, rights)
    else
        return true
    end
end

--[[
    TODO the canAccess functions perhaps belong in aaa.lua.
    This would allow sites to have their own ways of matching lists to rights and individual docs
    This should be dealt with if/when aaa.lua is split up into generic and local parts.

    Also the functions do not check their parameters.
    This is because they may be called frequently.
]]--

return {
    findParent = findParent,
    parseLid = parseLid,
    canAccessList = canAccessList,
    canAccessDoc = canAccessDoc
}
