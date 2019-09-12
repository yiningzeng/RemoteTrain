#!/bin/bash
python darknet-final.py > "assets/train_log/test_docker.log" 2>&1
ok=$?
if [ $ok == 0 ];then
        echo "测试完成" > assets/test_status
else
        echo "测试失败" > assets/test_status
fi