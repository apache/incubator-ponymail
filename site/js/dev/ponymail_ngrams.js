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

// Side-by-side comparison functions

var ngram_data = {}
var tsum = []
var nsum = {}
var ngramboxes = 0

function addNgram(json, state) {
    
    // Start from the beginning
    var D = new Date(state.dfrom)
    
    // Are we measuring emails or topics?
    if (state.topics) {
        json.emails = json.thread_struct
    }
    
    // For each day from $beginning to $now, push the no. of emails sent that day into an array
    var daily = []
    var zz = 0
    if (json.emails.length >= json.max) {
        document.getElementById('trends').innerHTML = "NOTE: Too many results found (&ge;" + json.max + ") , n-grams may be distorted"
        state.broken = true
    }
    for (var i in json.emails) {
        var f = parseInt(json.emails[i].epoch/86400)
        daily[f] = daily[f] ? daily[f]+1 : 1
        zz++;
    }
    tsum.push(zz)
    nsum[state.ngram] = zz
    var arr = []
    while (D <= state.dto) {
        var day = new Date(D)
        D.setDate(D.getDate()+1)
        var d = parseInt(D.getTime()/86400/1000) // make correct pointer to daily[] array
        
        arr.push([day, daily[d] ? daily[d] : 0])
    }
    ngram_data[state.ngram] = arr
    
    var ngram_names = []
    for (var n in ngram_data) ngram_names.push(n)
    
    // Sort so that the largest areas will be at the bottom in case of stacking
    ngram_names.sort(function(a,b) { return nsum[b] - nsum[a] })
    tsum = []
    for (var nn in ngram_names) {
        tsum.push(nsum[ngram_names[nn]])
    }

    var ngram_arr = []
    var avg = {}
    
    // find a suitable rolling-average timespan
    // set it to 1/15th of the timespan, or at least 3 days
    var ndays = parseInt(ngram_data[ngram_names[0]].length/15)
    if (ndays < 3) {
        ndays = 3
    }
    // For each ngram array we have, compile it into the quokka array
    for (var d in ngram_data[ngram_names[0]]) {
        var x = []
        var z = 0;
        for (var ni in ngram_names) {
            var n = ngram_names[ni]
            // Are we doing a rolling average ? let's calc it regardless, because ponies..
            avg[n] = avg[n] ? avg[n] : []
            avg[n].push(ngram_data[n][d][1])
            if (avg[n].length > ndays) {
                avg[n].shift();
            }
            var sum = 0;
            for (var a in avg[n]) {
                sum += avg[n][a]
            }
            sum = sum/avg[n].length;
            
            // Set the date for the array element
            x[0] = ngram_data[n][d][0];
            
            // push value (or rolling avg) into the quokka array
            x.push(state.avg ? sum*parseInt(ndays/3) : ngram_data[n][d][1])
        }
        if (!state.avg || d%parseInt(ndays/3) == 0) {
                ngram_arr.push(x)
            }
        
    }
    // Draw the current timeline
    var names_neat = []
    for (var i in ngram_names) {
        var nn = []
        var name = unescape(ngram_names[i])
        if (name.match(/^q=[a-z_]+=/)) {
            name = name.replace(/^q=/, "")
        }
        while (name.match(/([^=]+)=([^=&]+)&?/)) {
            var m = name.match(/([^=]+)=([^&=]+)&?/)
            name = name.replace(m[0], "")
            nn.push(m[1] + ": " + m[2])
        }
        if (name.match(/&?q=(.[^&=]+)/)) {
            nn.push("query: " + name.match(/&?q=(.[^&=]+)/)[1])
        }
        names_neat.push(nn.join(", "))
    }
    //quokkaLines("ngramCanvas", names_neat, ngram_arr, {stack: state.stack, curve: true, verts: false, title: "n-gram stats for " + state.listname + "@" + state.domain })
    
    // Fetch next ngram analysis if any are waiting
    if (state.ngrams.length > 0) {
        document.getElementById('trends').innerHTML = state.ngrams.length + " n-grams left to analyze..."
        var nngram = state.ngrams.pop()
        GetAsync('/api/stats.lua?' + (state.topics ? "" : 'quick=true&') + 'list='+state.listname+'&domain='+state.domain+'&d=' + state.dbl + "&" + nngram, { plaw:state.plaw, topics: state.topics, stack: state.stack, ngram: nngram, ngrams: state.ngrams, listname: state.listname, domain: state.domain, dbl: state.dbl, dfrom: state.dfrom, dto: state.dto, tspan: state.tspan, dspan: state.dspan, query: state.query, avg: state.avg }, addNgram)
    } else {
        document.getElementById('trends').innerHTML = "Rendering chart, hold on..!"
        window.setTimeout(function() {
            document.getElementById('trends').innerHTML = "n-gram analysis completed!"
            if (state.broken) {
                document.getElementById('trends').innerHTML += "<br/><b>Note:</b>Some n-gram objects exceeded the maximum result count (" + json.max + "), so the results may be distorted."
            }
            quokkaLines("ngramCanvas", names_neat, ngram_arr, {broken: state.broken, stack: state.stack, curve: true, verts: false, title: "n-gram stats for " + state.listname + "@" + state.domain }, tsum)
            // power law distribution check
            if (state.plaw) {
                document.getElementById('plawCanvas').style.display = "block"
                tsum.sort(function(b,a) {return a - b})
                var ref = tsum[0]
                var xs = []
                for (var i in tsum) {
                    xs.push([i, tsum[i], ref])
                    ref /= 2
                }
                quokkaLines("plawCanvas", ['Actual distribution', 'PL distribution reference'], xs, {nosum: true, curve: false, verts: false, title: "Power Law distribution check chart"})
            }
            
        }, 200)
    }
    
}

