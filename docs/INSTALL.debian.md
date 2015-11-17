# Installing Pony Mail on Debian Jessie: #
Start by installing the following Debian packages:

- apache2
- git
- lua-sec
- lua-cjson
- lua-socket
- python3
- python3-pip

~~~
sudo apt-get install apache2 git lua-cjson lua-sec lua-socket python3 python3-pip
~~~

Install the required Python 3 modules:
~~~
sudo pip3 install elasticsearch formatflowed netaddr
~~~

Install ElasticSearch:

~~~
sudo apt-get install openjdk-7-jre-headless
wget -qO - https://packages.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb http://packages.elastic.co/elasticsearch/1.7/debian stable main" | sudo tee -a /etc/apt/sources.list.d/elasticsearch-1.7.list
sudo apt-get update && sudo apt-get install elasticsearch
~~~


Check out a copy of Pony Mail:
~~~
cd /var/www
sudo git clone https://github.com/Humbedooh/ponymail.git
~~~

Start up ElasticSearch:

~~~
sudo service elasticsearch start
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
