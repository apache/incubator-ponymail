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

###*
# Init: Test if localStorage is available or not
# If not, fall back to plain global var storage (not effective, but meh)
###
pm_storage_available = false
pm_storage_globvar = {}
try 
    if typeof window.localStorage != "undefined"
        window.localStorage.setItem("pm_test", "1")
        pm_storage_available = true
catch e
    pm_storage_available = false
    

###*
# dbWrite: Store a key/val pair
# Example: dbWrite("ponies", "They are awesome!")
###
dbWrite = (key, value) ->
    ### Can we use localStorage? ###
    if pm_storage_available
        try
            rv = window.localStorage.setItem(key, value)
            return rv
        catch e
            console.log("Could not save data to DB: " + e)
            return null
    else
        ### Guess not, fall back to (ineffective) global var ###
        pm_storage_globvar[key] = value
        return true
    
### dbRead: Given a key, read the corresponding value from storage ###
dbRead = (key) ->
    ### Do we have localStorage? ###
    if pm_storage_available
        return window.localStorage.getItem(key)
    else
        ### Nope, try global var ###
        return pm_storage_globvar[key]
    

hasRead = (mid) ->
    if dbRead("ponymail_read_" + mid)
        return true
    else
        return false

markRead = (mid) ->
    dbWrite("ponymail_read_" + mid, new Date().getTime())
    return true