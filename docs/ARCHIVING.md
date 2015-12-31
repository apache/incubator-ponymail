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


## ezmlm example:
First, see the general introduction in the MM2 example, as this applies here as well.

### Create an alias:
Set up a dot-forward file for a public and a private alias:

~~~
`.qmail-archive-public`:
"|/usr/bin/python3 /path/to/tools/archiver.py"

`.qmail-archive-private`:
"|/usr/bin/python3 /path/to/tools/archiver.py --private"
~~~


### Subscribe the aliases to your mailing lists
Use the ezmlm CLI to subscribe your new aliases to the lists:
`ezmlm-sub foolist/ archive-public@yourhost.tld`
`ezmlm-sub secretlist/ archive-private@yourhost.tld`


## Setting up AAA
If you have an custom OAuth2 provider and a binary approach to private access
(either/or), you can enable private access to people by having a key/value pair
called `isMember` set to `true` in your JSON response from the OAuth server,
provided it is set as an authority in config.lua. This will provide anyone
defined as a member via OAuth full access to all private lists.

If you use LDAP, you can modify the LDAP queries in the example AAA file to suit
your organization.
