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

-- This is elastic.lua - ElasticSearch library

local http = require 'socket.http'
local JSON = require 'cjson'
local config = require 'lib/config'
local mime = require 'mime'
local default_doc = "mbox"

-- http code return check
-- N.B. if the index is closed, ES returns 403, but that may perhaps be true for other conditions
-- ES returns 404 if the index is missing
-- ES also returns 404 if a document is missing
local function checkReturn(code, ok404)
    if type(code) == "number" then -- we have a valid HTTP status code
        -- ignore expected return codes here
        -- index returns 201 when an entry is created
        if code ~= 200 and code ~= 201 and not (ok404 and code == 404) then
            -- code is called by 2nd-level functions only, so level 4 is the external caller
            error("Backend Database returned code " .. code .. "!", 4)
        end
    else
        error("Could not contact database backend: " .. code .. "!", 4)
    end
end

-- DO common request processing:
-- Encode JSON (as necessary)
-- Issue request
-- Check return code
-- Decode JSON response
--
-- Parameters:
--  - url (required)
--  - query (optional); if this is a table it is decoded into JSON
--  - ok404 (optional); if true, then 404 is allowed as a status return
-- returns decoded JSON result
-- may throw an error if the request fails
-- Returns:
-- json, status code (i.e. 200,201 or 404)
local function performRequest(url, query, ok404) 
    local js = query
    if type(query) == "table" then
        js = JSON.encode(query)
    end
    local result, hc = http.request(url, js)
    checkReturn(hc, ok404)
    local json = JSON.decode(result)
    -- TODO should we return the http status code?
    -- This might be necessary if codes such as 404 did not cause an error
    return json, hc
end

-- Simple ES delete request
-- returns status code only
local function performDelete(url, ok404) 
    local _, hc = http.request{
    url = url,
    method = 'DELETE'
    }
    checkReturn(hc, ok404)
    return hc
end

-- Standard ES query, returns $size results of any doc of type $doc, sorting by $sitem
local function getHits(query, size, doc, sitem)
    doc = doc or "mbox"
    sitem = sitem or "epoch"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url .. doc .. "/_search?q="..query.."&sort=" .. sitem .. ":desc&size=" .. size
    local json = performRequest(url)
    local out = {}
    if json and json.hits and json.hits.hits then
        local hasBody = (doc == "mbox")
        for k, v in pairs(json.hits.hits) do
            v._source.request_id = v._id
            if hasBody and v._source.body == JSON.null then
                v._source.body = ''
            end
            table.insert(out, v._source)
        end
    end
    return out
end

-- Get a single document
local function getDoc (ty, id, ok404)
    local url = config.es_url  .. ty .. "/" .. id
    local json, status = performRequest(url, nil, ok404)
    if json and json._source then
        json._source.request_id = json._id
        if ty == "mbox" and json._source.body == JSON.null then
            json._source.body = ''
        end
        if ty == "mbox_source" then
            local src = json._source.source
            -- could it be base64 encoded?
            -- Unencoded source must contain at least one space; b64 does not
            if #src % 4 == 0 and src:find(' ') == nil then
                src = (mime.unb64(src))
                if src ~= nil then
                    json._source.source = src
                end
            end
        end
    end
    return (json and json._source) and json._source or {}, status
end

