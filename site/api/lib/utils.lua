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

local JSON = require 'cjson' -- for JSON.null

local days = { -- days in months of the year
    31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 30, 31
}

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
    Anonymize the document body
]]
local function anonymizeBody(body)
    return body:gsub("<(%S+)@([-a-zA-Z0-9_.]+)>", function(a,b) return "<" .. a:sub(1,2) .. "..." .. "@" .. b .. ">" end)
end

--[[
    Anonymize an email address
]]
local function anonymizeEmail(email)
    return email:gsub("(%S+)@(%S+)", function(a,b) return a:sub(1,2) .. "..." .. "@" .. b end)
end

--[[
    Anonymize document headers:
    - from
    - cc
    - to
    Also processes from_raw if specified
]]
local function anonymizeHdrs(doc, from_raw)
    if doc.from and doc.from ~= JSON.null and #doc.from > 0 then
        doc.from = anonymizeEmail(doc.from)
    end
    if doc.cc and doc.cc ~= JSON.null and #doc.cc > 0 then
        doc.cc = anonymizeEmail(doc.cc)
    end
    if doc.to and doc.to ~= JSON.null and #doc.to > 0 then
        doc.to = anonymizeEmail(doc.to)
    end
    if from_raw and doc.from_raw then
        doc.from_raw = anonymizeEmail(doc.from_raw)
    end
    return doc
end

-- extract canonical email address from from field
local function extractCanonEmail(from)
    local eml = from:match("<(.-)>") or from:match("%S+@%S+") or nil
    if eml == nil and from:match(".- at .- %(") then
        eml = from:match("(.- at .-) %("):gsub(" at ", "@")
    elseif eml == nil then
        eml = "unknown"
    end
    return eml
end

-- is it a leap year?
local function leapYear(year)
    if (year % 4 == 0) then
        if (year%100 == 0) then
            if (year %400 == 0) then
                return true
            end
        else
            return true
        end
        return false
    end
end

-- get the last day of the month
local function lastDayOfMonth(yyyy, mm)
    local ldom
    if mm == 2 and leapYear(yyyy) then
        ldom = 29
    else
        ldom = days[mm]
    end
    return ldom
end

return {
    anonymizeHdrs = anonymizeHdrs,
    anonymizeBody = anonymizeBody,
    anonymizeEmail = anonymizeEmail,
    extractCanonEmail = extractCanonEmail,
    findParent = findParent,
    leapYear = leapYear,
    lastDayOfMonth = lastDayOfMonth
}
