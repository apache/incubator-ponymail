#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
This is feedwrapper - a mailing list auto-subscriber and/or feed passthrough program.
Activate it by adding "|/usr/bin/env python3 /path/to/ponymail/tools/feedwrapper.py localuser@thisdomain.abc"
Then subscribe to lists by running: python3 feedwrapper sub localuser@thisdomain.abc ml-subscribe@mldomain.foo"
"""

import sys, re, os, email, smtplib
from subprocess import Popen, PIPE
path = os.path.dirname(os.path.realpath(__file__))

if __name__ == '__main__':
    if len(sys.argv) <= 1:
        print("Usage: feedwrapper [recipient email] OR")
        print("       feedwrapper sub [recipient] [ML-subscribe-address]")
        sys.exit(0)
    if sys.argv[1] == "sub":
        sender = sys.argv[2]
        recip = sys.argv[3]
        smtpObj = smtplib.SMTP('localhost')
        smtpObj.sendmail(sender, [recip], """From: %s
To: %s
Subject: subscribe

subscribe
""" % (sender, recip)
            )
        print("Sent subscription request for %s to %s" % (sender, recip))
    else:
        msg = email.message_from_file(sys.stdin)

        if msg.get('to') and msg.get('reply-to') and msg.get('subject'):
            if msg.get('to').find(sys.argv[1]) != -1 and \
                re.search(r"-request@", msg.get('reply-to')) or \
                (\
                    re.match(r"confirm subscribe to", msg.get('subject'), flags=re.IGNORECASE) and \
                    re.search(r"-sc\.", msg.get('reply-to')) \
                ):
                with open("%s/wrapper.log" % path, "a") as f:
                    f.write("%s - %s: %s\n" % (msg.get('to'), msg.get('reply-to'), msg.get('subject')))
                    f.write("We've got a subscription request for %s. \n" % msg.get('reply-to'))

                smtpObj = smtplib.SMTP('localhost')
                smtpObj.sendmail(sys.argv[1], [msg.get('reply-to')], """From: %s
To: %s
Subject: %s

%s
""" % (sys.argv[1], msg.get('reply-to'), msg.get('subject'), msg.get('subject'))
            )
            else:
                with open("%s/wrapper.log" % path, "a") as f:
                    f.write("Got an email for %s\n" % (msg.get('list-id') or "??"))
                    f.write("%s - %s: %s\n" % (msg.get('to'), msg.get('reply-to'), msg.get('subject')))
                    p = Popen("/usr/bin/python3 %s/../mm3/plugin.py" % path, shell=True, stdin=PIPE, stderr=PIPE, stdout=sys.stdout)
                    print(p.communicate(input=msg.as_string().encode('utf-8')))
                    p.stdin.close()
                    f.write("-----\n")
