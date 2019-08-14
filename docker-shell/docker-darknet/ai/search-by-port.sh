#!/bin/bash
cd /opt/ai/
echo "search...."
if netstat -tlpn | grep $1
  then
    echo 1
  else
    echo 0
fi
#if [ ! -f pid$1.txt ];then
  
#else
#  echo 1
#fi