#!/bin/bash
sudo  docker run \
            --name apache-web \
            -v /home/baymin/daily-work/FreeFish/dist/:/usr/local/apache2/htdocs/ \
            -p 80:80 \
            --net ai --ip 10.10.0.5 \
            --add-host postgresql:10.10.0.4 \
            --add-host rabbitmq:10.10.0.3 \
            --add-host ftp:10.10.0.2 \
            -d httpd