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


// showTrends: Show the ML trends on trends.html
function showTrends(json, state) {
    
    var now = new Date().getTime() / 1000
    
    // Do we have a trend DOM object to edit?
    var obj = document.getElementById('trends')
    if (!obj) {
        return;
    }
    
    
    // Make sure we actually have a timespan > 0 days to analyze.
    if (state.tspan == 0) {
        obj.innerHTML += "<h4>Invalid date range specified!</h4>"
        return
    }
    
    
    // Add the timespan if it makes sense (has a beginning and end)
    var daterange = ""
    if (state.dfrom || state.dto) {
        daterange = " between " + (state.dfrom ? state.dfrom.toDateString() : "beginning of time") + " and " + (state.dto ? state.dto.toDateString() : "now")
    }
    
    // Link back to list view if possible
    var lname = json.list.replace(/</, "&lt;")
    if (lname.search(/\*/) == -1) {
        lname = "<a href='/list.html?" + lname + "'>" + lname + "</a>"
    }
    
    // Set page title
    obj.innerHTML = "<h2>Statistics for " + lname + daterange + ":</h2>"
    if ((state.query && state.query.length > 0) || (state.nquery && state.nquery.length > 0)) {
        obj.innerHTML += "<i>(NB: You are using a search query which may distort these results)"
    }
    
    
    // for sake of displaying "N days" or just "days", make tspan empty string if null
    if (state.tspan == null) {
        state.tspan = ""
    }

    // save each daily stat for later canvas drawing
    var daily = {}
    
    // total emails sent in the past N days
    var total_emails_current = 0;
    var total_emails_past = 0;
    
    // For each email, count the ones in this and the previous time span
    for (var i in json.emails) {
        var f = parseInt(json.emails[i].epoch/86400)
        daily[f] = daily[f] ? daily[f]+1 : 1
        if ((state.dfrom == null) || json.emails[i].epoch >= (state.dfrom.getTime()/1000)) {
            total_emails_current++;
        } else {
            total_emails_past++;
        }
    }
    
    // change since past timespan as relative number and percentage
    var diff = total_emails_current-total_emails_past
    var pct = parseInt((diff / total_emails_past)*100)
    
    // Make div for emails sent
    var emls_sent = document.createElement('div')
    emls_sent.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F8684E; color: #FFF; font-family: sans-serif; width: 420px;")
    emls_sent.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-envelope'> </span> " + total_emails_current.toLocaleString() + "</h2>Emails sent during these " + state.tspan + " days,<br/>"
    
    // If a comparison with previous timespan makes sense (can be calculated), show it
    if (!isNaN(pct)) {
        if (total_emails_current >= total_emails_past) {
        emls_sent.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_emails_current-total_emails_past) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        } else {
            emls_sent.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_emails_past-total_emails_current) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        }
    }
    
    
    obj.appendChild(emls_sent)
    
    
    // total topics started in the past 3 months
    var total_topics_current = 0;
    var total_topics_past = 0;
    
    // For each thread, count the ones _started_ in this time span and the previous one
    for (var i in json.thread_struct) {
        if ((state.dfrom == null) || json.thread_struct[i].epoch >= (state.dfrom.getTime()/1000)) {
            total_topics_current++;
        } else {
            total_topics_past++;
        }
    }
    
    var diff = total_topics_current-total_topics_past
    var pct = parseInt((diff / total_topics_past)*100)
    
    
    // Make div for topics started
    var topics_sent = document.createElement('div')
    topics_sent.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F99A00; color: #FFF; font-family: sans-serif; width: 420px;")
    topics_sent.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-list-alt'> </span> " + total_topics_current.toLocaleString() + "</h2>topics started during these " + state.tspan + " days,<br/>"
    
    // If a comparison with previous timespan makes sense (can be calculated), show it
    if (!isNaN(pct)) {
        if (total_topics_current >= total_topics_past) {
            topics_sent.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_topics_current-total_topics_past) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        } else {
            topics_sent.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_topics_past-total_topics_current) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        }
    }
    
    obj.appendChild(topics_sent)
    
    
    // people participating in the past 3 months
    // As we can't just count them, we'll construct a hash and count the no. of elements in it
    var total_people_current = 0;
    var total_people_past = 0;
    var hc = {}
    var hp = {}
    
    // For each email, add to the sender hash for current and previous time span. Count 'em later
    for (var i in json.emails) {
        if ((state.dfrom == null) || json.emails[i].epoch >= (state.dfrom.getTime()/1000)) {
            hc[json.emails[i].from] = (hc[json.emails[i].from] ? hc[json.emails[i].from] : 0) + 1
        } else {
            hp[json.emails[i].from] = (hp[json.emails[i].from] ? hp[json.emails[i].from] : 0) + 1
        }
    }
    
    // count elements in the hashes
    for (var i in hc) { total_people_current++;}
    for (var i in hp) { total_people_past++;}
    
    var diff = total_people_current-total_people_past
    var pct = parseInt((diff / total_people_past)*100)
    
    // Make div for participants
    var parts = document.createElement('div')
    parts.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00A757; color: #FFF; font-family: sans-serif; width: 420px;")
    parts.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-user'> </span> " + total_people_current.toLocaleString() + "</h2>Participants during these " + state.tspan + " days,<br/>"
    
    // If a comparison with previous timespan makes sense (can be calculated), show it
    if (!isNaN(pct)) {
        if (total_people_current >= total_people_past) {
            parts.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_people_current-total_people_past) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        } else {
            parts.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_people_past-total_people_current) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        }
    }
    
    obj.appendChild(parts)
    
    // Display charts if possible
    if (state.dfrom && state.dto) {
        quokkaBars("trendCanvas", 
        ['Previous timespan', 'Current timespan'], 
        [ 
            ["Emails sent", total_emails_past, total_emails_current],
            ["Topics started", total_topics_past, total_topics_current],
            ["Participants", total_people_past, total_people_current], 
        ],
        { stack: false, curve: false, title: "Stats for the past " + state.tspan + " days (compared to previous timespan)", nox: false }
      );
    }
    GetAsync('/api/stats.lua?list='+state.listname+'&domain='+state.domain+'&d=' + state.dspan + "&q=" + ((state.query && state.query.length > 0) ? state.query : "") + state.nquery, {tspan: state.tspan}, showTop)
    
    
    // daily chart rendering with quokka
    var days = []
    for (var d in daily) {
        days.push(d)
    }
    days.sort()
    
    var arr = []
    // for each element, reconstruct the date
    for (var d in days) {
        var day = new Date(days[d]*86400*1000)
        
        // if in this timespan, color it blue
        if (day.getTime() >= state.dfrom.getTime()) {
            arr.push([day, daily[days[d]], '#00C0F1'])
            
        // else, color it green
        } else {
            arr.push([day, daily[days[d]], '#2DC47B'])
        }
        
    }
    // draw the chart
    quokkaBars("dayCanvas", ['Current timespan', '', 'Previous timespan'], arr, {verts: false, title: "Daily email stats"})
}

