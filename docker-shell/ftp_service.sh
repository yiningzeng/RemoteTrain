#!/bin/bash
sudo docker run -d \
            --name service-ftp \
            -v /home/baymin/daily-work/ftp/:/home/vsftpd \
            -p 20:20 -p 21:21 -p 47400-47470:47400-47470 \
            -e FTP_USER=baymin \
            -e FTP_PASS=baymin1024 \
            -e PASV_ADDRESS=192.168.31.157 \
            --net ai \
            --ip 10.10.0.2 \
            --add-host service-postgresql:10.10.0.4 \
            --add-host service-rabbitmq:10.10.0.3 \
            --add-host service-ftp:10.10.0.2 \
            --add-host service-web:10.10.0.5 \
            --restart=always \
            registry.cn-hangzhou.aliyuncs.com/baymin/remote-train:ftp
