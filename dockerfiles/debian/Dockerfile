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
RUN pip3 install elasticsearch formatflowed


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
