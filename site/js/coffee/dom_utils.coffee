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

###*
# HTML: DOM creator class
# args:
# - type: HTML element type (div, table, p etc) to produce
# - params: hash of element params to add (class, style etc)
# - children: optional child or children objects to insert into the new element
# Example:
# div = new HTML('div', {
#    class: "footer",
#    style: {
#        fontWeight: "bold"
#    }
#}, "Some text inside a div")
###



class HTML
    constructor: (type, params, children) ->
        ### create the raw element, or clone if passed an existing element ###
        if typeof type is 'object'
            @element = type.cloneNode()
        else
            @element = document.createElement(type)
        
        ### If params have been passed, set them ###
        if isHash(params)
            for key, val of params
                ### Standard string value? ###
                if typeof val is "string"
                    @element.setAttribute(key, val)
                else if isArray(val)
                    ### Are we passing a list of data to set? concatenate then ###
                    @element.setAttribute(key, val.join(" "))
                else if isHash(val)
                    ### Are we trying to set multiple sub elements, like a style? ###
                    for subkey,subval of val
                        @element[key][subkey] = subval
        
        ### If any children have been passed, add them to the element  ###
        if children
            ### If string, convert to textNode using txt() ###
            if typeof children is "string"
                @element.inject(txt(children))
            else
                ### If children is an array of elems, iterate and add ###
                if isArray children
                    for child in children
                        ### String? Convert via txt() then ###
                        if typeof child is "string"
                            @element.inject(txt(child))
                        else
                            ### Plain element, add normally ###
                            @element.inject(child)
                else
                    ### Just a single element, add it ###
                    @element.inject(children)
        return @element

### Set: shortcut for a.setAttribute(b,c) ###
set = (a, b, c) ->
    return a.setAttribute(b,c)

### txt: shortcut for creating a text node ###
txt = (a) ->
    return document.createTextNode(a)

### Get: Shortcut for doc.getElementById ###
get = (a) ->
    return document.getElementById(a)

###*
# prototype injector for HTML elements:
# Example: mydiv.inject(otherdiv)
###
HTMLElement.prototype.inject = (child) ->
    if isArray(child)
        for item in child
            # Convert to textNode if string
            if typeof item is 'string'
                item = txt(item)
            this.appendChild(item)
    else
        # Convert to textNode if string
        if typeof child is 'string'
            child = txt(child)
        this.appendChild(child)
    return child

###*
# prototype show/hide function for HTML elements:
# If called with a bool, show if True, hide if False.
# If no bool, toggle show/hide based on current state.
###
HTMLElement.prototype.show = (bool) ->
    d = 'block'
    # If no bool is provided, toggle show/hide based on current state
    if typeof bool is 'undefined'
        d = if this.style and this.style.display == 'none' then 'block' else 'none'
    else if bool == false
        # bool set to false, hide stuff
        d = 'none'
    else if bool == true
        # bool set to true, show stuff
        b = 'block'
    this.style.display = d
    return d

###*
# prototype for emptying an html element
###
HTMLElement.prototype.empty = () ->
    ndiv = this.cloneNode()
    this.parentNode.replaceChild(ndiv, this)
    return ndiv

### Cog: Loading panel for when waiting for a response ###
cog = (div, size = 200) ->
        idiv = mk('div', {
            class: "icon",
            style: {
                texAlign: 'center',
                verticalAlign: 'middle',
                height: '500px'
            }
        })
        
        i = mk('i', {
            class: 'fa fa-spin fa-cog',
            style: {
                fontSize: size + 'pt !important',
                color: '#AAB'
            }
        })
        idiv.inject([i, mk('br'), "Loading data, please wait..."])
        div.innerHTML = ""
        div.appendChild(idiv)
