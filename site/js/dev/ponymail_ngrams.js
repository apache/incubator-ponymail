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

function addNgram(json, state) {
    
    // Start from the beginning
    var D = new Date(state.dfrom)
    
    // For each day from $beginning to $now, push the no. of emails sent that day into an array
    var daily = []
    for (var i in json.emails) {
        var f = parseInt(json.emails[i].epoch/86400)
        daily[f] = daily[f] ? daily[f]+1 : 1
    }
    
    var arr = []
    while (D <= state.dto) {
        var day = new Date(D)
        D.setDate(D.getDate()+1)
        var d = parseInt(D.getTime()/86400/1000) // make correct pointer to daily[] array
        
        arr.push([day, daily[d] ? daily[d] : 0])
    }
    ngram_data[state.ngram] = arr
    
    // draw the chart
    var ngram_names = []
    for (var n in ngram_data) ngram_names.push(n)
    
    var ngram_arr = []
    var avg = {}
    
    // For each ngram array we have, compile it into the quokka array
    for (var d in ngram_data[ngram_names[0]]) {
        var x = []
        
        for (var n in ngram_data) {
            
            // Are we doing a rolling average ? let's calc it regardless, because ponies..
            avg[n] = avg[n] ? avg[n] : []
            avg[n].push(ngram_data[n][d][1])
            if (avg[n].length > 7) {
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
            x.push(state.avg ? sum : ngram_data[n][d][1])
        }
        ngram_arr.push(x)
    }
    // Draw the current timeline
    quokkaLines("ngramCanvas", ngram_names, ngram_arr, {curve: true, verts: false, title: "n-gram stats"})
    
    // Fetch next ngram analysis if any are waiting
    if (state.ngrams.length > 0) {
        var nngram = state.ngrams.pop()
        GetAsync('/api/stats.lua?list='+state.listname+'&domain='+state.domain+'&d=' + state.dbl + "&" + nngram, { ngram: nngram, ngrams: state.ngrams, listname: state.listname, domain: state.domain, dbl: state.dbl, dfrom: state.dfrom, dto: state.dto, tspan: state.tspan, dspan: state.dspan, query: state.query, avg: state.avg }, addNgram)
    } else {
        document.getElementById('trends').innerHTML = "n-gram analysis completed!"
    }
    
}


// onload func that figures out what we want and then asks the API for stats
function loadNgrams() {
    
    // get list, timespan and query from the html page
    var args = document.location.search.substr(1)
    var a_arr = args.split(/:/, 3)
    var list = a_arr[0]
    var dspan = a_arr[1]
    var query = a_arr[2]
    
    // Try to detect header searches, if present
    var queries = unescape(query).split("||")
    var ngrams = []
    var avg = false
    if (queries[0] && queries[0] == 'avg') {
        avg = true
        queries.shift()
    }
    for (var n in queries) {
        var nquery = []
        var q = queries[n]
        if (q && q.length > 0) {
            var stuff = ['from', 'subject', 'body']
            for (var k in stuff) {
                // can we find 'header=foo' stuff?
                var r = RegExp(stuff[k] + "=(.+)", "mi")
                var m = q.match(r)
                if (m) {
                    q = q.replace(m[0], "")
                    // append to the header_foo query
                    nquery.push("header_" + stuff[k] + "=" + escape(m[1]))
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
    
    // Get us some data
    for (var n in ngrams) {
        GetAsync('/api/stats.lua?list='+listname+'&domain='+domain+'&d=' + dspan + "&" + ngrams[n], { avg: avg, ngram: ngrams[n], ngrams: ngrams, listname: listname, domain: domain, dbl: dspan, dfrom: xa[1], dto: xa[2], tspan: xa[3], dspan: dspan, query: query }, addNgram)
        break
    }
    
    document.title = "n-gram stats for " + list + " - Pony Mail!"
}