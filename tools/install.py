#!/usr/bin/env python
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import sys
import getpass
import subprocess
import platform

dname = platform.linux_distribution()[0].lower()
dver = platform.linux_distribution()[1]

if getpass.getuser() != "root":
    print("You need to run this script as root!")
    sys.exit(-1)

print("Your distro seems to be : " + dname + " " + dver)

if dname == 'ubuntu' or dname == 'debian':
    print("Running installation script for Debian/Ubuntu servers, hang on!")
    print("Installing pre-requisites via apt-get")
    subprocess.check_call(('apt-get', 'install', 'apache2', 'git', 'liblua5.2-dev', 'lua-cjson', 'lua-sec', 'lua-socket', 'python3', 'python3-pip', 'subversion'))

    print("Installing Python modules")
    subprocess.check_call(('pip3', 'install', 'elasticsearch', 'formatflowed'))

    print("Installing ElasticSearch")
    subprocess.check_call(('apt-get', 'install', 'openjdk-7-jre-headless'))

    try:
        subprocess.check_call(("wget -qO - https://packages.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -"), shell=True)
        subprocess.check_call(('echo "deb http://packages.elastic.co/elasticsearch/1.7/debian stable main" | sudo tee -a /etc/apt/sources.list.d/elasticsearch-1.7.list'), shell=True)
    except:
        print("Did we already add ES to the repo? hmm")

    subprocess.check_call(('apt-get', 'update'))
    subprocess.check_call(('apt-get', 'install', 'elasticsearch'))

    print("Checking out a copy of Pony Mail from GitHub")
    subprocess.check_call(('git', 'clone', 'https://github.com/Humbedooh/ponymail.git', '/var/www/ponymail'))

    print("Starting ElasticSearch")
    subprocess.check_call(('service', 'elasticsearch', 'start'))

    print("Writing httpd configuration file /etc/apache2/sites-enabled/99-ponymail.conf")
    with open("/etc/apache2/sites-enabled/99-ponymail.conf", "w") as f:
        f.write("""
<VirtualHost *:80>
    ServerName mylists.foo.tld
    DocumentRoot /var/www/ponymail/site
    AddHandler      lua-script .lua
    LuaScope        thread
    LuaCodeCache    stat
    AcceptPathInfo  On
</VirtualHost>""")

    if dname == 'ubuntu' and dver == '14.04':
        print("Ubuntu 14.04 specific step; Compiling mod_lua")
        subprocess.check_call(('apt-get', 'install', 'apache2-dev'))
        subprocess.check_call(('svn', 'co', 'https://svn.apache.org/repos/asf/httpd/httpd/branches/2.4.x/modules/lua/', '/tmp/mod_lua'))
        subprocess.check_call(("cd /tmp/mod_lua && apxs2 -I/usr/include/lua5.2 -cia mod_lua.c lua_*.c -lm -llua5.2"), shell=True)

    print("Enabling mod_lua")
    subprocess.check_call(('a2enmod', 'lua'))

    print("Starting httpd")
    subprocess.check_call(('service', 'apache2', 'start'))

    print("Done! Please run setup.py now to set up Pony Mail")

