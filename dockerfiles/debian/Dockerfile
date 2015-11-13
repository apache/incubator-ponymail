############################################################
# Dockerfile to build Pony Mail container images
# Based on Debian
############################################################

# Set base image
FROM debian

MAINTAINER Daniel Gruno

# Base stuff
RUN apt-get update
RUN apt-get install -y wget

### ElasticSearch Prep

RUN wget -qO - https://packages.elastic.co/GPG-KEY-elasticsearch | apt-key add -
RUN echo 'deb http://packages.elastic.co/elasticsearch/2.0/debian stable main' | tee -a /etc/apt/sources.list.d/elasticsearch-2.0.list


# Update aptitude repo data
RUN apt-get update

# Install base packages
RUN apt-get install -y apache2 git lua-cjson lua-sec lua-socket python3 python3-pip openjdk-7-jre-headless elasticsearch
RUN pip3 install elasticsearch formatflowed


# Download Pony Mail
RUN git clone https://github.com/Humbedooh/ponymail.git /var/www/ponymail

# Add httpd config
ADD https://raw.githubusercontent.com/Humbedooh/ponymail/master/dockerfiles/ponymail_httpd_docker.conf /etc/apache2/sites-enabled/000-default.conf

# Hack ES init, prevent sysctl for now
RUN sed -i '/sysctl/echo/' /etc/init.d/elasticsearch
RUN sed -i '/# network.host/network.host\: 127.0.0.1/' /etc/elasticsearch/elasticsearch.yml

# Set some very tiny defaults for this ES DB
RUN printf "index.number_of_shards: 2\nindex.number_of_replicas: 0\n" >> /etc/elasticsearch/elasticsearch.yml


# Start ElasticSearch, set up Pony Mail
EXPOSE 9200 9300
RUN service elasticsearch start && sleep 30 && service elasticsearch status && cd /var/www/ponymail/tools && python3 setup.py --defaults

# Enable mod_lua
RUN a2enmod lua

# Expose port for httpd
EXPOSE 80

# Set default container startup sequence
ENTRYPOINT service elasticsearch start && service apache2 start && bash
