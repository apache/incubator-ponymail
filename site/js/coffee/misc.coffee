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

###*
# How many bits (of 7 chars each) do we want in our shortLink?
# The more bits, the more precise, the fewer bits, the shorter the link.
###
shortBits = 3

### Shortener: cut MID into pieces, convert to base36 to save 3-4 bytes ###
shortenURL = (mid) ->
    arr = mid.split("@")
    ### IF arr is 2 bits, it's fine to shorten it (meduim/long generator). if 3, then potentially not (short generator) ###
    if arr.length == 2 and (pm_config and pm_config.shortLinks)
        out = ""
        ### For each bit in $howlongdowewantthis ... ###
        for i in [0..shortBits-1]
            ### Cut off 8 chars, convert from base16 to base36 ###
            a = arr[0].substr(i*8,8)
            num = parseInt(a, 16)
            res = num.toString(36)
            ### Padding for small numbers ###
            while res.length < 7
                res = '-' + res
            out += res
        return "PZ" + out
    
    return mid

unshortenURL = (mid) ->
    ### If new format ... ###
    if mid.substr(0,2) == 'PZ'
        out = ""
        ### For each 7-char bit, convert from base36 to base16, remove padding ###
        for i in [0..shortBits-1]
            num = parseInt(mid.substr(2+(i*7), 7).replace('-', ''), 36)
            res = num.toString(16)
            ### 0-padding for smaller numbers (<8 chars)###
            while res.length < 8
                res = '0' + res
            out += res
        return out
    else if mid[0] == 'Z' or mid[0] == 'B'
        ### Old format from 0.9 and before ###
        out = ""
        ### For each 7-char bit, convert from base36 to base16, remove padding ###
        for i in [0..1]
            num = parseInt(mid.substr(1+(i*7), 7).replace('-', ''), 36)
            res = num.toString(16)
            ### 0-padding for smaller numbers (<9 chars) ###
            while res.length < 9
                res = '0' + res
            out += res
        return out
    else
        return mid
    
