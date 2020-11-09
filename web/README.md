![预览图](https://gitee.com/baymin_gitee/img_batch_upload/raw/master/preview.png)

### 训练中心对接ai镜像相关逻辑

> 由于ai容器每次启动会删除一次训练自训练任务文件夹`train_xxxx`
#### 训练流程
1. 训练中心获取队列信息，先生成`train_xxxx`文件夹，写入`等待训练`>`train_status.log`
2. 重新在获取队列，读取`train_xxxx/train_status.log`，如果是等待训练那就启动docker训练
3. ai容器会先删除`train_xxxx`文件夹，然后再在该文件夹下写入`正在训练`>`train_status.log`
4. 训练中心每隔一段时间会获取队列，最后判断该`train_status.log`文件状态