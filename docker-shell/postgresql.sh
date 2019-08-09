#!/bin/bash
sudo docker run --name postgresql -e POSTGRES_PASSWORD=baymin1024 -p 5432:5432 --net ai --ip 10.10.0.4 -d postgres:9.6