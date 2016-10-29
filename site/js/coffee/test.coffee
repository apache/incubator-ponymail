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

testCoffee = () ->
    ### Get main div from HTML ###
    parent = get('testdiv')
    
    # Make the top menu
    menu = new HTML('div', { id: "topMenu"})
    parent.inject(menu)
    
    # Add menu points
    ul = new HTML('ul')
    
    # Add logo first
    logo = new HTML('li', {
        class: 'logo'
    }, new HTML('a', {
        href: "./"
    }, new HTML('img', {
        src: "images/logo.png",
        style: {
            paddingRight: "10px",
            height: "38px",
            width: "auto"
        }
    })))
    ul.inject(logo)
    
    # Menu points
    for item in ['Home', 'Lists', 'Third item']
        li = new HTML('li', {}, item)
        ul.inject(li)
    menu.inject(ul)
    
    # Make a div
    div = new HTML('div', { class: "sbox"})
    parent.inject(div)
    
    # Make a calendar test
    cal = new Calendar('2010-5', '2016-9')
    div.inject(cal)
    
    # Make a paragraph with some text in it
    p = new HTML('p', { class: "foo", style: { textAlign: 'center'}}, "Text goes here")
    
    # Inject paragraph into div
    div.inject(p)
    
    # Add some plain text and a break
    p.inject([". Here's a textNode added afterwards", new HTML('br')])
    
    # Make an object we can hide when clicked on, using the show() prototype
    hider = new HTML('b', { onclick: 'testToggle(this);'}, "Click here to hide this text for a second!")
    p.inject(hider)
    
    
testToggle = (div) ->
    div.show()
    window.setTimeout(
        () ->
            div.show()
        ,1000)
