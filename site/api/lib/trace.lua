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

--[[
Simple trace facility for local debugging.
Shows a message together with its location.
Output is to stderr as that should appear in the server logs

N.B. This is intended as a handy tool for local use only;
not intended for use in deployed code.

Usage:

import 'lib/trace'

...

whereami()

...

trace("Status: " .. status)

]]--

-- show calling location details
function _whereami(depth)
    depth = depth or 0
    local data = debug.getinfo(2+depth,"Snl")
    return data.short_src:gsub('^.+/','') .. "#" .. (data.name or '') .. "@" .. data.currentline .. ": "
end

function trace(s, depth)
     depth = depth or 0
    -- Use a leading marker to make it easier to find in the logs
     io.stderr:write("@(#) " .. _whereami(1+depth) .. tostring(s) .. "\n")
end

--[[
debug.getinfo output
{ "S"
  lastlinedefined = 0,
  linedefined = 0,
  short_src = "../test/stack.lua",
  source = "@../test/stack.lua",
  what = "main"
}
{ "n"
  name = "one",
  namewhat = "global"
}
{ "l"
  currentline = 12
}
]]--
