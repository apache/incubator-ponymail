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
local default_doc = "mbox"

-- http code return check
-- N.B. if the index is closed, ES returns 403, but that may perhaps be true for other conditions
-- ES returns 404 if the index is missing.
function checkReturn(code)
    if not code or code == "closed" then
        -- code is called by top-level functions only, so level 3 is the external caller
        error("Could not contact database backend!", 3)
    else -- we have a valid code
        -- index returns 201 when an entry is created
        if code ~= 200 and code ~= 201 then
            error("Backend Database returned code " .. code .. "!", 3)
        end
    end
end

-- Standard ES query, returns $size results of any doc of type $doc, sorting by $sitem
function getHits(query, size, doc, sitem)
    doc = doc or "mbox"
    sitem = sitem or "epoch"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url .. doc .. "/_search?q="..query.."&sort=" .. sitem .. ":desc&size=" .. size
    local result, hc = http.request(url)
    checkReturn(hc)
    local json = JSON.decode(result)
    local out = {}
    if json and json.hits and json.hits.hits then
        for k, v in pairs(json.hits.hits) do
            v._source.request_id = v._id
            table.insert(out, v._source)
        end
    end
    return out
end

-- Get a single document
function getDoc (ty, id)
    local url = config.es_url  .. ty .. "/" .. id
    local result, hc = http.request(url)
    checkReturn(hc)
    local json = JSON.decode(result)
    if json and json._source then
        json._source.request_id = json._id
    end
    return (json and json._source) and json._source or {}
end

-- Get results (a'la getHits), but only return email headers, not the body
-- provides faster transport when we don't need everything
function getHeaders(query, size, doc)
    doc = doc or "mbox"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url  .. doc .. "/_search?_source_exclude=body&q="..query.."&sort=date:desc&size=" .. size
    local result, hc = http.request(url)
    checkReturn(hc)
    local json = JSON.decode(result)
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
function getHeadersReverse(query, size, doc)
    doc = doc or "mbox"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url .. doc .. "/_search?_source_exclude=body&q="..query.."&sort=epoch:desc&size=" .. size
    local result, hc = http.request(url)
    checkReturn(hc)
    local json = JSON.decode(result)
    local out = {}
    if json and json.hits and json.hits.hits then
        for k, v in pairs(json.hits.hits) do
            v._source.request_id = v._id
            table.insert(out, 1, v._source)
        end
    end
    return out
end

-- Do a raw ES query with a JSON query
function raw(query, doctype)
    local js = JSON.encode(query)
    doctype = doctype or default_doc
    local url = config.es_url .. doctype .. "/_search"
    local result, hc = http.request(url, js)
    checkReturn(hc)
    local json = JSON.decode(result)
    return json or {}, url
end


-- Raw query with scroll/scan
function scan(query, doctype)
    local js = JSON.encode(query)
    doctype = doctype or default_doc
    local url = config.es_url .. doctype .. "/_search?search_type=scan&scroll=1m"
    local result, hc = http.request(url, js)
    checkReturn(hc)
    local json = JSON.decode(result)
    if json and json._scroll_id then
        return json._scroll_id
    end
    return nil
end

function scroll(sid)
    -- We have to do some gsubbing here, as ES expects us to be at the root of the ES URL
    -- But in case we're being proxied, let's just cut off the last part of the URL
    local url = config.es_url:gsub("[^/]+/?$", "") .. "/_search/scroll?scroll=1m&scroll_id=" .. sid
    local result, hc = http.request(url)
    checkReturn(hc)
    local json = JSON.decode(result)
    if json and json._scroll_id then
        return json, json._scroll_id
    end
    return nil
end

-- Update a document
function update(doctype, id, query, consistency)
    local js = JSON.encode({doc = query })
    doctype = doctype or default_doc
    local url = config.es_url .. doctype .. "/" .. id .. "/_update"
    if consistency then
        url = url .. "?write_consistency=" .. consistency
    end
    local result, hc = http.request(url, js)
    checkReturn(hc)
    local json = JSON.decode(result)
    return json or {}, url
end

-- Put a new document somewhere
function index(r, id, ty, body, consistency)
    if not id then
        id = r:sha1(ty .. (math.random(1,99999999)*os.time()) .. ':' .. r:clock())
    end
    local url = config.es_url .. ty .. "/" .. id
    if consistency then
        url = url .. "?write_consistency=" .. consistency
    end
    local result, hc = http.request(url, body)
    checkReturn(hc)
    local json = JSON.decode(result)
    return json or {}
end

function setDefault(typ)
    default_doc = typ
end

-- module defs
return {
    find = getHits,
    findFast = getHeaders,
    findFastReverse = getHeadersReverse,
    get = getDoc,
    raw = raw,
    index = index,
    default = setDefault,
    update = update,
    scan = scan,
    scroll = scroll
}