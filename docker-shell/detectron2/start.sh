#!/bin/bash

cd /detectron2
python setup.py build develop
pip install .
use_gpus=`cat /detectron2/datasets/use_gpus`
#mkdir -p "/detectron2/datasets/output/"
if [ -f "/detectron2/datasets/convert_data.log" ];then
        echo "已经转换成功，不需要重复转换" >> "/detectron2/datasets/convert_data.log" 2>&1
else
        convert2coco -d /detectron2/datasets/ >> "/detectron2/datasets/convert_data.log" 2>&1
        echo "done" >> "/detectron2/datasets/convert_data.log" 2>&1
fi
python tools/train_net.py  --num-gpus $use_gpus --config-file /detectron2/datasets/train-config.yaml
