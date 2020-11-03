#!/bin/bash
sudo  docker run \
            --name service-web-loss \
            -p 1121:80 \
            -v /assets/Projects/:/usr/local/apache2/htdocs/ \
            --net ai --ip 10.10.0.99 \
            --add-host service-postgresql:10.10.0.4 \
            --add-host service-rabbitmq:10.10.0.3 \
            --add-host service-ftp:10.10.0.2 \
            --add-host service-web:10.10.0.5 \
            --restart=always \
            -d registry.cn-hangzhou.aliyuncs.com/baymin/remote-train:web-v3.5