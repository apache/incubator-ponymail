#!/bin/sh
############################################################################
# Licensed to the Apache Software Foundation (ASF) under one or more       #
# contributor license agreements.  See the NOTICE file distributed with    #
# this work for additional information regarding copyright ownership.      #
# The ASF licenses this file to you under the Apache License, Version 2.0  #
# (the "License"); you may not use this file except in compliance with     #
# the License.  You may obtain a copy of the License at                    #
#                                                                          #
#     http://www.apache.org/licenses/LICENSE-2.0                           #
#                                                                          #
# Unless required by applicable law or agreed to in writing, software      #
# distributed under the License is distributed on an "AS IS" BASIS,        #
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. #
# See the License for the specific language governing permissions and      #
# limitations under the License.                                           #
############################################################################

# Usage message
if test -z "$1" -o -z "$2"; then
    cat <<EOT
############################################################################
#    setup-es.sh: ElasticSearch setup script for Pony Mail                 #
############################################################################
#                                                                          #
#usage:                                                                    #
#    setup-es.sh [elastic-servername (i.e. localhost)] [elastic db name]   #
#                                                                          #
#examples:                                                                 #
#    setup-es.sh localhost ponymail                                        #
#    setup-es.sh es-backend.foo.com ponymail_01                            #
############################################################################
EOT
    exit 1
fi

echo "Setting up ElasticSearch structure..."
PSERVER=${1:-localhost}
PDBNAME=${2:-ponymail}

echo "Creating DB named $PDBNAME..."
curl -XPUT "http://$PSERVER/$PDBNAME"

echo "Creating mappings for $PDBNAME..."
curl -XPUT "http://$PSERVER/$PDBNAME/mbox/_mappings" -d '{
    "mappings" : {
      "mbox" : {
        "_size" : {
          "enabled" : true,
          "store" : true
        },
        "properties" : {
          "@import_timestamp" : {
            "type" : "date",
            "format" : "yyyy/MM/dd HH:mm:ss||yyyy/MM/dd"
          },
          "@version" : {
            "type" : "long"
          },
          "body" : {
            "type" : "string"
          },
          "date" : {
            "type" : "date",
            "store" : true,
            "format" : "yyyy/MM/dd HH:mm:ss"
          },
          "epoch" : {
            "type" : "double"
          },
          "from" : {
            "type" : "string"
          },
          "from_raw" : {
            "type" : "string",
            "index" : "not_analyzed"
          },
          "in-reply-to" : {
            "type" : "string"
          },
          "list" : {
            "type" : "string"
          },
          "list_raw" : {
            "type" : "string",
            "index" : "not_analyzed"
          },
          "message-id" : {
            "type" : "string"
          },
          "mid" : {
            "type" : "string"
          },
          "private" : {
            "type" : "boolean"
          },
          "references" : {
            "type" : "string"
          },
          "subject" : {
            "type" : "string"
          },
          "to" : {
            "type" : "string"
          }
        }
      }
    }
  }'
  
echo "All done!"
