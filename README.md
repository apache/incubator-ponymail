# ponymail
Pony Mail - a lightweight web-based mail archive browser
Licensed under the Apache License v/2.0

See [http://ponyarchive.invo](http://ponyarchive.invo) for a demo.

### TODO: ###
* Set up dir structure (*DONE*)
* Import site data (*DONE*)
* Add license headers (ALv2)
* Import tools
* Import, fix archiver
* Import settings / setup tools
* Start on documentation
* Rework JS, turn those ugly innerHTML hacks into proper DOM handling
* Have reply feature actually work


### Requirements: ###

* ElasticSearch backend
* Apache HTTP Server frontend with mod_lua loaded
* Python 2.7 for importing
* MailMan3 if you fancy that (we have an archive plugin)
* OR any mailing list system of your choice
* Lua 5.1 or 5.2 + lua-cjson


### Getting started ###

* Install Apache httpd + mod_lua
* Install ElasticSearch
* go to tools/ and run setup-es.sh
* pip install elasticsearch formatflowed
* import if need be