-- Get results (a'la getHits), but only return email headers, not the body
-- provides faster transport when we don't need everything
local function getHeaders(query, size, doc)
    doc = doc or "mbox"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url  .. doc .. "/_search?_source_exclude=body&q="..query.."&sort=epoch:desc&size=" .. size
    local json = performRequest(url)
    local out = {}
    if json and json.hits and json.hits.hits then
        for k, v in pairs(json.hits.hits) do
            v._source.request_id = v._id
            table.insert(out, v._source)
        end
    end
    return out
end

-- Same as above, but reverse return order
local function getHeadersReverse(query, size, doc)
    doc = doc or "mbox"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url .. doc .. "/_search?_source_exclude=body&q="..query.."&sort=epoch:desc&size=" .. size
    local json = performRequest(url)
    local out = {}
    if json and json.hits and json.hits.hits then
        for k, v in pairs(json.hits.hits) do
            v._source.request_id = v._id
            table.insert(out, 1, v._source)
        end
    end
    return out
end

local function contains(table,value)
    if table then
        for _,v in pairs(table) do
            if v == value then return true end
        end
    end
    return false
end

-- Do a raw ES query with a JSON query
local function raw(query, doctype)
    doctype = doctype or default_doc
    local url = config.es_url .. doctype .. "/_search"
    local json = performRequest(url, query)
    if doctype == "mbox" and json and json.hits and json.hits.hits then
        -- Check if the query returns the body attribute
        if contains(query._source, 'body') then
            local dhh = json.hits.hits
            for k = 1, #dhh do
                local v = dhh[k]._source
                if v.body == JSON.null then
                    v.body = ''
                end
            end
        end
    end
    return json or {}, url
end

-- communicate between scroll calls
local queryHasBody = {}

--[[
Raw query with scroll
Parameters:
   sidOrQuery - if table, then this is the initial query, otherwise it is the sid
   doctype - optional document type, only relevant for initial query

Returns:
   json, sid
]]
local function scroll(sidOrQuery, doctype)
    local json
    local hasBody = false
    if type(sidOrQuery) == 'table' then
        local query = sidOrQuery
        doctype = doctype or default_doc
        if doctype == "mbox" then
            -- Check if the query returns the body attribute
            if contains(query._source, 'body') then
                hasBody = true
            end
        end
        local url = config.es_url .. doctype .. "/_search?scroll=1m"
        -- start off the scroll
        json = performRequest(url, query)
    else
        local sid = sidOrQuery
        hasBody = queryHasBody[sid]
        queryHasBody[sid] = nil -- drop old entry (sid may change)
        -- We have to do some gsubbing here, as ES expects us to be at the root of the ES URL
        -- But in case we're being proxied, let's just cut off the last part of the URL
        local url = config.es_url:gsub("[^/]+/?$", "") .. "/_search/scroll?scroll=1m&scroll_id=" .. sid
        -- continue the scroll
        json = performRequest(url)
    end
    if hasBody then
        -- propagate the setting for the next call
        queryHasBody[json._scroll_id] = true
        local dhh = json.hits.hits
        for k = 1, #dhh do
            local v = dhh[k]._source
            if v.body == JSON.null then
                v.body = ''
            end
        end
    end
    return json, json._scroll_id
end

-- delete a scroll id after use
local function clear_scroll(sid)
    local url = config.es_url:gsub("[^/]+/?$", "") .. "/_search/scroll?scroll_id=" .. sid
    return performDelete(url, true)
end

-- Update a document
local function update(doctype, id, query, consistency)
    doctype = doctype or default_doc
    local url = config.es_url .. doctype .. "/" .. id .. "/_update"
    if consistency then
        url = url .. "?write_consistency=" .. consistency
    end
    local json = performRequest(url, {doc = query })
    return json or {}, url
end

-- Put a new document somewhere
local function index(id, ty, body, consistency)
    if not id then
        error("id parameter must be provided", 3)
    end
    local url = config.es_url .. ty .. "/" .. id
    if consistency then
        url = url .. "?write_consistency=" .. consistency
    end
    local json = performRequest(url, body)
    return json or {}
end

local function setDefault(typ)
    default_doc = typ
end

-- module defs
return {
    -- maximum results that can be returned by a query
    -- above this number, must use scrolling or search_after (ES 5.x)
    MAX_RESULT_WINDOW = 10000,
    find = getHits,
    findFast = getHeaders,
    findFastReverse = getHeadersReverse,
    get = getDoc,
    raw = raw,
    index = index,
    default = setDefault,
    update = update,
    scroll = scroll,
    clear_scroll = clear_scroll
}