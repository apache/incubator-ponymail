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
    type = type ? type : 'DIV'
    for (var i in child.childNodes) {
        if (child.childNodes[i].nodeType && child.childNodes[i].nodeType == 1 && child.childNodes[i].nodeName == type) {
            if (!name || (child.childNodes[i].getAttribute("id") && child.childNodes[i].getAttribute("id").search(name) != -1)) {
                kiddos.push(child.childNodes[i])
            }
        }
        if (child.childNodes[i].nodeType && child.childNodes[i].hasChildNodes()) {
            traverseThread(child.childNodes[i], name, type)
        }
    }

}


// toggleView: show/hide a DOM object
function toggleView(el) {
    var obj = document.getElementById(el)
    if (obj) {
        obj.style.display = (obj.style.display == 'none') ? 'block' : 'none'
    }
}



// sortByDate: reshuffle a threaded display into a flat display, sorted by date
function sortByDate(tid) {
    kiddos = []
    var t = document.getElementById("thread_" + tid)
    var h = document.getElementById("helper_" + tid)
    if (t) {
        traverseThread(t, 'thread')
        if (prefs.sortOrder == 'forward') {
            kiddos.sort(function(a, b) {
                return parseInt(b.getAttribute('epoch') - a.getAttribute('epoch'));
            })
        } else {
            kiddos.sort(function(a, b) {
                return parseInt(a.getAttribute('epoch') - b.getAttribute('epoch'));
            })
        }
        for (var i in kiddos) {
            t.insertBefore(kiddos[i], t.firstChild)
        }
    }
}


// generateFormDivs: helper func for making form elements
function generateFormDivs(id, title, type, options, selval) {
    var mf = document.createElement('div')
    mf.setAttribute('id', "main_form_" + id)
    mf.style.margin = "10px"
    mf.style.padding = "10px"
    
    var td = document.createElement('div')
    td.style.width = "300px"
    td.style.float = "left"
    td.style.fontWeight = "bold"
    td.appendChild(document.createTextNode(title))
    mf.appendChild(td)
    
    var td2 = document.createElement('div')
    td2.style.width = "200px"
    td2.style.float = "left"
    if (type == 'select') {
        var sel = document.createElement('select')
        sel.setAttribute("name", id)
        sel.setAttribute("id", id)
        for (var key in options) {
            var opt = document.createElement('option')
            if (typeof key == "string") {
                opt.setAttribute("value", key)
                if (key == selval) {
                    opt.setAttribute("selected", "selected")
                }
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
    if (type == 'input') {
        var inp = document.createElement('input')
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.setAttribute("value", options)
        td2.appendChild(inp)
    }
    mf.appendChild(td2)
    return mf
}


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

function popup(title, body) {
    var obj = document.getElementById('popupper')
    if (obj) {
        obj.innerHTML = ""
        obj.style.display = 'block'
        obj.innerHTML = "<h3>" + title + "</h3><p>" + body + "</p><p><a class='btn btn-success' href='javascript:void(0);' onclick='toggleView(\"popupper\")'>Got it!</a></p>"
        window.setTimeout(5000, function() {
            document.getElementById('popupper').style.display = 'none'
            })
    }
}