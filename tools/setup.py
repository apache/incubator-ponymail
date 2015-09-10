#!/usr/bin/env python
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
    es_url = "http://%s:%u/%s/,
    mailserver = "%s"
}
return config
            """ % (hostname, port, dbname, mlserver))
    f.close()
    
print("All done, Pony Mail should...work now :)")
