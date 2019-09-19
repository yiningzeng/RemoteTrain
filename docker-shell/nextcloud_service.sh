#!/bin/bash
sudo  docker run \
            --name service-nextcloud \
            -p 88:80 \
            -v /nextcloud:/var/www/html/data \
            --net ai --ip 10.10.0.10 \
            --add-host service-postgresql:10.10.0.4 \
            --add-host service-rabbitmq:10.10.0.3 \
            --add-host service-ftp:10.10.0.2 \
            --add-host service-web:10.10.0.5 \
            --restart=always \
            -d nextcloud