// ngram URL generator:
function makeNgramURL() {
    var list = document.getElementById('listname').value
    var timespan = document.getElementById('timespan').getAttribute("data")
    var qs = []
    if (document.getElementById('stack').checked) qs.push("stack")
    if (document.getElementById('topics').checked) qs.push("topics")
    if (document.getElementById('avg').checked) qs.push("avg")
    if (document.getElementById('plaw').checked) qs.push("plaw")
    for (n = 0; n < 20; n++) {
        if (document.getElementById('query' + n) && document.getElementById('query' + n).value.length > 0) {
            qs.push(document.getElementById('query' + n).value)
        }
    }
    var url = "ngrams.html?" + list + ":" + timespan + ":" + qs.join("||")
    location.href = url
}

//function for adding another field to the ngram form
function addNgramBox(hmm) {
    if (hmm > 0) {
        ngramboxes++
        var nobj = document.getElementById('ngram_query')
        var lbox = generateFormDivs('query' + ngramboxes, 'Query #' + ngramboxes + ':', 'text', "")
        lbox.childNodes[1].childNodes[0].setAttribute("onblur", "addNgramBox(this.value.length)")
        nobj.insertBefore(lbox, document.getElementById('ngrambutton'))
    }
}

// onload func that figures out what we want and then asks the API for stats
// invoked by onload in ngrams.html
function loadNgrams() {
    
    // get list, timespan and query from the html page
    var args = document.location.search.substr(1)
    var a_arr = args.split(/:/, 3)
    var list = a_arr[0]
    var dspan = a_arr[1]
    var query = a_arr[2]
    // Try to detect header searches, if present
    var queries = unescape(query ? query : "").split("||")
    var ngrams = []
    var avg = false
    var topics = false
    var stack = false
    var plaw = false
    for (var n in queries) {
        var nquery = []
        var q = encodeURIComponent(queries[n])
        if (q == 'avg') {
            avg = true
            continue
        } else if (q == 'stack') {
            stack = true
            continue
        } else if (q == 'plaw') {
            plaw = true
            continue
        } else if (q == 'topics') {
            topics = true
            continue
        } else if (q.length == 0) {
            continue
        } else if (q == '*') {
            ngrams.push("q=")
            continue
        }
        else if (q && q.length > 0) {
            var stuff = ['from', 'subject', 'body', 'to']
            for (var k in stuff) {
                // can we find 'header=foo' stuff?
                var r = RegExp(stuff[k] + "=([^&=]+)&?", "mi")
                var m = q.match(r)
                if (m) {
                    q = q.replace(m[0], "")
                    // append to the header_foo query
                    nquery.push("header_" + stuff[k] + "=" + encodeURIComponent(m[1]))
                }
            }
        }
        if (q.length > 0) {
            nquery.push("q=" + q)
        }
        ngrams.push(nquery.join("&"))
    }
    
    // default to 1 month view if nothing else is supplied
    if (!dspan || dspan.length == 0) {
        dspan = "lte=1M"
    }
    
    // figure out when this is and what the double is (for comparisons)
    var xa = datePickerDouble(dspan)
    
    // split list name for stats.lua
    var arr = list.split(/@/)
    var listname = arr[0]
    var domain = arr[1]
    
    // make the ngram generator div
    var nobj = document.getElementById('ngram_query')
    // options for ngram generator
    
    nobj.appendChild(generateFormDivs('listname', 'List(s):', 'text', list))
    var tspanner = generateFormDivs('timespan', 'Date range:', 'text', datePickerValue(dspan))
    tspanner.childNodes[1].childNodes[0].setAttribute("onmousedown", 'datePicker(this);')
    tspanner.childNodes[1].childNodes[0].setAttribute("data", dspan)
    nobj.appendChild(tspanner)
    nobj.appendChild(generateFormDivs('stack', 'Stack n-grams:', 'checkbox', stack))
    nobj.appendChild(generateFormDivs('avg', 'Use rolling averages:', 'checkbox', avg))
    nobj.appendChild(generateFormDivs('topics', 'Group messages by topics:', 'checkbox', topics))
    nobj.appendChild(generateFormDivs('plaw', 'Check for PL distribution:', 'checkbox', plaw))
    
    
    // query fields
    
    for (var n in queries) {
        var q = unescape(queries[n]);
        if (q != 'stack' && q != 'topics' && q!= 'avg' && q != 'plaw') {
            ngramboxes++;
            nobj.appendChild(generateFormDivs('query' + ngramboxes, 'Query #' + ngramboxes + ':', 'text', q != undefined ? q : ""))
        }
        
    }
    
    
    // submit button
    var btn = document.createElement('input')
    btn.setAttribute("id", "ngrambutton")
    btn.setAttribute("type", "button")
    btn.setAttribute("value", "Generate n-grams")
    btn.setAttribute("onclick", "makeNgramURL()")
    nobj.appendChild(btn)
    
    
    // add an empty field
    addNgramBox(2)
    
    // Get us some data
    if (ngrams.length > 0) {
        var nngram = ngrams.pop()
        GetAsync('/api/stats.lua?' + (topics ? "" : "quick=true&") + 'list='+listname+'&domain='+domain+'&d=' + dspan + "&" + nngram, { plaw: plaw, topics: topics, stack: stack, avg: avg, ngram: nngram, ngrams: ngrams, listname: listname, domain: domain, dbl: dspan, dfrom: xa[1], dto: xa[2], tspan: xa[3], dspan: dspan, query: query }, addNgram)
        document.title = "n-gram stats for " + list + " - Pony Mail!"
    } else {
        document.getElementById('trends').innerHTML = ""
    }
    
}
