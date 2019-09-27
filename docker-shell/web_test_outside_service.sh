#!/bin/bash
sudo  docker run \
            --name service-web-test-outside \
            -p 81:80 \
            -v /opt/remote_train_web/test:/usr/local/apache2/htdocs/test/ \
            -v /opt/remote_train_web/aiimg/:/usr/local/apache2/htdocs/aiimg/ \
            -v /opt/remote_train_web/excel/:/usr/local/apache2/htdocs/excel/ \
            --net ai --ip 10.10.0.7 \
            --add-host service-postgresql:10.10.0.4 \
            --add-host service-rabbitmq:10.10.0.3 \
            --add-host service-ftp:10.10.0.2 \
            --add-host service-web:10.10.0.5 \
            --restart=always \
            -d registry.cn-hangzhou.aliyuncs.com/baymin/remote-train:web-v3.5