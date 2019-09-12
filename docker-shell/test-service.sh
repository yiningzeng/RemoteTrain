#!/bin/bash
sudo  docker run \
            --name service-testing \
            -p 8070:8070 \
            -p 8100:8100 \
            -v /aiimg/:/aiimg \
            --net ai --ip 10.10.0.6 \
            --add-host service-postgresql:10.10.0.4 \
            --add-host service-rabbitmq:10.10.0.3 \
            --add-host service-ftp:10.10.0.2 \
            --add-host service-web:10.10.0.5 \
            --rm -d registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_auto_test-service-ai-power-v4.4