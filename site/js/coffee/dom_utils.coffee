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
# This is dom_utils.coffee: DOM handling utilities #
####################################################

# mk: DOM creator
# args:
# - type: HTML element type (div, table, p etc) to produce
# - params: hash of element params to add (class, style etc)
# - children: optional child or children objects to insert into the new element
# Example: mk('div', { class: "footer", style: {fontWeight: "bold"}}, "Some text inside a div")
mk = (type, params, children) ->
    # create the raw element
    r = document.createElement(type)
    
    # If params have been passed, set them
    if params
        for k, v of params
            # Standard string value?
            if typeof v is "string"
                r.setAttribute(k, v)
            # Are we passing a list of data to set? concatenate then
            else if isArray(v)
                r.setAttribute(k, v.join(" "))
            # Are we trying to set multiple sub elements, like a style?
            else if typeof(v) is "object"
                for x,y of v
                    r[k][x] = y
    
    # If any children have been passed, add them to the element 
    if children
        # If string, convert to textNode using txt()
        if typeof children is "string"
            app(r, txt(children))
        else
            # If children is an array of elems, iterate and add
            if isArray children
                for k in children
                    # String? Convert via txt() then
                    if typeof k is "string"
                        app(r, txt(k))
                    # Plain element, add normally
                    else
                        app(r, k)
            # Just a single element, add it
            else
                app(r, children)
    return r

# App: Shortcut for document.appendChild with modifications
# - a: the element to add things to
# - b: one or more elements to add.
# Example: app(get('mydiv'), "Add some text to mydiv")
app = (a,b) ->
    # If it's a list of elems, iterate
    if isArray b
        for item in b
            # String? Convert to textNode first then
            if typeof item is "string"
                item = txt(item)
            # Otherwise just add it
            a.appendChild(item)
    # Otherwise, just add
    else
        # String? Convert first
        if typeof b is "string"
            a.appendChild(txt(b))
        # Not a string, add normally
        return a.appendChild(b)


# Set: shortcut for a.setAttribute(b,c)
set = (a, b, c) ->
    return a.setAttribute(b,c)

# txt: shortcut for creating a text node
txt = (a) ->
    return document.createTextNode(a)

# Get: Shortcut for doc.getElementById
get = (a) ->
    return document.getElementById(a)


# Cog: Loading panel for when waiting for a response
cog = (div, size = 200) ->
        idiv = mk('div', { class: "icon", style: {
            texAlign: 'center',
            verticalAlign: 'middle',
            height: '500px'
            }
        )
        
        i = mk('i', { class: 'fa fa-spin fa-cog', style: {
            fontSize: size+'pt !important',
            color: '#AAB'
            }
        )
        app(idiv, [i, mk('br'), "Loading data, please wait..."])
        div.innerHTML = ""
        div.appendChild(idiv)
