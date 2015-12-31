# Archiving New Emails to Pony Mail #
This document exists to extend the [general install guide](INSTALLING.md) provide examples on how to archive emails.

## Mailman 2.x example:
Set up a Pony Mail mail account/alias on a machine. This can be your local mail
server, it can be the machine that Pony Mail is on (install sendmail or postfix
etc there), or it can be any other machine with access to the ElasticSearch
database that Pony Mail uses.


### Pre-requisites
If this is not the machine Pony Mail was installed on, you'll need to copy the
tools/ directory from your Pony Mail installation to this machine and adjust
ponymail.cfg to point to the right place for the database. You will also need
Python 3 and the helper libraries installed
(`pip3 install elasticsearch formatflowed netaddr`)

### Create an alias:
Set up a mail alias for public and private lists in `/etc/aliases` or similar method,
and point them at the archiver script in tools/:

~~~
# You may need to add "--altheader delivered-to" to these commands, it varies
foo-public: "|/usr/bin/python3 /path/to/tools/archiver.py"
foo-private: "|/usr/bin/python3 /path/to/tools/archiver.py --private"
~~~

Once done, run `newaliases` to update your alias DB.

### Subscribe the aliases to your mailing lists
Use the mailman UI or CLI to subscribe foo-public@ to your public lists and
foo-private to your private lists. Don't worry, the contents of private lists
are hidden by default till the correct AAA scripting is set up.
