###
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
###

####################################################
# This is http_utils.coffee: HTTP Request library  #
####################################################

# fetch: Fetches a URL.
# Params:
# - url: URL to fetch
# - xstate: JS state object to pass on to callback
# - callback: callback function to utilize the response
# - snap: optional callback if fetch fails (error 500)
# - nocreds: set to True to disable sending credentials (cookies etc)
# Example: fetch("/api/foo.lua", {pony: true}, callbackfunc, null, true)
fetch = (url, xstate, callback, snap, nocreds) ->
    xmlHttp = null;
    
    # Set up request object
    if window.XMLHttpRequest
        xmlHttp = new XMLHttpRequest();
    else
        xmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
    if not nocreds
        xmlHttp.withCredentials = true
    
    # GET URL
    xmlHttp.open("GET", url, true);
    xmlHttp.send(null);
    
    # Check for request state response change
    xmlHttp.onreadystatechange = (state) ->
            # Internal Server Error: Try to call snap
            if xmlHttp.readyState == 4 and xmlHttp.status == 500
                if snap
                    snap(xstate)
            # 200 OK, everything is okay, try to parse JSON response
            if xmlHttp.readyState == 4 and xmlHttp.status == 200
                if callback
                    # Try to parse as JSON and deal with cache objects, fall back to old style parse-and-pass
                    try
                        # Parse JSON response
                        response = JSON.parse(xmlHttp.responseText)
                        # If loginRequired (rare!), redirect to oauth page
                        if response && response.loginRequired
                            location.href = "/oauth.html"
                            return
                        # Otherwise, call the callback function
                        callback(response, xstate);
                    # JSON parse failed? Pass on the response as plain text then
                    catch e
                        callback(xmlHttp.responseText, xstate)
    return

# post: like fetch, but do a POST with standard text fields
# - url: URL to POST to
# - args: hash of keys/vals to convert into a POST request
# - xstate: state to pass on to callback
# - callback: calback function for response
# - snap: callback in case of error 500
post = (url, args, xstate, callback, snap) ->
    xmlHttp = null;
    # Set up request object
    if window.XMLHttpRequest
        xmlHttp = new XMLHttpRequest();
    else
        xmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
    xmlHttp.withCredentials = true
    
    # Construct form data string to POST.
    ar = []
    for k,v of args
        if v and v != ""
            ar.push(k + "=" + encodeURIComponent(v))
    fdata = ar.join("&")
    
    
    # POST URL
    xmlHttp.open("POST", url, true);
    xmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlHttp.send(fdata);
    
    # Check for response
    xmlHttp.onreadystatechange = (state) ->
            # Internal Server Error: call snap function
            if xmlHttp.readyState == 4 and xmlHttp.status == 500
                if snap
                    snap(xstate)
            # 200 Okay, parse response and run callback
            if xmlHttp.readyState == 4 and xmlHttp.status == 200
                if callback
                    # Try to parse as JSON and deal with cache objects, fall back to old style parse-and-pass
                    try
                        response = JSON.parse(xmlHttp.responseText)
                        callback(response, xstate);
                    # JSON parse failed? Try passing on as plain text
                    catch e
                        callback(xmlHttp.responseText, xstate)
    return

# postJSON: Same as post, but send vars as a JSON object
postJSON = (url, json, xstate, callback, snap) ->
    xmlHttp = null;
    # Set up request object
    if window.XMLHttpRequest
        xmlHttp = new XMLHttpRequest();
    else
        xmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
    xmlHttp.withCredentials = true
    
    # Construct form data
    fdata = JSON.stringify(json)
    
    # POST URL
    xmlHttp.open("POST", url, true);
    xmlHttp.setRequestHeader("Content-type", "application/json");
    xmlHttp.send(fdata);
    
    # Check for response
    xmlHttp.onreadystatechange = (state) ->
            # Internal Server Error: call snap!
            if xmlHttp.readyState == 4 and xmlHttp.status == 500
                if snap
                    snap(xstate)
                    
            # 200 Okay, parse response and pass to callback
            if xmlHttp.readyState == 4 and xmlHttp.status == 200
                if callback
                    # Try to parse as JSON and deal with cache objects, fall back to old style parse-and-pass
                    try
                        response = JSON.parse(xmlHttp.responseText)
                        callback(response, xstate);
                    # Fall back to plain text if parse failed
                    catch e
                        callback(xmlHttp.responseText, xstate)
    return
