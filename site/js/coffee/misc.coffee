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


########################################################
# This is misc.coffee: Miscellaneous utility functions #
########################################################

###*
# Number prettification prototype:
# Converts 1234567 into 1,234,567 etc
###
Number.prototype.pretty = (fix) ->
    if (fix)
        return String(this.toFixed(fix)).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
    return String(this.toFixed(0)).replace(/(\d)(?=(\d{3})+$)/g, '$1,');

###*
# Number padding
# usage: 123.pad(6) -> 000123
###
Number.prototype.pad = (n) ->
    str = String(this)
    ### Do we need to pad? if so, do it using String.repeat ###
    if str.length < n
        str = "0".repeat(n-str.length) + str
    return str

### Func for converting a date to YYYY-MM-DD HH:MM ###
Date.prototype.ISOBare = () ->
    y = this.getFullYear()
    m = (this.getMonth() + 1).pad(2)
    d = this.getDate().pad(2)
    h = this.getHours().pad(2)
    M = this.getMinutes().pad(2)
    return "#{y}-#{m}-#{d} #{h}:#{M}"

### isArray: function to detect if an object is an array ###
isArray = (value) ->
    value and
        typeof value is 'object' and
        value instanceof Array and
        typeof value.length is 'number' and
        typeof value.splice is 'function' and
        not ( value.propertyIsEnumerable 'length' )

### isHash: function to detect if an object is a hash ###
isHash = (value) ->
    value and
        typeof value is 'object' and
        not isArray(value)

### Remove an array element by value ###
Array.prototype.remove = (val) ->
    for item, i in this
        if item == val
            this.splice(i, 1)
            return this
    return this;

ponymail_url_regex = new RegExp(
  "(" +
    "(?:(?:[a-z]+)://)" +
    "(?:\\S+(?::\\S*)?@)?" +
    "(?:" +
    "([01][0-9][0-9]|2[0-4][0-9]|25[0-5])" +
    "|" +
      "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
      "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
      "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
      "\\.?" +
    ")" +
    "(?::\\d{2,5})?" +
    "(?:[/?#]([^,<>()\\[\\] \\t\\r\\n]|(<[^:\\s]*?>|\\([^:\\s]*?\\)|\\[[^:\\s]*?\\]))*)?" +
    ")\\.?"
  , "mi"
)

ponymail_quote_regex = new RegExp(
    "((?:\r?\n)((on .+ wrote:[\r\n]+)|(sent from my .+)|(>+[ \t]*[^\r\n]*\r?\n[^\n]*\n*)+)+)+", "mi"
)
