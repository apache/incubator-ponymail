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


###*
# Pending URLs watcher:
# Watches which URLs have been pending a result for a while
# and shows the spinner if things are taking too long.
###
pending_url_operations = {}
pending_spinner_at = 0

spinCheck = (div, reset) ->
    if div.style.display == "block"
        spnow = new Date().getTime()
        if reset or (spnow - pending_spinner_at) >= 4000
            pending_spinner_at = spnow
            ndiv = div.cloneNode(true)
            #ndiv.addEventListener('animationend', (e) -> spinCheck(ndiv))
            div.parentNode.replaceChild(ndiv, div)
    else
        pending_spinner_at = 0
    
pendingURLStatus = () ->
    pending = 0
    spnow = new Date().getTime()
    div = get('loading')
    for url, time of pending_url_operations
        ### Is something taking too long?? ###
        if (spnow - time) > 1500
            pending++
            if not div
                div = new HTML('div', {
                    id: 'loading'
                    class: "spinner"
                    },
                    [
                        new HTML('div', {class: "spinwheel"},
                                 new HTML('div', {class:"spinwheel_md"},
                                          new HTML('div', {class:"spinwheel_sm"}))),
                        new HTML('br'),
                        "Loading, please wait..."
                    ]
                )
                document.body.inject(div)
                pending_spinner_at = spnow
                div.addEventListener('animationend', (e) -> spinCheck(div))
                
    
    ### If no pending operations, hide the spnner ###
    if pending == 0
        div = get('loading')
        if div
            div.style.display = "none"
    else if div and div.style.display == "none"
        div.style.display = "block"
        if pending_spinner_at == 0
            pending_spinner_at = spnow
            spinCheck(div, true)
        

window.setInterval(pendingURLStatus, 500)


###*
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

# Example POST request:
#    HTTPRequest("/api/foo.lua", {
#        state: {
#            ponies: true
#        },
#        callback: foofunc,
#        data: {
#            list: "foo.bar"
#        }
#   })
###


class HTTPRequest
    constructor: (@url, @args) ->
        ### Set internal class data, determine request type ###
        @state = @args.state
        @method = if @args.data then 'POST' else 'GET'
        @data = @args.data
        @getdata = @args.get
        @datatype = @args.datatype || 'form'
        @callback = @args.callback
        @snap = @args.snap || pm_snap
        @nocreds = @args.nocreds || false
        @uid = parseInt(Math.random()*10000000).toString(16)
        
        ### Construct request object ###
        if window.XMLHttpRequest
            @request = new XMLHttpRequest();
        else
            @request = new ActiveXObject("Microsoft.XMLHTTP");
        
        ### Default to sending credentials ###
        if not @nocreds
            @request.withCredentials = true
        
        ### Determine what to send as data (if anything) ###
        @rdata = null
        if @method is 'POST'
            if @datatype == 'json'
                @rdata = JSON.stringify(@data)
            else
                @rdata = @formdata(@data)
                
        ### If tasked with appending data to the URL, do so ###
        if isHash(@getdata)
            tmp = @formdata(@getdata)
            if tmp.length > 0
                ### Do we have form data here aleady? if so, append the new ###
                ### by adding an ampersand first ###
                if @url.match(/\?/)
                    @url += "&" + tmp
                #### No form data yet, add a ? and then the data ###
                else
                    @url += "?" + tmp
                
        ### Mark operation as pending result ###
        pending_url_operations[@uid] = new Date().getTime()
        
        ### Use @method on URL ###
        @request.open(@method, @url, true)
        
        ### Send data ###
        @request.send(@rdata)
        
        
        ### Set onChange behavior ###
        r = this
        @request.onreadystatechange = () -> r.onchange()
        
    onchange: () ->
        ### Mark operation as done ###
        if @request.readyState == 4
            delete pending_url_operations[@uid]
            
        ### Internal Server Error: Try to call snap ###
        if @request.readyState == 4 and @request.status == 500
            if @snap
                @snap(@state)
                
        ### 200 OK, everything is okay, try to parse JSON response ###
        if @request.readyState == 4 and @request.status == 200
            if @callback
                ### Try to parse as JSON and deal with cache objects, fall back to old style parse-and-pass ###
                try
                    ### Parse JSON response ###
                    @response = JSON.parse(@request.responseText)
                    ### If loginRequired (rare!), redirect to oauth page ###
                    if @response && @response.loginRequired
                        location.href = "/oauth.html"
                        return
                    ### Otherwise, call the callback function ###
                    @callback(@response, @state);
                #### JSON parse failed? Pass on the response as plain text then ###
                catch e
                    console.log("Callback failed: " + e)
                    @callback(JSON.parse(@request.responseText), @state)
        
    ### Standard form data joiner for POST data ###
    formdata: (kv) ->
        ar = []
        ### For each key/value pair (assuming this is a hash) ###
        if isHash(kv)
            for k,v of kv
                ### Only append if the value is non-empty ###
                if v and v != ""
                    ###  URI-Encode value and add to an array ###
                    ar.push(k + "=" + encodeURIComponent(v))
        ### Join the array with ampersands, so we get "foo=bar&foo2=baz" ###
        return ar.join("&")

pm_snap = null
