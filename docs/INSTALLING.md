# Installing Pony Mail #

## Pre-requisites ##
You will need the following software installed on your machine:

- ElasticSearch >= 1.3 (2.0 is not supported yet)
- Python 2.7 if you plan to import from old mbox files
- Python 3.x for the archiver plugin (setup.py will handle dependencies)
- Apache HTTP Server 2.4.x with mod_lua (see http://modlua.org/gs/installing if you need to build mod_lua manually)
- Lua 5.2 or 5.1 with the following modules: cjson, luasec, luasocket


## Download and Install ##
- Download the git repo: `git clone https://github.com/Humbedooh/ponymail.git`
- Start ElasticSearch on the machine it needs to run on.
- Run setup.py in the `tools` dir:
```
      $cd toosl
      $python3.4 setup.py
      ...[follow instructions in the setup script]
```
- Edit `site/js/config.js` to suit your needs (usually very little editing is needed)
- Set up a VirtualHost block in Apache httpd that points to the `site/` directory in Pony Mail
- Add the configuration snippets from `configs/ponymail_httpd.conf` to the virtual host
- Start Apache httpd to enable the user-facing interface

## Setting up the archiver ##
If your mailing list supports feeding emails to a program, feed the incoming new emails to `python3.4 /path/to/mm3/plugin.py`
and it will use STDIN as the transport mechanism. If you are simply using aliases or dot-forwards and no ML system, you can
add (for example) `"|/usr/bin/python3.4 /path/to/mm3/plugin.py"` to your alias file to enable archiving.

If you are using MailMan 3, you can add the plugin.py as an archive by following the instructions inside the python script:
- Copy the python file to `$mailman_plugin_dir/mailman_ponymail/__init__.py`
- Enable the module by adding the following to your `mailman.cfg` file::
```
  [archiver.ponymail]
  # Pony Mail
  class: mailman_ponymail.Archiver
  enable: yes
```
