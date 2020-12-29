### AOi获取发布模型接口说明
`针对线上已经在运行的模型，由于训练中心是之后上线的需要把线上的模型和项目做一个收集手动发布到训练中心以保证训练中心和线上使用的一致`
```shell
GET 请求 http://192.168.31.102:18888/get_models
```
返回结果说明, `models`数组下所有的zip包里面包含如内容， 另外还会多一个`labels.names` 这是根据ai dll调用结构加的，把所有的zip文件解压到相应的文件夹就是和dll调用一致的结构了
```
yiwu-pianzhuang.zip
├── labels.names
├── suggest_score.txt (如果存在这个文件，就是有推荐置信度，里面内容就是float类型的值)
├── yiwu-pianzhuang.cfg
└── yiwu-pianzhuang.weights
```


#### 返回实例
```json
{
    "res": 0,
    "message": "获取成功",
    "project_list": [
        {
            "project_name": "前道",
            "list": [
                {
                    "net_framework": "yolov4-tiny-3l",
                    "models": [
                        "http://192.168.31.102:1121/前道/model_release/yolov4-tiny-3l/jinmian-huashang.zip",
                        "http://192.168.31.102:1121/前道/model_release/yolov4-tiny-3l/jinmian-yiwu.zip",
                        "http://192.168.31.102:1121/前道/model_release/yolov4-tiny-3l/yiwu-pianzhuang.zip",
                        "http://192.168.31.102:1121/前道/model_release/yolov4-tiny-3l/yuanjian-xizhu.zip",
                        "http://192.168.31.102:1121/前道/model_release/yolov4-tiny-3l/labels.names"
                    ]
                },
                {
                    "net_framework": "我是其他网络框架",
                    "models": []
                }
            ]
        },
        {
            "project_name": "测试2",
            "list": []
        },
        {
            "project_name": "测试",
            "list": []
        }
    ]
}
```
