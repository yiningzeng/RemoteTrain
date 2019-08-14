#!/bin/bash
cd /darknet
python voc2DarknetAssets-python2.py
./darknet detector train assets/voc.data assets/yolov3-voc.cfg darknet53.conv.74 -dont_show 