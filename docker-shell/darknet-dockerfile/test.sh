#!/bin/bash
use_gpus=`cat use_gpus`
/home/baymin/daily-work/darknet-license/darknet detector train /home/baymin/daily-work/new-work/ab-darknet/yunsheng7-24/voc.data /home/baymin/daily-work/new-work/ab-darknet/yunsheng7-24/yolov3-voc.cfg /home/baymin/daily-work/new-work/ab-darknet/yunsheng7-24/darknet53.conv.74 -dont_show -gpus $use_gpus
ok=$?
if [ $ok == 0 ];then
	echo "正常退出"
else
	echo "break"
fi
