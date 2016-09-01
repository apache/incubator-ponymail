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

# Number prettification prototype:
# Converts 1234567 into 1,234,567 etc
Number.prototype.pretty = (fix) ->
    if (fix)
        return String(this.toFixed(fix)).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
    return String(this.toFixed(0)).replace(/(\d)(?=(\d{3})+$)/g, '$1,');

# Number padding
# usage: 123.pad(6) -> 000123
Number.prototype.pad = (n) ->
    str = String(this)
    if str.length < n
        str = "0".repeat(n-str.length) + str
    return str


# isArray: function to detect if an object is an array
isArray = ( value ) ->
    value and
        typeof value is 'object' and
        value instanceof Array and
        typeof value.length is 'number' and
        typeof value.splice is 'function' and
        not ( value.propertyIsEnumerable 'length' )
