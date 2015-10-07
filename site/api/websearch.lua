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

-- This is websearch.lua - a script for adding OpenSearch engines
local cross = require 'lib/cross'

function handle(r)
    local domain = r:escape_html(r.args)
    local scheme = "https"
    if r.port == 80 then
        scheme = "http"
    end
    local hostname = ("%s://%s:%u"):format(scheme, r.hostname, r.port)
    r.content_type = 'application/opensearchdescription+xml'
    r:puts(([[<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Pony Mail: %s</ShortName>
  <Description>Search for emails on the %s mailing lists</Description>
  <Tags>mailing lists, email</Tags>
  <Image height="16" width="16" type="image/vnd.microsoft.icon">%s/favicon.ico</Image>
  <Url type="text/html" template="%s/list.html?websearch={searchTerms}&amp;domain=%s&amp;utm_source=opensearch" />
  <Query role="example" searchTerms="cat" />
</OpenSearchDescription>
]]):format(domain, domain, hostname, hostname, domain))
    return cross.OK
end

cross.start(handle)