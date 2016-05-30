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
# Installing Pony Mail on CentOS 7.1: #
This installation is a bit trickier, as CentOS does not have
Python 3 or any of the lua modules in its default package system.

Start by installing the following CentOS packages:

- httpd
- git
- lua
- lua-devel
- gcc
- gcc-c++
- kernel-dev
- unzip
- openssl
- openssl-devel
- readline-devel

~~~
sudo yum install -y httpd git lua lua-devel gcc gcc-c++ kernel-devel unzip openssl openssl-devel readline-devel
~~~


Then, proceed to build LuaRocks (for lua deps):

~~~
wget http://luarocks.org/releases/luarocks-2.0.6.tar.gz    
tar zxvf luarocks-2.0.6.tar.gz                                             
cd luarocks-2.0.6                                                               
./configure                                                                          
make                                                                                  
sudo make install
~~~

Now build/install the required Lua modules:

~~~
sudo luarocks install lua-socket
sudo luarocks install luasec OPENSSL_LIBDIR=/usr/lib64/
sudo luarocks install lua-cjson
~~~


Configure, compile and install Python 3:

~~~
sudo yum groupinstall -y development
sudo yum install -y zlib-dev sqlite-devel bzip2-devel xz-libs
wget http://www.python.org/ftp/python/3.4.3/Python-3.4.3.tar.xz
xz -d Python-3.4.3.tar.xz
tar zvf Python-3.4.3.tar
cd Python-3.4.3/
./configure
make
sudo make altinstall
~~~


Install the required Python 3 modules:
~~~
sudo pip3.4 install elasticsearch formatflowed chardet netaddr
~~~


Install ElasticSearch:

~~~
sudo yum install -y java-1.7.0-openjdk-headless
sudo rpm --import https://packages.elastic.co/GPG-KEY-elasticsearch

    (The following is taken from the ElasticSearch online guide:)

    Add the following in your /etc/yum.repos.d/ directory in a file with a .repo suffix,
    for example elasticsearch.repo:
    
    [elasticsearch-1.7]
    name=Elasticsearch repository for 1.7.x packages
    baseurl=http://packages.elastic.co/elasticsearch/1.7/centos
    gpgcheck=1
    gpgkey=http://packages.elastic.co/GPG-KEY-elasticsearch
    enabled=1

sudo yum update
sudo yum install elasticsearch
~~~


Configure and start up ElasticSearch:

~~~
sudo sudo /bin/systemctl daemon-reload
sudo sudo /bin/systemctl enable elasticsearch.service
sudo /etc/init.d/elasticsearch start
~~~


Check out a copy of Pony Mail:
~~~
cd /var/www
git clone https://github.com/Humbedooh/ponymail.git
~~~


Set up Pony Mail:
~~~
cd /var/www/ponymail/tools
python3.4 setup.py
[... answer questions asked by the setup script ...]
~~~


Set up Apache httpd by adding, for example, the following virtual host configuration:
This differs from the normal installation (because of CentOS specifics), so beware

~~~
<VirtualHost *:80>
    LuaPackageCPath /usr/local/lib/lua/5.1/?.so
    LuaPackagePath  /usr/local/share/lua/5.1/?.lua
    ServerName mylists.foo.tld
    DocumentRoot /var/www/ponymail/site
    AddHandler      lua-script .lua
    LuaScope        thread
    LuaCodeCache    stat
    AcceptPathInfo  On
</VirtualHost>
~~~

(re)start apache:

~~~
sudo apachectl restart
~~~

Once this is done, you should now have a *working copy* of Pony Mail!

You may wish to tweak the settings in `site/js/config.js` and your
elasticsearch settings once Pony mail is up and running.

Refer to the [General installation documentation](INSTALLING.md) for
detailed information about archiving messages, OAuth, mail settings and
much more.
