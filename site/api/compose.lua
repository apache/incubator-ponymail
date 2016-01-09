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
local cross = require 'lib/cross'


function handle(r)
    local account = user.get(r)
    r.content_type = "application/json"
    
    -- make sure the user is logged in
    if account and account.cid then
        -- parse response, up to 1MB of it. if >1MB, we're gonna pretend we never saw anything ;)
        local post = r:parsebody(1024*1024)
        
        -- check that recipient, subject and body exists
        if post.to and post.subject and post.body then
            -- validate recipient
            to = ("<%s>"):format(post.to)
            local fp, lp = post.to:match("([^@]+)@([^@]+)")
            local domainIsOkay = false
            
            -- check that recipient is whitelisted in config.lua
            if type(config.accepted_domains) == "string" then
                if r.strcmp_match(lp, config.accepted_domains) or config.accepted_domains == "*" then
                    domainIsOkay = true
                end
            elseif type(config.accepted_domains) == "table" then
                for k, ad in pairs(config.accepted_domains) do
                    if r.strcmp_match(lp, ad) or ad == "*" then
                        domainIsOkay = true
                        break
                    end
                end
            end
            
            -- if we can send, then...
            if domainIsOkay then
                -- find user's full name
                local fname = nil
                if account.preferences then
                    fname = account.preferences.fullname
                end
                -- construct sender name+address
                local fr = ([["%s"<%s>]]):format(fname or account.credentials.fullname, account.credentials.email)
                
                -- standard headers + headers we need ourselves for parsing in the archiver (notifications etc)
                local headers = {
                    ['X-PonyMail-Sender'] = r:sha1(account.cid),
                    ['X-PonyMail-Agent'] = "PonyMail Composer/0.2",
                    ['message-id'] = ("<pony-%s-%s@%s>"):format(r:sha1(account.cid), r:sha1(r:clock() .. os.time() .. r.useragent_ip), post.to:gsub("@", ".")),
                    to = to,
                    subject = post.subject,
                    from = fr,
                }
                
                -- set references and IRT if need be
                if post['references'] then
                    headers['references'] = post['references']
                end
                if post['in-reply-to'] then
                    headers['in-reply-to'] = post['in-reply-to']
                end
                local msgbody = post.body
                
                -- set an email footer if specified in config.lua
                if config.email_footer then
                    local subs = {
                        list = to:gsub("[<>]", ""),
                        domain = r.hostname,
                        port = r.port,
                        msgid = headers['message-id']
                    }
                    msgbody = msgbody .. "\n" .. config.email_footer:gsub("$([a-z]+)", function(a) return subs[a] or a end)
                end
                
                -- construct the smtp object
                local source = smtp.message{
                        headers = headers,
                        body = msgbody
                    }
                
                -- send email!
                local rv, er = smtp.send{
                    from = fr,
                    rcpt = to,
                    source = source,
                    server = config.mailserver
                }
                
                -- let the user know what happened
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
                    error = "Invalid or missing headers",
                    headers = post
                })
        end
    else
        r:puts[[{"error": "You need to be logged in before you can send emails"}]]
    end
    return cross.OK
end

cross.start(handle)