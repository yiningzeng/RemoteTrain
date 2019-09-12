#!/bin/bash
cd /opt/ai
echo "v1.8.4"
nohup python darknet-final-server.py --port 8100 --cfg /darknet/assets/yolov3-voc.cfg --model /darknet/assets/backup/yolov3-voc_last.weights --thresh 0.1 >/excel/python-service.log 2>&1 &
/jdk1.8.0_162/bin/java -jar power-ai-test-service.jar

