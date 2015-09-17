# ponymail
Pony Mail - a lightweight web-based mail archive browser
Licensed under the Apache License v/2.0

![Ponies](https://github.com/Humbedooh/ponymail/blob/master/site/images/demo.png)

See [http://ponyarchive.info](http://ponyarchive.info) for a demo.

### TODO: ###
* Set up dir structure (*DONE*)
* Import site data (*DONE*)
* Import tools (*DONE*)
* Import settings / setup tools (*DONE*)
* Import, fix archiver
* Add license headers (ALv2) to everything
* Start on documentation
* Rework JS, turn those ugly innerHTML hacks into proper DOM handling
* Have reply feature actually work
* Set up notification system (depends on reply system)


### Requirements: ###

* ElasticSearch backend
* Apache HTTP Server frontend with mod_lua loaded
* Python 2.7 for importing
* MailMan3 if you fancy that (we have an archive plugin)
* OR any mailing list system of your choice
* Lua 5.1 or 5.2 + lua-cjson & luasec


### Getting started ###

* Install Apache httpd + mod_lua
* Install ElasticSearch
* go to tools/ and run python setup.py
  * Follow the instructions and enter info
* Fiddle a bit with site/js/config.js for now
* import mbox data with import-mbox.py if need be
* DONE!

