# Installing Pony Mail #


If your distro is on this list, please refer to that specific document
for detailed package installation instructions:

- [Debian (Jessie) Installation Instructions](INSTALL.debian.md)
- [Ubuntu (14.04) Installation Instructions](INSTALL.ubuntu.md)
- [CentOS (7.1) Installation Instructions](INSTALL.centos.md)

Otherwise, read the next two chapters:

## Pre-requisites ##
You will need the following software installed on your machine:

- ElasticSearch >= 1.3 (2.0 is not supported yet)
- Python 3.x for the archiver plugin (setup.py will handle dependencies) and importer
- Apache HTTP Server 2.4.x with mod_lua (see http://modlua.org/gs/installing if you need to build mod_lua manually)
- Lua 5.2 or 5.1 with the following modules: cjson, luasec, luasocket


## Download and Install ##

- Download the git repo: `git clone https://github.com/Humbedooh/ponymail.git`
- Start ElasticSearch on the machine it needs to run on.
- Run setup.py in the `tools` dir:
```
      $cd tools
      $python3 setup.py
      ...[follow instructions in the setup script]
```
- Edit `site/js/config.js` to suit your needs (usually very little editing is needed)



### Using auth for ElasticSearch ###
If your ElasticSearch instance requires authentication for the importer/archiver, please
add the following lines in the `elasticsearch` block of `ponymail.cfg` once generated:

~~~
user:           [username for ES]
password:       [password for ES]
~~~


### Using Apache HTTP Server: ###
- Set up a VirtualHost block in Apache httpd that points to the `site/` directory in Pony Mail
- Add the configuration snippets from `configs/ponymail_httpd.conf` to the virtual host
- Start Apache httpd to enable the user-facing interface

### Using nginx: ###
- To use nginx, you will also need to install the `lua-apr` module from your distro.
- Set up a Server block in nginx that points to the `site/` directory in Pony Mail
- Add the configuration snippets from `configs/ponymail_nginx.conf` to the server config
- Start nginx to enable the user-facing interface


## Setting up the archiver ##
If your mailing list supports feeding emails to a program, feed the incoming new emails to `python3 /path/to/tools/archiver.py`
and it will use STDIN as the transport mechanism. If you are simply using aliases or dot-forwards and no ML system, you can
add (for example) `"|/usr/bin/python3 /path/to/tools/archiver.py"` to your alias file to enable archiving.
If you are not using a Mailing List manager, you will need to tell Pony Mail which email header determines the
list ID using the --altheader argument, for instance:
```
    foolist: "|/usr/bin/python3 /path/to/tools/archiver.py --altheader delivered-to"
```

If you are using MailMan 3, you can add archiver.py as an archive by following the instructions inside the python script:
- Copy the archiver.py file to `$mailman_plugin_dir/mailman_ponymail/__init__.py`
- Copy ponymail.cfg to the same dir (for ES configuration)
- Enable the module by adding the following to your `mailman.cfg` file::
```
  [archiver.ponymail]
  # Pony Mail
  class: mailman_ponymail.Archiver
  enable: yes
```

## Public versus private lists ##
In MailMan 3, this should be auto-detected and is not a concern.
When using other ML systems via piping to STDIN, you should add
the --private arg to the python script to mark an email as private:
```
    foolist-private: "|/usr/bin/python3 /path/to/tools/archiver.py --private"
    foolist-public: "|/usr/bin/python3 /path/to/tools/archiver.py"
```


## Bulk editing lists ##
You can use `edit-list.py` to perform bulk operations:
- Rename lists
- Mark entire lists are private or public

Run `python3 edit-list.py --help` for CLI args.


## Setting up OAuth for Pony Mail ##
If you want people to be able to log in and reply via the Web UI, you can either
use the default Persona login (works for all email addresses) or specify an
OAuth provider.

### Setting up or disabling Persona ###
Persona is enabled by default, as it's a fast and convenient way to enable
logins for *public* lists. Should you wish to disable Persona, set the
`enabled` variable to `false` in the persona section of `site/js/config.js`.
Persona will only ever work for public lists. For private lists, you will need
to specify and implement an OAuth provider.

### Setting up an OAuth provider ###
Pony Mail comes with a default `Apache` OAuth example in `site/js/config.js`,
that enables the ASF Oauth. You probably don't want this, so comment it out or
edit it to suit your own needs. This is a standard OAuth that expects the
backend to supply the following JSON data on success:

~~~
    {
        "fullname": "The full name of the authed user",
        "email": "The user's email address",
        "uid": "(optional) The unique user ID of the logged in user (for instance, LDAP UID)",
        "isMember": true/false (optional, specifies whether the person is a privileged user with access to all lists)
    }
~~~

For private list browsing, Pony Mail supplies an example AAA library in
`site/api/lib/aaa.lua` that does LDAP lookups to determine which groups a person
belongs to, and thus which lists said person has access to. Again, this is
modelled on the Apache LDAP structure, so you may wish to change this to suit
your need.


### Whitelisting replies via the Web UI ###
To have Pony Mail accept replies done via the Web UI, you must make sure
that `site/api/lib/config.lua` contains the appropriate string (or array of strings) matching the domain(s) you wish to allow new email for. To allow replies to everything, set this to `* `(NOT RECOMMENDED).
You can also allow based on GLOBs or an array of accepted domains and sub-domains:

~~~
    accepted_domains = "*" -- This would allow posts to any email address, baaaad choice.
    accepted_domains = "foo.org" -- Allow only to *@foo.org
    accepted_domains = "*.foo.org" -- Allow only posts to *@*.foo.org, but not *@foo.org
    accepted_domains = { "foo.org", "*.foo.org" } -- Allow posts both to *.foo.org and foo.org
~~~


### Setting email footers ###
It is possible to set email footers in each email sent via the Web UI.
This is done by configuring the `email_footer` variable in  `site/api/lib/config.lua`.
You may use the following variables in the footer:

~~~
    $list: The mailing list being sent to (foo@bar.tld)
    $hostname: The hostname of the server
    $port: The port of the server (80, 443 etc)
    $msgid: The message ID of the email (for permalinks etc)
~~~

An example footer could be:

~~~
    --------
    Sent via Pony Mail for $list.
    To view this list online, visit: https://my.tld/list.html?$list
    To view this email (and subsequent replies), visit:
    https://my.tld/thread.html/$msgid
    --------
~~~


### A note on email headers ###
By default, headers such as to/cc are not shown in the normal email view.
To enable these headers, set `full_headers` to `true` in the `site/api/lib/config.lua` file.
