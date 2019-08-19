#!/bin/bash
cd /darknet
mkdir -p "assets/train_log"
use_gpus=`cat assets/use_gpus`
python voc2DarknetAssets-python2.py > "assets/train_log/reain_docker.log" 2>&1 
if [ -f "assets/backup/yolov3-voc_last.weights" ];then
echo "yolov3-voc_last.weights exist" >> "assets/train_log/reain_docker.log" 2>&1
./darknet detector train assets/voc.data assets/yolov3-voc.cfg assets/backup/yolov3-voc_last.weights -dont_show -gpus $use_gpus >> "assets/train_log/reain_docker.log" 2>&1 
else
echo "yolov3-voc_last.weights not exist, use darknet53.conv.74" >> "assets/train_log/reain_docker.log" 2>&1
./darknet detector train assets/voc.data assets/yolov3-voc.cfg darknet53.conv.74 -dont_show -gpus $use_gpus >> "assets/train_log/reain_docker.log" 2>&1
fi
ok=$?
if [ $ok == 0 ];then
        echo "训练完成" > assets/train_status.log
else
        echo "训练失败" > assets/train_status.log
fi
