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

function setContentType(r, foo)
    if ngx and ngx.header then
        ngx.header['Content-Type'] = foo
    else
        r.content_type = foo
    end
end

apr = nil
pcall(function() apr = require 'apr' end)

function ngstart()
    if ngx then
        _G.apache2 = {
            OK = 0
        }
        local r = {
            puts = function(r, ...) ngx.say(...) end,
            write = function(r, ...) ngx.say(...) end,
            md5 = function(r, foo) return ngx.md5(foo) end,
            clock = ngx.time,
            parseargs = function() return ngx.req.get_uri_args() end,
            getcookie = function(r, name) return ngx.var['cookie_' .. name] end,
            setcookie = function(r, tbl)
                ngx.header["Set-Cookie"] = ("%s=%s; Path=/;"):format(tbl.key, tbl.value)
            end,
            unescape = function(r, foo) return ngx.unescape_uri(foo) end,
            sha1 = function(r, foo) return apr and apr.sha1(foo) or ngx.md5(foo) end,
            ivm_set = function(r, key, val) ngx.var['ivm_' .. key] = val end,
            ivm_get = function(r, key) return ngx.var['ivm_' .. key] end,
        }
        handle(r)
    end
end

return {
    contentType = setContentType,
    start = ngstart,
    OK = apache2 and apache2.OK or 0
}