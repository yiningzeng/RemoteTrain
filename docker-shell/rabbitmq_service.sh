#!/bin/bash
sudo docker run -d --name rabbitmq \
            -p 5672:5672 -p 15672:15672 \
            -e RABBITMQ_DEFAULT_USER=baymin \ # 可设可不设，默认是baymin
            -e RABBITMQ_DEFAULT_PASS=baymin1024 \  # 可设可不设，默认是baymin1024
            --net ai \
            --ip 10.10.0.3 \
            --restart=always \
            registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:rabbitmq
