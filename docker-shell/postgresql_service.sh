#!/bin/bash
sudo docker run --name postgresql \
            -e POSTGRES_PASSWORD=baymin1024 \
            -p 5432:5432 \
            --net ai --ip 10.10.0.4 \
            --add-host service-postgresql:10.10.0.4 \
            --add-host service-rabbitmq:10.10.0.3 \
            --add-host service-ftp:10.10.0.2 \
            --add-host service-web:10.10.0.5 \
            --restart=always \
            -d postgres:9.6