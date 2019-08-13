#!/bin/bash
# RABBITMQ_DEFAULT_USER可设可不设，默认是baymin
# RABBITMQ_DEFAULT_PASS可设可不设，默认是baymin1024
 sudo docker run --name service-rabbitmq \
            -e RABBITMQ_DEFAULT_USER=baymin \
            -e RABBITMQ_DEFAULT_PASS=baymin1024 \
            --net ai --ip 10.10.0.3 \
            -p 5672:5672 \
            -p 15672:15672 \
            --add-host service-postgresql:10.10.0.4 \
            --add-host service-rabbitmq:10.10.0.3 \
            --add-host service-ftp:10.10.0.2 \
            --add-host service-web:10.10.0.5 \
            --restart=always \
            -d registry.cn-hangzhou.aliyuncs.com/baymin/remote-train:rabbitmq
