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

# HTTPRequest: Fire off a HTTP request.
# Args:
# - url: The URL to request (may be relative or absolute)
# - args:
# - - state: A callback stateful object
# - - data: Any form/JSON data to send along if POST (method is derived
#           from whether data is attached or not)
# - - getdata: Any form vars to append to the URL as URI-encoded formdata
# - - datatype: 'form' or 'json' data?
# - - callback: function to call when request has returned a response
# - - snap: snap function in case of internal server error or similar
# - - nocreds: don't pass on cookies?
class HTTPRequest
    constructor = (@url, @args) ->
        @state = @args.state
        @method = if @args.data then 'POST' else 'GET'
        @data = @args.data
        @getdata = @args.get
        @datatype = @args.datatype || 'form'
        @callback = @args.callback
        @snap = @args.snap || pm_snap
        @nocreds = @args.nocreds || false
        
        # Construct request object
        if window.XMLHttpRequest
            @request = new XMLHttpRequest();
        else
            @request = new ActiveXObject("Microsoft.XMLHTTP");
        
        # Default to sending credentials
        if not @nocreds
            @request.withCredentials = true
        
        # Determine what to send as data (if anything)
        @rdata = null
        if @method is 'POST'
            if @datatype == 'json'
                @rdata = JSON.stringify(@data)
            else
                @rdata = @formdata(@data)
                
        # If tasked with appending data to the URL, do so
        if @getdata
            tmp = @formdata(@getdata)
            if tmp.length > 0
                # Do we have form data here aleady? if so, append the new
                # by adding an ampersand first
                if @url.match(/\?/)
                    @url += "&" + tmp
                # No form data yet, add a ? and then the data
                else
                    @url += "?" + tmp
                
        # Use @method on URL
        @requestobj.open(@method, @url, true)
        
        # Send data
        @requestobj.send(@rdata)
        
        # Set onChange behavior
        @requestobj.onreadystatechange = @onchange
        
        # all done!
        
    onchange = () ->
            # Internal Server Error: Try to call snap
            if @requestobj.readyState == 4 and @requestobj.status == 500
                if @snap
                    @snap(@state)
            # 200 OK, everything is okay, try to parse JSON response
            if @requestobj.readyState == 4 and @requestobj.status == 200
                if @callback
                    # Try to parse as JSON and deal with cache objects, fall back to old style parse-and-pass
                    try
                        # Parse JSON response
                        @response = JSON.parse(xmlHttp.responseText)
                        # If loginRequired (rare!), redirect to oauth page
                        if @response && @response.loginRequired
                            location.href = "/oauth.html"
                            return
                        # Otherwise, call the callback function
                        @callback(@response, @state);
                    # JSON parse failed? Pass on the response as plain text then
                    catch e
                        @callback(@requestobj.responseText, @state)
        
    # Standard form data joiner for POST data
    formdata = (kv) ->
        ar = []
        # For each key/value pair
        for k,v of kv
            # Only append if the value is non-empty
            if v and v != ""
                # URI-Encode value and add to an array
                ar.push(k + "=" + encodeURIComponent(v))
        # Join the array with ampersands, so we get "foo=bar&foo2=baz"
        return ar.join("&")
