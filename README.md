# power-ai 远程训练
* [搭建ftp](#ftp 服务)
### ftp 服务
```powershell
#!/bin/bash
sudo docker run -d -v /home/baymin/daily-work/ftp/:/home/vsftpd \
                -p 20:20 -p 21:21 -p 47400-47470:47400-47470 \
                -e FTP_USER=baymin \
                -e FTP_PASS=baymin1024 \
                -e PASV_ADDRESS=192.168.31.157 \
                --name ftp \
                --net ai \
                --ip 10.10.0.2 \
                --restart=always registry.cn-hangzhou.aliyuncs.com/baymin/remote-train:ftp

```
