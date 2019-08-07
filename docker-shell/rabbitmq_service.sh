#!/bin/bash
# RABBITMQ_DEFAULT_USER可设可不设，默认是baymin
# RABBITMQ_DEFAULT_PASS可设可不设，默认是baymin1024
 sudo docker run -d -p 5672:5672 -p 15672:15672 --name rabbitmq -e RABBITMQ_DEFAULT_USER=baymin -e RABBITMQ_DEFAULT_PASS=baymin1024 --net ai --ip 10.10.0.3 --restart=always registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:rabbitmq
