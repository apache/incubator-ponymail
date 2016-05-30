<!--
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 
 http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 -->
# Installing Pony Mail on Ubuntu 14.04 or 16.04: #
Start by installing the following Ubuntu packages:

- apache2
- git
- liblua5.2-dev
- lua-sec
- lua-cjson
- lua-socket
- python3
- python3-pip
- subversion

~~~
sudo apt-get install apache2 git liblua5.2-dev lua-cjson lua-sec lua-socket python3 python3-pip subversion
~~~

Install the required Python 3 modules:
~~~
sudo pip3 install elasticsearch formatflowed netaddr
~~~

Install ElasticSearch:

~~~
sudo apt-get default-jre-headless
wget -qO - https://packages.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb http://packages.elastic.co/elasticsearch/2.x/debian stable main" | sudo tee -a /etc/apt/sources.list.d/elasticsearch-2.x.list
sudo apt-get update && sudo apt-get install elasticsearch
~~~

Compile and install mod_lua if necessary (httpd < 2.4.17 on Ubuntu):
~~~
apt-get install apache2-dev
svn co https://svn.apache.org/repos/asf/httpd/httpd/branches/2.4.x/modules/lua/
cd lua/
apxs -I/usr/include/lua5.2 -cia mod_lua.c lua_*.c -lm -llua5.2
~~~


Check out a copy of Pony Mail:
~~~
cd /var/www
git clone https://github.com/Humbedooh/ponymail.git
~~~

Configure Elasticsearch to automatically start during bootup. For Ubuntu <= 14.10:

~~~
sudo update-rc.d elasticsearch defaults 95 10
~~~

For Ubuntu >= 15.04:

~~~
sudo /bin/systemctl daemon-reload
sudo /bin/systemctl enable elasticsearch.service
~~~

Start up ElasticSearch:

~~~
service elasticsearch start
~~~

Set up Pony Mail:
~~~
cd /var/www/ponymail/tools
sudo python3 setup.py
[... answer questions asked by the setup script ...]
~~~


Set up Apache httpd by adding, for example, the following virtual host configuration:

~~~
<VirtualHost *:80>
    ServerName mylists.foo.tld
    DocumentRoot /var/www/ponymail/site
    AddHandler      lua-script .lua
    LuaScope        thread
    LuaCodeCache    stat
    AcceptPathInfo  On
</VirtualHost>
~~~

Enable mod_lua and start apache:

~~~
sudo a2enmod lua
sudo service apache start
~~~

Once this is done, you should now have a *working copy* of Pony Mail!

You may wish to tweak the settings in `site/js/config.js` and your
elasticsearch settings once Pony mail is up and running.

Refer to the [General installation documentation](INSTALLING.md) for
detailed information about archiving messages, OAuth, mail settings and
much more.
