# Installing Pony Mail on Fedora 22: #

Start by installing the following Fedora packages:

- httpd
- git
- lua
- lua-sec
- lua-socket
- python 3
- luarocks

~~~
sudo dnf install -y httpd git lua lua-sec lua-socket python3 luarocks
~~~

Install the missing cjson package via luarocks:

~~~
sudo luarocks-5.3 install lua-cjson
~~~

Install the required Python 3 modules:
~~~
sudo pip3.4 install elasticsearch formatflowed chardet netaddr
~~~


Install ElasticSearch:

~~~
sudo dnf install -y java-1.8.0-openjdk-headless
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


sudo dnf install -y elasticsearch
~~~


Configure and start up ElasticSearch:

~~~
sudo /bin/systemctl daemon-reload
sudo /bin/systemctl enable elasticsearch.service
sudo /etc/init.d/elasticsearch start
~~~


Check out a copy of Pony Mail:
~~~
cd /var/www
sudo git clone https://github.com/Humbedooh/ponymail.git
~~~


Set up Pony Mail:
~~~
cd /var/www/ponymail/tools
sudo python3.4 setup.py
[... answer questions asked by the setup script ...]
~~~


Set up Apache httpd by adding, for example, the following virtual host configuration:
This differs from the normal installation (because of CentOS specifics), so beware

~~~
<VirtualHost *:80>
    LuaPackageCPath /usr/lib/lua/5.3/?.so
    LuaPackagePath  /usr/share/lua/5.3/?.lua
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

IF you have SELinux running, you need to allow httpd (apache) to
be able to connect to remotes, otherwise Pony Mail won't work:

~~~
sudo setsebool -P httpd_can_network_connect 1
~~~

Once this is done, you should now have a *working copy* of Pony Mail!

You may wish to tweak the settings in `site/js/config.js` and your
elasticsearch settings once Pony mail is up and running.

Refer to the [General installation documentation](INSTALLING.md) for
detailed information about archiving messages, OAuth, mail settings and
much more.