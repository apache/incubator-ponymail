# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
 #the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
############################################################
# Dockerfile to build Pony Mail container images
# Based on Debian
############################################################

# Set base images
FROM debian
FROM elasticsearch

MAINTAINER Daniel Gruno

# Update aptitude repo data
RUN apt-get update

# Install base packages
RUN apt-get install -y apache2 git lua-cjson lua-sec lua-socket python3 python3-pip
RUN pip3 install elasticsearch formatflowed netaddr


# Download Pony Mail
RUN git clone https://github.com/Humbedooh/ponymail.git /var/www/ponymail

# Add httpd config
ADD https://raw.githubusercontent.com/Humbedooh/ponymail/master/dockerfiles/ponymail_httpd_docker.conf /etc/apache2/sites-enabled/000-default.conf


# Start ElasticSearch, set up Pony Mail
EXPOSE 9200 9300
RUN service elasticsearch start && sleep 30 && service elasticsearch status && cd /var/www/ponymail/tools && python3 setup.py --defaults

# Enable mod_lua
RUN a2enmod lua

# Expose port for httpd
EXPOSE 80

# Set default container startup sequence
ENTRYPOINT service elasticsearch start && service apache2 start && bash
