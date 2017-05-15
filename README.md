# Apache Pony Mail (Incubating)
<img src="https://github.com/apache/incubator-ponymail/blob/master/site/images/logo_large.png" align="left"/><br/><br/>
Apache Pony Mail (Incubating) is a web-based mail archive browser
licensed under the Apache License v/2.0 and built to scale 
to millions of archived messages with hundreds of requests 
per second.

Pony Mail allows you to browse and interact with mailing lists 
using Mozilla Persona or OAuth2 (Google, GitHub, Facebook etc) for authentication.

![Ponies](https://github.com/apache/incubator-ponymail/blob/master/site/images/demo.png)

![Trends](https://github.com/apache/incubator-ponymail/blob/master/site/images/demo_trends.png)

See [https://lists.apache.org](https://lists.apache.org) for a demo.

Pony Mail works in both public, private and mixed-mode, allowing you 
to have one unified place for all your communication, both public and 
private.


### Features include: ###
* Importing from standard mbox files, maildir directory, Pipermail or an mod_mbox-driven site
* Public and private list viewing based on auth
* Cross-list threading
* OpenSearch support for browsers (can add as search engine)
* In-browser reply to mailing lists
* Fast and intuitive searching
* Threaded, flat and tree view modes
* Notifications of replies to emails sent via Pony Mail
* Email and list statistics
* Multi-site, multi-list handling
* Word clouds
* Fuzzy-logic email grouping/threading (based in part on JWZ's ideas)
* Supports both custom OAuth, Google Auth, GitHub etc.
* Atom feeds for all lists (including private ones!)
* Source view and custom range mbox export
* Customized trend analysis and n-grams


### Requirements: ###

* Linux operating system (tested on Ubuntu, Debian, Fedora and CentOS - Windows or OS/X may work)
* ElasticSearch backend (2.1 minimum)
* Apache HTTP Server frontend with mod_lua loaded OR
  * Nginx with nginx-extras (ng-lua module) AND lua-apr installed
* Python 3.x for importing (with elasticsearch and formatflowed via pip)
* A mailing list system:
  * MailMan3 if you fancy that (we have a python3 archive plugin)
  * OR any mailing list system of your choice (use archiver plugin with stdin)
* Lua >=5.1 + lua-cjson, luasec and luasocket


### Getting started ###
(Optionally see the [detailed installation instructions](docs/INSTALLING.md) for more information)

#### Supported Linux Distributions ####
For a quick guide to installing Pony Mail, please see the guides for:
- [Debian (Jessie) Installation Instructions](docs/INSTALL.debian.md)
- [Ubuntu (14.04) Installation Instructions](docs/INSTALL.ubuntu.md)
- [CentOS (7.1) Installation Instructions](docs/INSTALL.centos.md)
- [Fedora (22) Installation Instructions](docs/INSTALL.fedora.md)

#### Generic installation instructions ####

1. Install Apache httpd + mod_lua and the lua libs (see http://modlua.org/gs/installing if need be)
2. Install ElasticSearch
3. Install Pony Mail (e.g. clone git or unpack release archive)
4. Go to $HOME_PM/tools/ and run 'python setup.py' - follow the instructions and enter info or do 'python setup.py --defaults'
5. Adjust site/js/config.js as necessary
6. Add Pony Mail as an archiver for your lists. [see this doc](docs/ARCHIVING.md).
7. import mbox data with import-mbox.py if need be (see [this doc](docs/IMPORTING.md) for details)
8. All done :) But please see the [detailed installation instructions](docs/INSTALLING.md) for more details


### Contributing to Pony Mail ###
We'd LOVE if more people would contribute to Pony Mail!
Any form of contribution is most welcome, whether it be programming,
documentation, evangelism, marketing, or helping out other users.

To contribute to Pony Mail, follow these steps (also see [this doc](docs/CONTRIBUTING.md)):

- Fork the repo
- Subscribe to the Pony Mail dev list:
  - Either send an email to dev-subscribe@ponymail.incubator.apache.org OR
  - Visit https://lists.apache.org/list.html?dev@ponymail.apache.org (You can use Google+ or ASF OAuth)
- Find something to fix or help out with
- Let us know what you want to do, and we'll add you to our contributors list!
- Join us on #ponymail on the Freenode IRC network

### Development Benchmarking ###
Pony Mail has been built for and tested with the mail archives of the Apache
Software Foundation, which span more than 15 million emails sent across more
than 20 years. To put things into perspective, importing all this on a modern
machine (2xSSD with 64GB RAM) took around 12 hours and resulted in a performance
at around 100 archive search requests per second per ES node, depending on mailing
list size and available bandwidth.

### TODO: ###
This is a list of what we would love to get done:
* ~~Set up dir structure~~ (*DONE*)
* ~~Import site data~~ (*DONE*)
* ~~Import tools~~ (*DONE*)
* ~~Import settings / setup tools~~ (*DONE*)
* ~~Import, fix archiver~~ (*DONE*)
* ~~Add license headers (ALv2) to everything~~ (*DONE(?)*)
* ~~Have reply feature actually work~~ (*DONE*)
* ~~Split JS into smaller files for development, bundle together for releases~~ (*DONE*)
* Start on documentation (WIP)
* Rework JS, turn those ugly innerHTML hacks into proper DOM handling
* Set up notification system (depends on reply system) (works, but still *WIP!*)
* Have it work with ES with auth mode or via HTTPS
