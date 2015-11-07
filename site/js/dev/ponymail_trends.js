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
function showTrends(json) {
    
    var now = new Date().getTime() / 1000
    var obj = document.getElementById('trends')
    if (!obj) {
        return;
    }
    obj.innerHTML = "<h2>3 month statistics for " + json.list + ":</h2>"

    // total emails sent in the past 3 months
    var total_emails_current_3 = 0;
    var total_emails_past_3 = 0;
    for (var i in json.emails) {
        if (json.emails[i].epoch >= now-(92*86400)) {
            total_emails_current_3++;
        } else {
            total_emails_past_3++;
        }
    }
    
    var diff = total_emails_current_3-total_emails_past_3
    var pct = parseInt((diff / total_emails_past_3)*100)
    
    var emls_sent = document.createElement('div')
    emls_sent.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F8684E; color: #FFF; font-family: sans-serif; width: 340px;")
    emls_sent.innerHTML = "<h2 style='text-align: left;'>" + total_emails_current_3.toLocaleString() + "</h2>Emails sent in the past 3 months,<br/>"
    if (total_emails_current_3 >= total_emails_past_3) {
        emls_sent.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_emails_current_3-total_emails_past_3) + " (" + pct + "%) since previous 3 months."
    } else {
        emls_sent.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_emails_past_3-total_emails_current_3) + " (" + pct + "%) since previous 3 months."
    }
    
    obj.appendChild(emls_sent)
    
    
    // total topics started in the past 3 months
    var total_topics_current_3 = 0;
    var total_topics_past_3 = 0;
    for (var i in json.thread_struct) {
        if (json.thread_struct[i].epoch >= now-(92*86400)) {
            total_topics_current_3++;
        } else {
            total_topics_past_3++;
        }
    }
    
    var diff = total_topics_current_3-total_topics_past_3
    var pct = parseInt((diff / total_topics_past_3)*100)
    
    var topics_sent = document.createElement('div')
    topics_sent.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F99A00; color: #FFF; font-family: sans-serif; width: 340px;")
    topics_sent.innerHTML = "<h2 style='text-align: left;'>" + total_topics_current_3.toLocaleString() + "</h2>discussions started in the past 3 months,<br/>"
    if (total_topics_current_3 >= total_topics_past_3) {
        topics_sent.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_topics_current_3-total_topics_past_3) + " (" + pct + "%) since previous 3 months."
    } else {
        topics_sent.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_topics_past_3-total_topics_current_3) + " (" + pct + "%) since previous 3 months."
    }
    
    obj.appendChild(topics_sent)
    
    
    // people participating in the past 3 months
    var total_people_current_3 = 0;
    var total_people_past_3 = 0;
    var hc = {}
    var hp = {}
    for (var i in json.emails) {
        if (json.emails[i].epoch >= now-(92*86400)) {
            hc[json.emails[i].from] = (hc[json.emails[i].from] ? hc[json.emails[i].from] : 0) + 1
        } else {
            hp[json.emails[i].from] = (hp[json.emails[i].from] ? hp[json.emails[i].from] : 0) + 1
        }
    }
    
    for (var i in hc) { total_people_current_3++;}
    for (var i in hp) { total_people_past_3++;}
    
    var diff = total_people_current_3-total_people_past_3
    var pct = parseInt((diff / total_people_past_3)*100)
    
    var parts = document.createElement('div')
    parts.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00A757; color: #FFF; font-family: sans-serif; width: 340px;")
    parts.innerHTML = "<h2 style='text-align: left;'>" + total_people_current_3.toLocaleString() + "</h2>Participants in the past 3 months,<br/>"
    if (total_people_current_3 >= total_people_past_3) {
        parts.innerHTML += "<b style='color:#00D0F1'>up</b> " + (total_people_current_3-total_people_past_3) + " (" + pct + "%) since previous 3 months."
    } else {
        parts.innerHTML += "<b style='color:#F9BA00'>down</b> " + (total_people_past_3-total_people_current_3) + " (" + pct + "%) since previous 3 months."
    }
    
    obj.appendChild(parts)
    
    
    // Top 10 participants
    
    var top10 = document.createElement('div')
    top10.setAttribute("style", "margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00C0F1; color: #FFF; font-family: sans-serif; width: 700px;")
    top10.innerHTML = "<h2 style='text-align: left;'>Top 25 participants:</h2>"
    
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
    var list = document.location.search.substr(1)
    var arr = list.split(/@/)
    var listname = arr[0]
    var domain = arr[1]
    GetAsync('/api/stats.lua?list='+listname+'&domain='+domain+'&d=184', null, showTrends)
}