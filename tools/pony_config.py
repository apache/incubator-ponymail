import configparser
import os

"""
A module for consistently locating ponymail config files.
"""

FILENAME = "ponymail.cfg"


def fetch_config():
    """Fetch the config file from the CWD,
    if it doesn't exist check the tools dir.
    """
    file_dir = os.path.dirname(os.path.realpath(__file__))
    config = configparser.RawConfigParser()
    if os.path.isfile("./%s" % FILENAME):
        config.read("./%s" % FILENAME)
    else:
        config.read("%s/%s" % (file_dir, FILENAME))
    return config
