#!/bin/bash
cd /opt/ai
echo "v1.8.4"
nohup python infer_simple_server_baymin.py --port 8200 --cfg /Detectron/detectron/datasets/data/train-config.yaml --model /Detectron/detectron/datasets/data/result/train/coco_2014_train/generalized_rcnn/server.pkl --thresh 0.1 >/excel/python-service.log 2>&1 &
/opt/jdk1.8.0_162/bin/java -jar power-ai-test-service.jar

