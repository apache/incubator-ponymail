local http = require 'socket.http'
local JSON = require 'cjson'
local config = require 'lib/config'

function getHits(query, size, doc)
    doc = doc or "ponymail_alpha"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url .. "_search?q="..query.."&sort=date:desc&size=" .. size
    local result = http.request(url)
    local out = {}
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


function getDoc (ty, id)
    local url = config.es_url  .. ty .. "/" .. id
    local result = http.request(url)
    local out = {}
    local json = JSON.decode(result)
    return (json and json._source) and json._source or {}
end

function getHeaders(query, size, doc)
    doc = doc or "ponymail_alpha"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url  .. doc .. "/_search?_source_exclude=body&q="..query.."&sort=date:desc&size=" .. size
    local result = http.request(url)
    local out = {}
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

function getHeadersReverse(query, size, doc)
    doc = doc or "ponymail_alpha"
    size = size or 10
    query = query:gsub(" ", "+")
    local url = config.es_url .. doc .. "/_search?_source_exclude=body&q="..query.."&sort=date:desc&size=" .. size
    local result = http.request(url)
    local out = {}
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

function raw(query)
    local js = JSON.encode(query)
    local url = config.es_url .. "_search"
    local result = http.request(url, js)
    local out = {}
    local json = JSON.decode(result)
    return json or {}
end

function index(r, id, ty, body)
    local js = JSON.encode(query)
    if not id then
        id = r:sha1(ty .. (math.random(1,99999999)*os.time()) .. ':' .. r:clock())
    end
    local url = config.es_url .. ty .. "/" .. id
    local result = http.request(url, body)
    local out = {}
    local json = JSON.decode(result)
    return json or {}
end

return {
    find = getHits,
    findFast = getHeaders,
    findFastReverse = getHeadersReverse,
    get = getDoc,
    raw = raw,
    index = index
}