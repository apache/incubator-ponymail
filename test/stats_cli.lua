#!/usr/bin/env lua

-- Allow CLI testing of stats.lua query parameters
-- Invoke with pairs of parameters, being the key and value, e.g.
-- lua test_stats.lua list dev domain ponymail.apache.org q 'a/b' d lte=1y
-- set MODE=inspect to print output query from inspect, otherwise print as JSON suitable for further processing

-- Update path so we can always find the api/*.lua scripts
local self=arg[0] or './dummy' -- get path to self
local pfx=self:match("^.*/") or "" -- extract the path
-- finally update package path (also adding current dir)
package.path = package.path .. ";" .. pfx .. "../site/api/?.lua"   -- path to api dir
package.path = package.path .. ";" .. pfx .. "/?.lua" -- current dir

local inspect = require 'inspect'
local http = require 'socket.http'
local mock = require 'mock_r'
local JSON = require 'cjson'
require 'stats' -- local makes no difference here

local _CACHE = {} -- capture output

-- override http request so can capture the query
http.request = function(url, data)
  -- capture HTTP parameters (assume only called once)
  _CACHE.url = url
  _CACHE.querydata = JSON.decode(data)
  -- return simplest result that satisfies stats.lua
  result = [[
{
  "hits" : {
  "total" : 0,
  "hits" : [ ]
  }
}
]]
  return result, 200
end


local r = mock.r

-- disable years active check
r.ivm_get = function(r, key)
  return JSON.encode({ pubfirst = 0, publast = 0})
end

-- collect output (assume only one call to puts)
r.puts = function(r, ...) _CACHE.reply = JSON.decode(...) end

-- TODO
r.escape_html = function(r, val)
  -- < > & are definitely escaped by the real escape_html
  return val:gsub('>', '&gt;'):gsub('<', '&lt;'):gsub('&', '&amp;')
end

-- override the parse-args function so it returns our test data
r.parseargs = function(r)
  return _CACHE.args
end


local function test(args)
  local output = {
    quick = true, -- disable most queries
  }
  -- merge in user data
  for k,v in pairs(args) do output[k] = v end  
  _CACHE.args = output -- save the args
  _CACHE.status = handle(r)
  return _CACHE
end

local argc = #arg
if argc % 2 == 0
then
  local data = {}
  for i = 1,argc,2 do
    data[arg[i]] = arg[i+1]
  end
  res = test(data)
  if os.getenv("MODE") == "inspect" then
    print(inspect(res["querydata"]))
  else
    print(JSON.encode(res))
  end
else
  print("Need even arg count")
end
