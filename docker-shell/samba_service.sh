#!/bin/bash
sudo docker run -it --name samba -p 139:139 -p 445:445 -v /assets/PowerAiData:/PowerAiData -d dperson/samba -w "WORKGROUP" -u "admin;admin" -s "PowerAiData;/PowerAiData;yes;no;yes"