#!/bin/bash
cd /opt/ai/
echo "starting...."
# f="/home/icubic/detectron/infer_simple_flask.py"
f="/opt/ai/darknetServiceByHttp.py"
if [ ! -f $f ];then
  echo "文件不存在-1"
else
  if netstat -tlpn | grep $1
  then
    echo "success 端口: $1 已存在"
  else
    # nohup /usr/bin/python $f --port $1> $1.log 2>&1 & echo $! > pid$1.txt
    nohup /usr/bin/python $f $1> $1.log 2>&1 & echo $! > pid$1.txt
    echo "success pid: $! 端口: $1"
  fi
fi
