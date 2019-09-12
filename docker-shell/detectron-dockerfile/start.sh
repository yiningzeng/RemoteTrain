#!/bin/bash
mkdir -p "/Detectron/detectron/datasets/data/train_log"
if [ -f "/Detectron/detectron/datasets/data/train_log/convert_data.log" ];then
        echo "已经转换成功，不需要重复转换" > "/Detectron/detectron/datasets/data/train_log/train_docker.log" 2>&1
else
	convert2coco -d /Detectron/detectron/datasets/data > "/Detectron/detectron/datasets/data/train_log/train_docker.log" 2>&1 
        echo "done" > "/Detectron/detectron/datasets/data/train_log/convert_data.log"
fi
train -c /Detectron/detectron/datasets/data/train-config.yaml

