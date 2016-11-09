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

-- Test script for http.socket showing different response types

local http = require 'socket.http'

--[[
    The luasock library is documented at:
    http://w3.impa.br/~diego/software/luasocket/http.html#request
    This gives the following information on the returned values:

    #: On Success        On Failure
    1: body (string)     nil
    2: code (number)     message (string)
    3: headers (table)   nil
    4: status line       nil

]]--

function runRequest(url, query)
    print("=========", url, query)
    local response = {http.request(url, query)} -- pick up all the response
    print("#values: ",#response)
    for i = 1,#response do
        local v = response[i]
        if i == 2 or i == 4 then
            print(i,type(v),v)
        else
            print(i,type(v),#(v or ""))
            if i == 3 and type(v) == "table" then
                for k,v in pairs(v) do
                    print("",k,v)
                end
            end
            if i == 1 and v then
                print(v:sub(1,math.min(132,#v)))
            end
        end
    end
    local hc = response[2]
    if hc ~= 200 then -- show the error message
        print(response[1])
    end
end

--runRequest("http://wrong.host.invalid/")
--
--runRequest("http://localhost:92000/ponymail/")
--
runRequest("http://localhost:9200/_cat/indices") -- valid
runRequest("http://localhost:9200/_dog/indices") -- invalid
runRequest("http://localhost:92000/_cat/indices") -- port invalid

if #arg >0 then
    runRequest(unpack(arg))
end
