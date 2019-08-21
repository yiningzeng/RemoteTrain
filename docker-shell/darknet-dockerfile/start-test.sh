#!/bin/bash
cd /darknet
mkdir -p "assets/train_log"
python darknet-server.py 8097 > "assets/train_log/test_docker.log" 2>&1 