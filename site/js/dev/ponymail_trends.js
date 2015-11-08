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
    var obj = document.getElementById('trends')
    if (!obj) {
        return;
    }
    var daterange = ""
    
    if (state.tspan == 0) {
        obj.innerHTML += "<h4>Invalid date range specified!</h4>"
        return
    }
    
    if (state.dfrom || state.dto) {
        daterange = " between " + (state.dfrom ? state.dfrom.toDateString() : "beginning of time") + " and " + (state.dto ? state.dto.toDateString() : "now")
    }
    obj.innerHTML = "<h2>Statistics for " + json.list + daterange + ":</h2>"
    if (state.query && state.query.length > 0) {
        obj.innerHTML += "<i>(NB: You are using a search query which may distort these results)"
    }
    
    
    // for sake of displaying "N days" or just "days", make tspan empty string if null
    if (state.tspan == null) {
        state.tspan = ""
    }

    // total emails sent in the past N days
    var total_emails_current = 0;
    var total_emails_past = 0;
    for (var i in json.emails) {
        if ((state.dfrom == null) || json.emails[i].epoch >= (state.dfrom.getTime()/1000)) {
            total_emails_current++;
        } else {
            total_emails_past++;
        }
    }
    
    var diff = total_emails_current-total_emails_past
    var pct = parseInt((diff / total_emails_past)*100)
    
    var emls_sent = document.createElement('div')
    emls_sent.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F8684E; color: #FFF; font-family: sans-serif; width: 420px;")
    emls_sent.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-envelope'> </span> " + total_emails_current.toLocaleString() + "</h2>Emails sent during these " + state.tspan + " days,<br/>"
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
    for (var i in json.thread_struct) {
        if ((state.dfrom == null) || json.thread_struct[i].epoch >= (state.dfrom.getTime()/1000)) {
            total_topics_current++;
        } else {
            total_topics_past++;
        }
    }
    
    var diff = total_topics_current-total_topics_past
    var pct = parseInt((diff / total_topics_past)*100)
    
    var topics_sent = document.createElement('div')
    topics_sent.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F99A00; color: #FFF; font-family: sans-serif; width: 420px;")
    topics_sent.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-list-alt'> </span> " + total_topics_current.toLocaleString() + "</h2>topics started during these " + state.tspan + " days,<br/>"
    if (!isNaN(pct)) {
        if (total_topics_current >= total_topics_past) {
            topics_sent.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_topics_current-total_topics_past) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        } else {
            topics_sent.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_topics_past-total_topics_current) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        }
    }
    
    obj.appendChild(topics_sent)
    
    
    // people participating in the past 3 months
    var total_people_current = 0;
    var total_people_past = 0;
    var hc = {}
    var hp = {}
    for (var i in json.emails) {
        if ((state.dfrom == null) || json.emails[i].epoch >= (state.dfrom.getTime()/1000)) {
            hc[json.emails[i].from] = (hc[json.emails[i].from] ? hc[json.emails[i].from] : 0) + 1
        } else {
            hp[json.emails[i].from] = (hp[json.emails[i].from] ? hp[json.emails[i].from] : 0) + 1
        }
    }
    
    for (var i in hc) { total_people_current++;}
    for (var i in hp) { total_people_past++;}
    
    var diff = total_people_current-total_people_past
    var pct = parseInt((diff / total_people_past)*100)
    
    var parts = document.createElement('div')
    parts.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00A757; color: #FFF; font-family: sans-serif; width: 420px;")
    parts.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-user'> </span> " + total_people_current.toLocaleString() + "</h2>Participants during these " + state.tspan + " days,<br/>"
    if (!isNaN(pct)) {
        if (total_people_current >= total_people_past) {
            parts.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_people_current-total_people_past) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        } else {
            parts.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_people_past-total_people_current) + " (" + pct + "%) compared to previous " + state.tspan + " days."
        }
    }
    
    obj.appendChild(parts)
    
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
    GetAsync('/api/stats.lua?list='+state.listname+'&domain='+state.domain+'&d=' + state.dspan + "&q=" + ((state.query && state.query.length > 0) ? state.query : ""), {tspan: state.tspan}, showTop)
}

function showTop(json, state) {
    
    var obj = document.getElementById('trends')
    if (!obj) {
        return;
    }
    var daterange = ""
    
    if (state.tspan == 0) {
        return
    }
    
    // Top 10 participants
    var top10 = document.createElement('div')
    top10.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00C0F1; color: #FFF; font-family: sans-serif; width: 700px;")
    top10.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-star-empty'> </span> Top 25 participants:</h2>"
    
    var l = "<ul>"
    for (var i in json.participants) {
        var part = json.participants[i]
        l += "<li><img src='https://secure.gravatar.com/avatar/" + part.gravatar + ".jpg?s=24&r=g&d=mm' style='margin: 5px;'/><b>" + part.name + ": </b>" + part.count + " emails</li>"
    }
    l += "</ul>"
    top10.innerHTML += l
    
    obj.appendChild(top10)    
}

function gatherTrends() {
    var args = document.location.search.substr(1)
    var a_arr = args.split(/:/, 3)
    var list = a_arr[0]
    var dspan = a_arr[1]
    var query = a_arr[2]
    if (!dspan || dspan.length == 0) {
        dspan = "lte=1M"
    }
    var xa = datePickerDouble(dspan)
    var arr = list.split(/@/)
    var listname = arr[0]
    var domain = arr[1]
    GetAsync('/api/stats.lua?list='+listname+'&domain='+domain+'&d=' + xa[0] + "&q=" + ((query && query.length > 0) ? query : ""), { listname: listname, domain: domain, dbl: xa[0], dfrom: xa[1], dto: xa[2], tspan: xa[3], dspan: dspan, query: query }, showTrends)
}