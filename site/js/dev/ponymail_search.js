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

function resetPage() {
    var obj = document.getElementById('emails')
    if (obj) {
        obj.innerHTML = ""
    }
}

// toggleEmail: Fetch a list of emails from an ML in a specific year/month
function toggleEmail(year, mo, nopush) {
    if (typeof year == 'string' && year.search(/-/) && typeof(mo) == 'undefined') {
        var m = year.split(/-/)
        year = parseInt(m[0])
        mo = parseInt(m[1])
    }
    global_deep = false
    current_query = ""
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    var s = year + "-" + mo
    var e = s
    // if year and month is supplied, the calendar (to the left) should show where we are
    // so let's open up the right year and set the CSS for the selected month
    if (year && mo) {
        kiddos = []
        traverseThread(document.getElementById('datepicker'), 'calmonth', 'LABEL')
        for (var n in kiddos) {
            // if this is the active month, blue-ify it
            if (kiddos[n].getAttribute("id") == ("calmonth_" + year + "-" + mo)) {
                kiddos[n].setAttribute("class", "label label-info")
            // otherwise, default css
            } else {
                kiddos[n].setAttribute("class", "label label-default label-hover")
            }
        }
    }
    
    // if month is supplied, prettify it
    var xmo = mo ? parseInt(mo).toString() : ""
    if (mo.length > 0 && mo <= 9) {
        xmo = '0' + xmo
    }
    // push history state, fetch the data from API
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + year + '-' + xmo);
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&s=" + s + "&e=" + e, null, buildPage)
    
    // set list title to list and year/month
    document.getElementById('listtitle').innerHTML = xlist + " (" + months[mo - 1] + ", " + year + ")" + " &nbsp;<a rel='nofollow' href='api/mbox.lua?list=" + xlist + "&date=" + year + "-" + mo + "'><img src='images/download.png' title='Download this month as an mbox archive'/></a>"
}


// Top 10 search alias - for some reason search() can't be called from there... o.O
function searchTop(a,b,c,d) {
    var obj = document.getElementById('q')
    if (obj) {
        obj.value = a
    }
    search(a,b,c,d)
}

// search: run a search
function search(q, d, nopush, all) {
    keywords = q
    current_retention = d // we use this later in the pagebuilder
    current_query = q // ditto
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var olist = listname
    var domain = arr[1]
    
    // are we checking *@foo.tld ?
    if (document.getElementById('checkall')) {
        all = document.getElementById('checkall').checked
    }
    // If checking multiple lists, the globa_deep will tell the pagebuilder to also
    // include the mailing list name in each result
    global_deep = false
    if (all == true) {
        listname = "*"
        global_deep = true
    }
    
    // we just made a new search, clear the selected month in the calendar to the left if that makes sense
    clearCalendarHover()
    
    // As usual, push new history state
    if (!nopush) window.history.pushState({}, "", "list.html?" + listname + "@" + domain + ":" + d + ":" + escape(q));
    
    // get the data from backend, push to page builder func
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "&d=" + d, null, buildPage)
    
    // for the list title, prepare the date range
    // TODO: improve this much like we have with trends.html
    var arr = datePickerDouble(d)
    var howlong = datePickerValue(d)
    // howlong may begin with a month which should not be lower-cased.
    // or it may be 'Less than 1 month ago'
    // Avoid checking by starting a new sentence
    document.getElementById('listtitle').innerHTML = listname + "@" + domain + " (Quick Search. " + howlong + ") <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    xlist = olist + "@" + domain
    return false;
}

// searchAll: run a deep search of all lists
// much the same as search(), but with added stuff for from and subject field searches.
function searchAll(q, dspan, from, subject, where) {
    keywords = q
    current_retention = dspan
    current_query = q
    global_deep = true
    var wherel = "*"
    var whered = "*"
    if (where && where == 'xlist') {
        var a = xlist.split(/@/)
        wherel = a[0]
        whered = a[1]
    }
    var url = "/api/stats.lua?list="+wherel+"&domain="+whered+"&q=" + q.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "&d=" + escape(dspan)
    if (from) {
        url += "&header_from="  + "\""+ from.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
        current_query += " FROM:"  + "\""+ from.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
    }
    if (subject) {
        url += "&header_subject=\"" + subject.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
        current_query += " SUBJECT:\"" + subject.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
    }
    GetAsync(url, {
        deep: true
    }, buildPage)
    var arr = datePickerDouble(dspan)
    var howlong = arr[3]
    if (howlong == null || isNaN(howlong)) {
        howlong = "custom date range"
    } else {
        if (howlong >= 365) {
            howlong = parseInt(howlong/365) + " year"
        } else if (howlong >= 30) {
            howlong = "last " + parseInt(howlong/30) + " month" + (howlong>59 ? "s" : "")
        } else {
            howlong =  howlong + " day"
        }
    }
    document.getElementById('listtitle').innerHTML = "Deep Search, " + howlong + " view <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    clearCalendarHover()
    return false;
}

// Adds an opensearch engine to the browser
function addSearchEngine() {
    window.external.AddSearchProvider("/api/websearch.lua?" + gxdomain)
}

// for firefox (chrome doesn't seem to get it just yet): add an opensearch header element,
// so the browser will notice that it's available, and inform the user in the quick search bar
function addSearchBar() {
    var h = document.getElementsByTagName('head')[0]
    var sl = document.createElement('link')
    sl.setAttribute("rel", "search")
    sl.setAttribute("type", "application/opensearchdescription+xml")
    sl.setAttribute("href", "/api/websearch.lua?" + gxdomain)
    sl.setAttribute("title", "PonyMail: " + gxdomain + " mailing lists")
    h.appendChild(sl)
}
