# Apache Pony Mail (Incubating)

Release Notes

## Version 0.10 ##

### Change to AAA ###

Pony Mail now has two AAA modules:
- lib/aaa.lua
- lib/aaa_site.lua

The aaa.lua file is now a generic module which implements the AAA API.
It does not grant any rights; that must be done by the aaa_site.lua module.

Before updating an existing installation, copy aaa.lua to aaa_site.lua otherwise it will be overwritten.
The new generic aaa.lua module will automatically use aaa_site.lua if present.

If this is a new installation, the lib/aaa_site.lua module needs to be created.
There are several examples in the aaa_examples directory or you can create your own.

This was done to simplify subsequent releases.
 