// callback for top10 stats
function showTop(json, state) {
    
    // Make sure we have a trend object to edit in the DOM
    var obj = document.getElementById('trends')
    if (!obj) {
        return;
    }
    var daterange = ""
    
    // Can't do much analysis if the timespan is 0 days
    if (state.tspan == 0) {
        return
    }
    
    // Top 10 participants
    var top10 = document.createElement('div')
    top10.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00C0F1; color: #FFF; font-family: sans-serif; width: 420px;")
    top10.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-star-empty'> </span> Top 10 participants:</h2>"
    
    var l = "<ul>"
    for (var i in json.participants) {
        var part = json.participants[i]
        l += "<li><img src='https://secure.gravatar.com/avatar/" + part.gravatar + ".jpg?s=24&r=g&d=mm' style='margin: 5px;'/><b>" + part.name.replace(/</, "&lt;") + ": </b>" + part.count + " email" + (part.count == 1 ? "" : "s") + "</li>"
    }
    l += "</ul>"
    top10.innerHTML += l
    
    obj.appendChild(top10)    
}

// onload func that figures out what we want and then asks the API for stats
function gatherTrends() {
    
    // get list, timespan and query from the html page
    var args = document.location.search.substr(1)
    var a_arr = args.split(/:/, 3)
    var list = a_arr[0]
    var dspan = a_arr[1]
    var query = a_arr[2]
    
    // Try to detect header searches, if present
    var nquery = ""
    if (query && query.length > 0) {
        var stuff = ['from', 'subject', 'body']
        
        for (var k in stuff) {
            // can we find 'header=foo' stuff?
            var r = RegExp(stuff[k] + "=(.+)", "mi")
            var m = query.match(r)
            if (m) {
                query = query.replace(m[0], "")
                // append to the header_foo query
                nquery += "&header_" + stuff[k] + "=" + escape(m[1])
            }
        }
    }
    
    // don't let JavaScript try to send 'undefined' as an actual query here.
    if (query == undefined) {
        query = ""
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
    GetAsync('/api/stats.lua?list='+listname+'&domain='+domain+'&d=' + xa[0] + "&q=" + ((query && query.length > 0) ? query : "") + nquery, { nquery: nquery, listname: listname, domain: domain, dbl: xa[0], dfrom: xa[1], dto: xa[2], tspan: xa[3], dspan: dspan, query: query }, showTrends)
    document.title = "Stats for " + list + " - Pony Mail!"
}