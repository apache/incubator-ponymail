/*
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
*/



// traverseThread: finds all child divs inside an object
function traverseThread(child, name, type) {
    if (!child) {
        return
    }
    // Default to looking for DIV types if nothing else is specified
    // but we'll happily look for any type...really!
    type = type ? type : 'DIV'
    
    // for each child in this object...
    for (var i in child.childNodes) {
        // Matching type?
        if (child.childNodes[i].nodeType && child.childNodes[i].nodeType == 1 && child.childNodes[i].nodeName == type) {
            // Right ID? Or are we maybe just looking for ANY object of this type?
            if (!name || (child.childNodes[i].getAttribute("id") && child.childNodes[i].getAttribute("id").search(name) != -1)) {
                // Found one! append to the big result list in the sky
                kiddos.push(child.childNodes[i])
            }
        }
        // Does this object have children? If so, let's traverse those as well
        if (child.childNodes[i].nodeType && child.childNodes[i].hasChildNodes()) {
            traverseThread(child.childNodes[i], name, type)
        }
    }

}


// toggleView: show/hide a DOM object
function toggleView(el) {
    var obj = document.getElementById(el)
    if (obj) {
        // assuming display is either 'none' or 'block', we simply reverse it.
        obj.style.display = (obj.style.display == 'none') ? 'block' : 'none'
    }
}



// sortByDate: reshuffle a threaded display into a flat display, sorted by date
function sortByDate(tid) {
    kiddos = []
    var t = document.getElementById("thread_" + tid)
    var h = document.getElementById("helper_" + tid)
    if (t) {
        // fetch all elements called 'thread*' inside t
        traverseThread(t, 'thread')
        
        // sort the node array:
        // forward
        if (prefs.sortOrder == 'forward') {
            kiddos.sort(function(a, b) {
                return parseInt(b.getAttribute('epoch') - a.getAttribute('epoch'));
            })
        // backward
        } else {
            kiddos.sort(function(a, b) {
                return parseInt(a.getAttribute('epoch') - b.getAttribute('epoch'));
            })
        }
        
        // do some DOM magic, repositioning according to sort order
        for (var i in kiddos) {
            t.insertBefore(kiddos[i], t.firstChild)
        }
    }
}


// generateFormDivs: helper func for making form elements
function generateFormDivs(id, title, type, options, selval) {
    
    // Make a parent div that holds the title and input field
    var mf = document.createElement('div')
    mf.setAttribute('id', "main_form_" + id)
    mf.style.margin = "10px"
    mf.style.padding = "10px"
    
    // title div to the left
    var td = document.createElement('div')
    td.style.width = "300px"
    td.style.float = "left"
    td.style.fontWeight = "bold"
    td.appendChild(document.createTextNode(title))
    mf.appendChild(td)
    
    // input field to the right
    var td2 = document.createElement('div')
    td2.style.width = "200px"
    td2.style.float = "left"
    
    // <select> object?
    if (type == 'select') {
        var sel = document.createElement('select')
        sel.setAttribute("name", id)
        sel.setAttribute("id", id)
        // add all options as <option> elements
        for (var key in options) {
            var opt = document.createElement('option')
            // array?
            if (typeof key == "string") {
                opt.setAttribute("value", key)
                if (key == selval) {
                    opt.setAttribute("selected", "selected")
                }
            // hash?
            } else {
                if (options[key] == selval) {
                    opt.setAttribute("selected", "selected")
                }
            }
            opt.text = options[key]
            sel.appendChild(opt)
        }
        td2.appendChild(sel)
    }
    // (unknown?) <input> element
    if (type == 'input') {
        var inp = document.createElement('input')
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.setAttribute("value", options)
        td2.appendChild(inp)
    }
    // <input type='text'> element
    if (type == 'text') {
        var inp = document.createElement('input')
        inp.setAttribute("type", "text")
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.setAttribute("value", options)
        td2.appendChild(inp)
    }
    
    // check box
    if (type == 'checkbox') {
        var inp = document.createElement('input')
        inp.setAttribute("type", "checkbox")
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.checked = options
        td2.appendChild(inp)
    }
    
    // add to parent, return parent div
    mf.appendChild(td2)
    return mf
}


// func for rolling up an email to its immediate parent, hiding emails between that
function rollup(mid) {
    var obj = document.getElementById('thread_' + mid)
    if (obj) {
        // changes var makes sure we only change the rollup icon if changes occured,
        // that is to say, if the page actually changed its looks (hid/showed emails).
        var changes = 0
        
        // default to the downwards facing icon, that's the target icon mostly
        var glyph = "down"
        var parent = obj.parentNode
        // for each email in this specific sub-thread...
        for (var i in parent.childNodes) {
            var node = parent.childNodes[i]
            if (node.nodeType && node.nodeType == 1 && node.nodeName == 'DIV') {
                // if we've reached the current email, we'll stop.
                // we only want to hide emails _before_ that.
                if (node.getAttribute && node.getAttribute("id") && node.getAttribute("id").search(mid) != -1) {
                    break
                // otherwise, if valid email or div or whatever, HIDE IT!..or show it, depending.
                } else if (node.getAttribute("id")) {
                    // reverse opacity
                    node.style.display = (node.style.display == "none") ? "block" : "none"
                    glyph = (node.style.display == "none") ? "down" : "up"
                    changes++ // mark that we've made a visible change here
                }
            }
        }
        // Did we process changes to the DOM? If so, change the glyph
        if (changes > 0) {
            var robj = document.getElementById('rollup_' + mid)
            robj.setAttribute("class", "glyphicon glyphicon-chevron-" + glyph)
        }
        
    }
}

// Check the entire DOM tree for elements with 'epoch' key set to this epoch.
function findEpoch(epoch) {
    kiddos = []
    traverseThread(document.body)
    for (var i in kiddos) {
        if (kiddos[i].hasAttribute('epoch') && parseInt(kiddos[i].getAttribute('epoch')) == epoch) {
            return kiddos[i]
        }
    }
    return null
}

// popup reminder shutoff mechanism
function setPopup(pid, close) {
    if (typeof(window.localStorage) !== "undefined") {
        window.localStorage.setItem("popup_reminder_" + pid, close)
    }
}


// Pop-up message display thingy. Used for saying "email sent...I think!"
function popup(title, body, timeout, pid) {
    var obj = document.getElementById('popupper')
    if (pid) {
        if (typeof(window.localStorage) !== "undefined") {
            var popre = window.localStorage.getItem("popup_reminder_" + pid)
            if (popre) {
                return
            }
        }
    }
    if (obj) {
        obj.innerHTML = ""
        obj.style.display = 'block'
        obj.innerHTML = "<h3>" + title + "</h3><p>" + body + "</p><p><a class='btn btn-success' href='javascript:void(0);' onclick='toggleView(\"popupper\")'>Got it!</a></p>"
        if (pid) {
            obj.innerHTML += "<br/><input type='checkbox' onclick='setPopup(\""+pid+"\", this.checked);' id='popre'><label for='popre'>Don't show this again</label>"
        }
        // hide popupper after N seconds, giving people enough time to read it.
        window.setTimeout(function() {
            document.getElementById('popupper').style.display = 'none'
            }, (timeout ? timeout : 5) * 1000)
    }
}

// function for determining if an email is open or not
function openEmail() {
    kiddos = []
    traverseThread(document.body, '(thread|helper)_', 'DIV')
    for (var i in kiddos) {
        if (kiddos[i].style.display == 'block') return true
    }
    return false
}