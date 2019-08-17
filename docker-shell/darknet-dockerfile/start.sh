#!/bin/bash
cd /darknet
python voc2DarknetAssets-python2.py
if [ -f "assets/backup/yolov3-voc_last.weights" ];then
echo "yolov3-voc_last.weights exist"
./darknet detector train assets/voc.data assets/yolov3-voc.cfg assets/backup/yolov3-voc_last.weights -dont_show
else
echo "yolov3-voc_last.weights not exist, use darknet53.conv.74"
./darknet detector train assets/voc.data assets/yolov3-voc.cfg darknet53.conv.74 -dont_show
fi
ok=$?
if [ $ok == 0 ];then
        echo "训练完成\c" > assets/train_status.log
else
        echo "训练失败\c" > assets/train_status.log
fi
