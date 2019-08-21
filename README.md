新增训练(非Power-ai)-使用教程

# 介绍

远程训练系统，支持通过Power-Ai标完图直接训练，还支持手动训练其他数据和各种框架。由于软件里集成度高，几乎实现傻瓜式的配置。所以这里主要介绍怎么使用手动训练

由于不通框架训练使用的方式也不一样，本系统主要基于docker实现训练，目前提供3种自动化集成度高的框架。`Yolov3`和`FasterRcnn`和`MaskRcnn`， 当然有其他集成度较高的框架也可以通过镜像直接加载。

>特别说明：本系统只支持一种压缩包格式自解压`tar`，上传一定要是tar格式压缩包，否则直接凉凉。
特别说明：需要填写的目录绝对区分大小写！！！，否则也是直接凉凉。

## 以Yolov3示例：

*   #### 1.制作标准的2012格式的Pascal Voc数据集

    在目标检测中，主要用到了 Annotations，ImageSets，JPEGImages 其中 ImageSets/Main/ 保存了具体数据集的索引，Annotations 保存了标签数据， JPEGImages 保存了图片内容。 ImageSets/Main/ 文件夹以 , $class$_train.txt $class$_val.txt的格式命名。 train.txt val.txt 例外，可以没有

*   #### 2.在Pascal Voc数据集的根目录下新建配置文件[yolov3-voc.cfg](https://github.com/yiningzeng/darknet-license/blob/master/remote_train/yolov3-voc.cfg)和[use_gpus](https://github.com/yiningzeng/darknet-license/blob/master/remote_train/use_gpus)

    如果使用服务器来训练的话，两个配置文件都不需要改动
    配置文件:
    **yolov3-voc.cfg**只需要更改`batch=68`和`subdivisions=32`，一般情况不用更改
    **use_gpus**只是需要使用的显卡的id号通过英文`,`来拼接

*   #### 3.打包文件夹并上传

    **ftp账号:**`ftpicubic`
    **ftp密码:**`ftpicubic-123`
    比如你的Pascal Voc数据集的目录是`我是voc目录`，那么你压缩打包的文件名是`我是voc目录.tar`**你一定要记住，下一步中需要用到**通过上文提供的ftp地址上传文件到根目录，推荐使用`FileZilla`客户端上传

*   #### 4.恭喜你已经完成了所有的配置，只用把信息提交就行了

    **点页面右上角按钮**填写项目名和上一步的信息，其他如果没更新那直接默认。主要是镜像地址，使用前咨询开发

*   #### 5.等着训练

![image.png](https://upload-images.jianshu.io/upload_images/6639127-de43169e85580ae3.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

![image.png](https://upload-images.jianshu.io/upload_images/6639127-3b78e3f1bc4c43e6.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

![image.png](https://upload-images.jianshu.io/upload_images/6639127-ea9ab73835115c7c.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)



# power-ai 远程训练
* [搭建ftp](#ftp-service)
### ftp-service
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
