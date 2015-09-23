#!/usr/bin/env python
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
 #the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import sys, os, json, re, time
import getpass
import subprocess

dopip = False
try:
    from elasticsearch import Elasticsearch
    from formatflowed import convertToWrapped
except:
    dopip = True
    
if dopip and (getpass.getuser() != "root"):
    print("It looks like you need to install some python modules first")
    print("Either run this as root to do so, or run: ")
    print("pip install elasticsearch formatflowed")
    sys.exit(-1)

elif dopip:
    print("Before we get started, we need to install some modules")
    print("Hang on!")
    try:
        subprocess.check_call(('pip','install','elasticsearch','formatflowed'))
    except:
        print("Oh dear, looks like this failed :(")
        print("Please install elasticsearch and formatflowed before you try again:")
        print("pip install elasticsearch formatflowed")
        sys.exit(-1)
    

print("Welcome to the Pony Mail setup script!")
print("Let's start by determining some settings...")
print("")


hostname = ""
port = 0
dbname = ""
mlserver = ""
mldom = ""
wc = ""
wce = False

while hostname == "":
    sys.stdout.write("What is the hostname of the ElasticSearch server? (e.g. localhost): ")
    hostname = sys.stdin.readline().strip()
    
while port < 1:
    sys.stdout.write("What port is ElasticSearch listening on? (normally 9200): ")
    port = int(sys.stdin.readline().strip())

while dbname == "":
    sys.stdout.write("What would you like to call the mail index (e.g. ponymail): ")
    dbname = sys.stdin.readline().strip()

while mlserver == "":
    sys.stdout.write("What is the hostname of the outgoing mailserver? (e.g. mail.foo.org): ")
    mlserver = sys.stdin.readline().strip()
    
while mldom == "":
    sys.stdout.write("Which domains would you accept mail to from web-replies? (e.g. foo.org or *): ")
    mldom = sys.stdin.readline().strip()

while wc == "":
    sys.stdout.write("Would you like to enable the word cloud feature? (Y/N): ")
    wc = sys.stdin.readline().strip()
    if wc.lower() == "y":
        wce = True


print("Okay, I got all I need, setting up Pony Mail...")

print("Creating index " + dbname)

es = Elasticsearch([
    {
        'host': hostname,
        'port': port,
        'use_ssl': False,
        'url_prefix': ''
    }],
    max_retries=5,
    retry_on_timeout=True
    )
mappings = {
    "mbox" : {
      "_size" : {
        "enabled" : True,
        "store" : True
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
          "store" : True,
          "format" : "yyyy/MM/dd HH:mm:ss",
          "index" : "not_analyzed"
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
    },
    "mbox_source" : {
      "_size" : {
        "enabled" : True,
        "store" : True
      },
      "properties" : {
        "source" : {
          "type" : "string",
          "index" : "not_analyzed"
        }
      }
    },
    "attachment" : {
      "_size" : {
        "enabled" : True,
        "store" : True
      },
      "properties" : {
        "source" : {
          "type" : "binary"
        }
      }
    }
  }

res = es.indices.create(index = dbname, body = {
            "mappings" : mappings
        }
    )

print("Index created!")
print("Writing importer config (ponymail.cfg)")

with open("ponymail.cfg", "w") as f:
    f.write("""
###############################################################
# Pony Mail Configuration file                                             

# Main ES configuration
[elasticsearch]
hostname:               %s
dbname:                 %s
port:                   %u

###############################################################
            """ % (hostname, dbname, port))
    f.close()
    
print("mod_lua configuration (config.lua)")
with open("../site/lib/config.lua", "w") as f:
    f.write("""
local config = {
    es_url = "http://%s:%u/%s/",
    mailserver = "%s",
    accepted_domains = "%s",
    wordcloud = %s
}
return config
            """ % (hostname, port, dbname, mlserver, mldom, "true" if wce else "false"))
    f.close()
    
print("All done, Pony Mail should...work now :)")
