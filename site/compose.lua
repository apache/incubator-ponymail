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

-- This is compose.lua - a script for sending replies or new topics to lists

local JSON = require 'cjson'
local elastic = require 'lib/elastic'
local user = require 'lib/user'
local config = require 'lib/config'
local smtp = require 'socket.smtp'

function handle(r)
    local account = user.get(r)
    r.content_type = "application/json"
    
    if account and account.cid then
        local post = r:parsebody(1024*1024)
        if post.to and post.subject and post.body then
            to = ("<%s>"):format(post.to)
            local fp, lp = post.to:match("([^@]+)@([^@]+)")
            if config.accepted_domains == lp:lower() or config.accepted_domains == "*" then
                local fr = ([[%s<%s>]]):format(account.credentials.fullname, account.credentials.email)
                local headers = {
                    ['x-ponymail-sender'] = r:sha1(account.cid),
                    ['message-id'] = ("<pony-%s-%s@%s>"):format(r:sha1(account.cid), r:sha1(r:clock() .. os.time() .. r.useragent_ip), post.to),
                    to = to,
                    subject = post.subject,
                    from = fr,
                }
                if post['references'] then
                    headers['references'] = post['references']
                end
                if post['in-reply-to'] then
                    headers['in-reply-to'] = post['in-reply-to']
                end
                local source = smtp.message{
                        headers = headers,
                        body = post.body
                    }
                local rv, er = smtp.send{
                    from = fr,
                    rcpt = to,
                    source = source,
                    server = config.mailserver
                }
                
                r:puts(JSON.encode{
                    result = rv,
                    error = er,
                    src = headers
                })
            else
                r:puts(JSON.encode{
                    error = "Invalid recipient specified."
                })
            end
        else
            r:puts(JSON.encode{
                    error = "Invalid or missing headers"
                })
        end
    else
        r:puts[[{"error": "You need to be logged in before you can send emails"}]]
    end
end