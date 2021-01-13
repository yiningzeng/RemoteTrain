# -*- coding=utf-8 -*-
# !/usr/bin/env python
import os
import glob

import pika
import json
import time
import yaml
import socket
import psycopg2
import subprocess
import numpy as np
from wxpy import *
import logging
from logging import handlers
from retry import retry
from visdom import Visdom
from datetime import datetime
from flask_cors import CORS
from flask import Flask, request, Response
from urllib.parse import quote, unquote, urlencode
from apscheduler.schedulers.background import BackgroundScheduler


# 网络框架枚举
class net_framework:
    yolov4Tiny3l = {"name": "yolov4-tiny-3l", "modeldcfgname": "yolov4-tiny-3l.cfg",
                    "train_docker_volume": "/Afinaltrain/SourDatas", "modelSavePath": "backup",
                    "modelSuffix": ".weights", "configSuffix": ".cfg"}


def get_net_framework(net_name):
    if net_name == "yolov4-tiny-3l":
        return net_framework.yolov4Tiny3l
    else:
        return None


app = Flask(__name__)
CORS(app, resources=r'/*')
# rabbitmq 文档 https://pika.readthedocs.io/en/stable/modules/channel.html
# retry https://github.com/invl/retry
# pika https://pypi.org/project/pika/

#


'''
usage:  dockertrain  -p  映射到本地的端口 默认8097 如果被占用会自动分配，只检测端口占用情况，可能存在多个未开启的容器相同端口的情况
                      -n  项目名 默认 ""
                      -v  需要映射的素材目录(必填)
                      -r  docker镜像的地址 默认registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-wo-v3.6
                      -w  root密码 默认icubic-123
                      -g  复制脚本到/usr/local/bin/，后面执行可以全局dockertrain
                      -o  日志的输出目录默认/var/log/train
                      -t  docker的gup版本，默认是最新版本2，设置1：nvidia-docker，2：docker run --gpus all
                      -h  帮助
'''

'''
第一次运行一定要保证queue要存在，就是直接运行两次
'''


class pikaqiu(object):

    def __init__(self, root_password='icubic-123', rabbitmq_host='localhost', rabbitmq_port=5672,
                 rabbitmq_username='guest', rabbitmq_password='guest', assets_base_path='/assets/Projects',
                 train_exchange='ai.train.topic', train_queue='ai.train.topic-queue', train_routing_key='train.start.#',
                 test_exchange='ai.test.topic', test_queue='ai.test.topic-queue', test_routing_key='test.start.#',
                 package_exchange='ai.package.topic', package_queue='ai.package.topic-queue',
                 package_routing_key='package.upload-done.#'
                 ):
        self.assets_base_path = assets_base_path
        self.root_password = root_password
        self.rabbitmq_host = rabbitmq_host
        self.rabbitmq_port = rabbitmq_port
        self.rabbitmq_username = rabbitmq_username
        self.rabbitmq_password = rabbitmq_password
        self.sql_host = 'localhost'
        # region 画图参数
        self.draw = True
        self.draw_windows = None
        self.draw_host = 'localhost'
        self.draw_port = 8097
        # endregion
        # region 训练队列参数
        self.train_exchange = train_exchange
        self.train_queue = train_queue
        self.train_routing_key = train_routing_key
        # endregion
        # region 测试队列参数
        self.test_exchange = test_exchange
        self.test_queue = test_queue
        self.test_routing_key = test_routing_key
        # endregion
        # region 训练素材包队列参数
        self.package_exchange = package_exchange
        self.package_queue = package_queue
        self.package_routing_key = package_routing_key
        # endregion
        self.parameters = pika.URLParameters("amqp://%s:%s@%s:%d" % (rabbitmq_username, rabbitmq_password, rabbitmq_host, rabbitmq_port))
        # region postgres
        self.postgres_conn = None
        # endregion
        # self.consume()

    def draw_chat(self, data=[{"x": 13.00, "y": 13.33, "win_id": "窗体名称->就是当前容器的id+该图标的含义", "title": "窗体显示的名称"}],
                  debug=False, err=False):
        # record 定义的格式{"x": 13.00, "y": 13.33, "win_id": "窗体名称->就是当前容器的id+该图标的含义", "title": "窗体显示的名称"}
        if debug:
            self.draw_windows = Visdom(env="test")
        if err:
            a, rows = ff.postgres_execute(
                "SELECT project_id, assets_directory_base, assets_directory_name, project_name"
                " FROM train_record WHERE status=2", True)
            if rows is not None and len(rows) > 0:
                assets_directory_name = rows[0][2]
                # # os.system("echo 训练失败-梯度爆炸了 > '%s/%s/train_%s/train_status.log'" % (self.package_base_path, assets_directory_name))  # 会自动退出，所以这里不需要了
                # # os.system("echo '%s' | sudo -S docker stop `cat '%s/%s/train.dname'`" % (self.root_password, self.package_base_path, assets_directory_name))  # 会自动退出，所以这里不需要了
                # self.postgres_execute("UPDATE train_record SET "
                #                       "status=%d, project_name='%s'"
                #                       " WHERE project_id='%s'" %
                #                       (-1, str(rows[0][3]) + "-梯度爆炸了", rows[0][0]))
        else:
            for record in data:
                if self.draw_windows is None:
                    temp = record["win_id"]
                    pos = temp.rfind("-")
                    project_id = temp[:pos]
                    print(project_id)  # "C:/Python27/1"
                    a, rows = ff.postgres_execute(
                        "SELECT project_id, assets_directory_base, assets_directory_name, project_name"
                        " FROM train_record WHERE project_id='%s'" % project_id, True)
                    if rows is not None and len(rows) > 0:
                        assets_directory_name = rows[0][2]
                        self.postgres_execute("UPDATE train_record SET "
                                              "status=%d, project_name='%s'"
                                              " WHERE project_id='%s'" %
                                              (2, str(rows[0][3]).replace("-梯度爆炸了", ""), rows[0][0]))
                        if debug:
                            self.draw_windows = Visdom(env=project_id)
                        else:
                            draw_log = self.assets_base_path + "/" + assets_directory_name + "/draw.log"
                            self.draw_windows = Visdom(env=project_id, log_to_filename=draw_log)
                if self.draw_windows.win_exists(record["win_id"]):
                    self.draw_windows.line(
                        X=np.array([record["x"]]),
                        Y=np.array([record["y"]]),
                        win=record["win_id"],
                        opts=dict(title=record["title"], width=600, height=380),
                        update='append')
                else:
                    self.draw_windows.line(
                        win=record["win_id"],
                        X=np.array([0]),
                        Y=np.array([0]),
                        opts=dict(title=record["title"], width=600, height=380))

    '''
        - *dbname*: the database name
        - *database*: the database name (only as keyword argument)
        - *user*: user name used to authenticate
        - *password*: password used to authenticate
        - *host*: database host address (defaults to UNIX socket if not provided)
        - *port*: connection port number (defaults to 5432 if not provided)
    :return: 
    '''

    def postgres_connect(self, host='localhost', port=5432, user='postgres', password='baymin1024', dbname='power_ai'):
        self.postgres_conn = psycopg2.connect("host=%s port=%d user=%s password=%s dbname=%s" %
                                              (host, port, user, password, dbname))
        return True

    def postgres_execute(self, sql=None, select=False):
        if self.postgres_conn is None:
            self.postgres_connect(host=self.sql_host)
        result = None
        if sql is None:
            log.logger.info("sql null")
            return False, result
        log.logger.info(sql)
        try:
            cur = self.postgres_conn.cursor()
            cur.execute(sql)
            if select:
                result = cur.fetchall()
            self.postgres_conn.commit()
            cur.close()
        except Exception as e:
            self.postgres_conn.commit()  # 修复有一次插入或者查询出错就直接报错了
            log.logger.info(str(e))
            return False, result
        else:
            log.logger.info("sql执行成功")
            return True, result

    def postgres_disconnect(self):
        self.postgres_conn.close()
        return True

    @retry(pika.exceptions.AMQPConnectionError, delay=5, jitter=(1, 3))
    def init(self, sql=True, sql_host='localhost', draw=True, draw_host='localhost', draw_port=1121):
        self.draw = draw
        self.draw_host = draw_host
        self.draw_port = draw_port
        self.sql_host = sql_host
        if draw:
            os.system(
                "echo %s | sudo -S docker stop service-web-loss && sudo docker rm service-web-loss" % self.root_password)
            os.system("echo %s | sudo -S docker run \
            --name service-web-loss \
            -p %d:80 \
            -v %s:/usr/local/apache2/htdocs/ \
            --net ai --ip 10.10.0.99 \
            --restart=always \
            -d registry.cn-hangzhou.aliyuncs.com/baymin/remote-train:web-v3.5" % (
                self.root_password, draw_port, self.assets_base_path))
        if sql:
            self.postgres_connect(host=sql_host)
        connection = pika.BlockingConnection(self.parameters)
        channel = connection.channel()
        try:
            # region创建训练队列
            channel.exchange_declare(self.train_exchange, "topic", passive=True, durable=True)
            channel.queue_declare(self.train_queue, passive=True, durable=True)
            channel.queue_bind(self.train_queue, self.train_exchange, self.train_routing_key)
            # endregion
            # region创建测试队列
            channel.exchange_declare(self.test_exchange, "topic", passive=True, durable=True)
            channel.queue_declare(self.test_queue, passive=True, durable=True)
            channel.queue_bind(self.test_queue, self.test_exchange, self.test_routing_key)
            # endregion
            # region创建训练素材解包队列
            channel.exchange_declare(self.package_exchange, "topic", passive=True, durable=True)
            channel.queue_declare(self.package_queue, passive=True, durable=True)
            channel.queue_bind(self.package_queue, self.package_exchange, self.package_routing_key)
            # endregion
        except Exception as e:
            # region创建训练队列
            channel = connection.channel()
            channel.exchange_declare(self.train_exchange, "topic", durable=True)
            channel.queue_declare(self.train_queue)
            channel.queue_bind(self.train_queue, self.train_exchange, self.train_routing_key)
            # endregion
            # region创建训练队列
            channel = connection.channel()
            channel.exchange_declare(self.test_exchange, "topic", durable=True)
            channel.queue_declare(self.test_queue)
            channel.queue_bind(self.test_queue, self.test_exchange, self.test_routing_key)
            # endregion
            # region创建训练素材解包队列
            channel = connection.channel()
            channel.exchange_declare(self.package_exchange, "topic", durable=True)
            channel.queue_declare(self.package_queue)
            channel.queue_bind(self.package_queue, self.package_exchange, self.package_routing_key)
            # endregion
        connection.close()
        # self.get_one(channel)


# 队列新增，每次重新连接，防止出现断开的情况，并且会有重试机制
@retry(pika.exceptions.ChannelWrongStateError, tries=3, delay=3, jitter=(1, 3))
def do_basic_publish(exchange, routing_key, body):
    connection = pika.BlockingConnection(ff.parameters)
    channel = connection.channel()
    channel.basic_publish(exchange, routing_key, body)
    connection.close()


# 队列单个获取，每次重新连接，防止出现断开的情况，并且会有重试机制
@retry(pika.exceptions.ChannelWrongStateError, tries=3, delay=3, jitter=(1, 3))
def do_basic_get(queue, auto_ack=False):
    connection = pika.BlockingConnection(ff.parameters)
    channel = connection.channel()
    method_frame, header_frame, body = channel.basic_get(queue=queue, auto_ack=auto_ack)
    return connection, channel, method_frame, header_frame, body


def net_is_used(port, ip='0.0.0.0'):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((ip, port))
        s.shutdown(2)
        print('%s:%d is used' % (ip, port))
        return True
    except:
        print('%s:%d is unused' % (ip, port))
        return False


# 获取单个训练队列数据
def get_train_one():
    log.logger.info('get_train_one:%s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    # os.system("notify-send '%s' '%s' -t %d" % ('ceshi', '测试', 10000))
    connection, channel, method_frame, header_frame, body = do_basic_get(queue=ff.train_queue)
    # chan.basic_ack(msg.delivery_tag)
    # It can be empty if the queue is empty so don't do anything
    notify_message = '等待训练'
    if method_frame is None:
        log.logger.info("训练：Empty Basic.Get Response (Basic.GetEmpty)")
        return None, None
        # We have data
    else:
        # 这里需要检查训练素材包是否已经解包，如果未解包，这里需要拒绝，让它重新排队ff.channel.basic_nack
        train_info = yaml.load(body.decode('utf-8'), Loader=yaml.FullLoader)
        os.system("echo '%s' | sudo -S chmod -R 777 %s/%s/training_data" % (
            ff.root_password, ff.assets_base_path, train_info["projectName"]))
        # 判断训练状态文件是否存在
        if not os.path.exists("%s/%s/training_data/train_status_%s.log" % (
                ff.assets_base_path, train_info["projectName"], train_info["taskId"])):
            log.logger.info('%s 等待训练' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            channel.basic_nack(method_frame.delivery_tag)
            os.system("echo '等待训练\c' > '%s/%s/training_data/train_status_%s.log'" %
                      (ff.assets_base_path, train_info["projectName"], train_info["taskId"]))
            notify_message = "等待训练"
            log.logger.info(notify_message)
        else:
            status = os.popen("cat '%s/%s/training_data/train_status_%s.log' | head -n 1" %
                              (ff.assets_base_path, train_info["projectName"], train_info["taskId"])).read().replace(
                '\n', '')
            if "等待训练" in status:
                channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去
                with open('{}/{}/training_data/config.yaml'.format(ff.assets_base_path, train_info["projectName"]), 'w',
                          encoding='utf-8') as fs:
                    yaml.dump(data=train_info, stream=fs, allow_unicode=True)
                    fs.close()
                '''
                执行后会在 -v 目录下生成 容器的id container_id.log
                usage:  dockertrain  -p  映射到本地的端口 默认8097 如果被占用会自动分配，只检测端口占用情况，可能存在多个未开启的容器相同端口的情况
                                     -n  项目名 默认 ""
                                     -v  需要映射的素材目录(必填)
                                     -d  如果-f选择other那么-d必填，就是-v映射的容器内的目录
                                     -r  docker镜像的地址 默认registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-wo-auto-v3.6
                                     -f  训练使用的网络默认detectron,可选darknet和other
                                     -w  root密码 默认icubic-123
                                     -g  复制脚本到/usr/local/bin/，后面执行可以全局dockertrainD
                                     -o  日志的输出目录默认/var/log/train
                                     -t  docker的gup版本，默认是最新版本2，设置1：nvidia-docker，2：docker run --gpus all
                                     -h  帮助
                '''
                # 增加镜像地址进数据库，并且镜像地址外部(队列里的数据)传入
                image_url = None
                docker_volume = None
                if train_info['providerType'] == net_framework.yolov4Tiny3l["name"]:
                    image_url = train_info['image']
                    docker_volume = net_framework.yolov4Tiny3l["train_docker_volume"]
                os.system("echo %s | sudo -S docker pull %s" % (ff.root_password, image_url))
                train_cmd = "dockertrain -n '%s' -v '%s' -w '%s' -t 2 -r '%s' -f '%s' -d '%s'" % \
                            (train_info["taskId"],
                             ff.assets_base_path + "/" + train_info["projectName"],
                             ff.root_password,
                             image_url,
                             train_info['providerType'],
                             docker_volume)
                log.logger.info("\n\n**************************\n训练的命令: %s\n**************************\n" % train_cmd)

                if image_url is None or docker_volume is None:
                    log.logger.info(
                        "\n\n**************************\n镜像地址和映射的容器内目录不可为空\n**************************\n")
                    return

                res = os.popen(train_cmd).read().replace('\n', '')
                catStr = "cat %s/%s/container_id.log" % (ff.assets_base_path, train_info["projectName"])
                container_id = os.popen(catStr).read().replace('\n', '')
                if len(container_id) > 80:
                    container_id = "more than 80"
                # elif len(container_id) < 63:
                #     container_id = "less 63fasterRcnn2"
                if "train_done" not in res:
                    log.logger.error("训练有误: %s" % res)
                    # draw_url = 'http://%s:%d/env/%s' % (ff.draw_host, ff.draw_port, train_info['taskId'])
                    sql = "UPDATE train_record SET container_id='%s', status=%d where task_id='%s'" % \
                          (container_id, -1, train_info['taskId'])
                    log.logger.error("训练:" + sql)
                    ff.postgres_execute(sql)
                    os.system("echo '训练失败\c' > '%s/%s/training_data/train_status_%s.log'" %
                              (ff.assets_base_path, train_info["projectName"], train_info["taskId"]))
                    channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                    return
                # 如果res长度==64，那么就是container_id

                os.system("echo '正在训练\c' > '%s/%s/training_data/train_status_%s.log'" %
                          (ff.assets_base_path, train_info["projectName"], train_info["taskId"]))

                # region 更新数据库
                sql = "UPDATE train_record SET container_id='%s', status=%d where task_id='%s'" % \
                      (container_id, 2, train_info['taskId'])
                log.logger.info("训练:" + sql)
                ff.postgres_execute(sql)
                # endregion

                # region 初始化画图visdom
                # if ff.draw:
                #     # 保留画图日志，下次打开可直接加载
                #     draw_log = ff.assets_base_path + "/" + train_info["projectName"] + "/draw.log"
                #     ff.draw_windows = Visdom(env=train_info['projectId'], log_to_filename=draw_log)
                #     if os.path.exists(draw_log):
                #         print("已经存在直接加载")
                #         ff.draw_windows.replay_log(draw_log)
                # endregion

            elif "正在训练" in status:
                channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去
                sql = "UPDATE train_record SET status=%d where task_id='%s'" % (2, train_info['taskId'])
                ff.postgres_execute(sql)
                # # 这里再查询下容器运行状态是否正常
                str = "echo %s | sudo -S docker ps |grep %s" % (ff.root_password, train_info["taskId"])
                log.logger.info(str)
                notify_message = "正在训练......."
                res = os.popen(str).read()
                log.logger.error("正在训练>查询容器是否包含%s，执行结果%s" % (train_info["taskId"], res))
                if '' == res:
                    # 这里说明容器已经停止了，先判断下是不是训练完了
                    cmd = "cat '%s/%s/training_data/train_status_%s.log' | head -n 1" % (
                        ff.assets_base_path, train_info["projectName"], train_info["taskId"])
                    log.logger.info(cmd)
                    str = os.popen(cmd).read().replace('\n', '')
                    if "训练完成" not in str:
                        log.logger.error("正在训练>容器停止-未训完> 训练状态脚本执行结果：%s" % str)
                        os.system("echo '训练失败\c' > '%s/%s/training_data/train_status_%s.log'" %
                                  (ff.assets_base_path, train_info["projectName"], train_info["taskId"]))
                        if connection.is_open:
                            connection.close()
            elif "训练失败" in status:
                sql = "UPDATE train_record SET status=%d where task_id='%s'" % (-1, train_info['taskId'])
                log.logger.error("训练出错")
                log.logger.error("训练出错:" + sql)
                channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                ff.postgres_execute(sql)
                notify_message = "训练失败"
            elif "训练完成" in status:
                sql = "UPDATE train_record SET status=%d where task_id='%s'" % (4, train_info['taskId'])
                log.logger.info("训练完成")
                channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                # region 更新数据库
                ff.postgres_execute(sql)
                os.system("echo %s | sudo -S chmod -R 777 %s/%s" % (
                    ff.root_password, ff.assets_base_path, train_info["projectName"]))
                notify_message = "训练完成"
            elif "停止训练" in status:
                sql = "UPDATE train_record SET status=%d where task_id='%s'" % (3, train_info['taskId'])
                log.logger.info("停止训练")
                channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                ff.postgres_execute(sql)
                notify_message = "停止训练"
                # endregion
        log.logger.info("训练：%s Basic.GetOk %s delivery-tag %i: %s" % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                                      header_frame.content_type,
                                                                      method_frame.delivery_tag,
                                                                      body.decode('utf-8')))
    if connection.is_open:
        connection.close()
    os.system("notify-send PowerAi状态 '项目: %s-%s\n状态: %s' -t %d" % (
        train_info["projectName"], train_info['taskId'], notify_message, 55000))
    return method_frame.delivery_tag, body.decode('utf-8')


@app.route('/train', methods=['POST'])
def do_train_http():
    data = request.json  # 获取 JOSN 数据
    # data = data.get('obj')     #  以字典形式获取参数
    if data is not None:
        # region 第一步先生成配置文件到本地项目目录 pretrainweightpath: 说明如果为""的话就使用官方的预训练模型
        modeldcfgname = None
        if data['providerType'] == net_framework.yolov4Tiny3l["name"]:
            modeldcfgname = net_framework.yolov4Tiny3l["modeldcfgname"]
        pretraincfgname = "" if data["pretrainWeight"] == "" else data["pretrainWeight"].split("_")[0] + ".cfg"

        os.system("echo %s | sudo -S mkdir -p %s/%s/training_data" % (
            ff.root_password, ff.assets_base_path, data["projectName"]))
        os.system("echo %s | sudo -S chmod -R 777 %s/%s/training_data" % (
            ff.root_password, ff.assets_base_path, data["projectName"]))
        # region 写入配置文件
        with open('./config.yaml', 'r', encoding='utf-8') as f:
            result = yaml.load(f.read(), Loader=yaml.FullLoader)
            f.close()
            # region 这里参数和训练队列读取后的一些配置有关
            result["projectName"] = data["projectName"]
            result["taskId"] = data["taskId"]
            result['providerType'] = data['providerType']
            result['image'] = data['image']
            # endregion

            result["batchsize"] = data["batchSize"]
            result["maxiter"] = data["maxIter"]
            result["imagesize"] = [data["imageWidth"], data["imageHeight"]]
            result["modelname"] = data["taskId"]
            result["triantype"] = data["trianType"]
            result["pretrainweight"] = data["pretrainWeight"]
            result["pretraincfgname"] = pretraincfgname
            result["modeldcfgname"] = modeldcfgname
            result["gpus"] = data["gpus"]
            # result["lablelist"] = data["singleTrain"][:]
            result["singletrain"] = data["singleTrain"][:]
            result["angle"] = data["angle"]
            result["cell_stride"] = data["cell_stride"]
            result["cellsize"] = data["cellsize"]
            result["expand_size"] = data["expand_size"][:]
            result["ignore_size"] = data["ignore_size"][:]
            result["resizearrange"] = data["resizearrange"][:]
            result["trainwithnolabelpic"] = data["trainwithnolabelpic"]
            result["subdivisionssize"] = data["subdivisionssize"]
            result["rmgeneratedata"] = data["rmgeneratedata"]
            result["split_ratio"] = data["split_ratio"]
            result["recalldatum"] = data["recalldatum"]
            result["otherlabeltraintype"] = data["otherlabeltraintype"]
            with open('{}/{}/training_data/config.yaml'.format(ff.assets_base_path, data["projectName"]), 'w',
                      encoding='utf-8') as fs:
                yaml.dump(data=result, stream=fs, allow_unicode=True)
                fs.close()
        # region 插入训练队列
        do_basic_publish('ai.train.topic', "train.start.%s" % data['projectName'], yaml.dump(result))
        # endregion
        # region 更新数据库
        # 这里插入前需要判断是否存在相同的项目
        suc, rows = ff.postgres_execute("SELECT * FROM train_record WHERE task_id='%s'" % data['taskId'],
                                        True)
        if rows is None or len(rows) <= 0:
            ff.postgres_execute("INSERT INTO train_record "
                                "(task_id, task_name, project_name,"
                                " status, assets_directory_base,"
                                " assets_directory_name, create_time,"
                                " net_framework, assets_type, draw_url, image_url) "
                                "VALUES ('%s', '%s', '%s', %d, '%s', '%s', '%s', '%s', '%s', '%s', '%s')" %
                                (data['taskId'],
                                 data['taskName'],
                                 data['projectName'],
                                 1,
                                 ff.assets_base_path,
                                 data["projectName"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                 data["providerType"], data["assetsType"],
                                 'http://{}:{}/{}/training_data/train_{}/chart.png'.format(ff.draw_host, ff.draw_port,
                                                                                           data["projectName"],
                                                                                           data['taskId']),
                                 data["image"]
                                 ))
        else:
            ff.postgres_execute("UPDATE train_record SET "
                                "task_name='%s', project_name='%s', status=%d,"
                                " assets_directory_base='%s', assets_directory_name='%s',"
                                " create_time='%s' WHERE task_id='%s'" %
                                (data['taskName'],
                                 data['project_name'],
                                 1,
                                 ff.assets_base_path,
                                 data["projectName"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                 data['task_id']))
        # endregion
        get_train_one()
        return Response(json.dumps({"res": "ok"}), mimetype='application/json')
    else:
        get_train_one()
        return Response(json.dumps({"res": "err"}), mimetype='application/json')


@app.route('/draw_chart', methods=['POST'])
def draw_chat_http():
    try:
        data = request.json
        if data is not None:
            if "爆炸" in json.dumps(data):
                ff.draw_chat(err=True)
            else:
                ff.draw_chat(data)
    except Exception as e:
        try:
            if wechat_monitor:
                my_friend = bot.friends().search('郭永龙')[0]
                my_friend.send('训练溃溃%s' % datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        except Exception as e:
            log.logger.error('send wechat err')
        # ff.draw_chat(err=True)
        log.logger.error(e)
    return Response(json.dumps({"res": "ok"}), mimetype='application/json')


@app.route('/train_list', methods=['GET'])
def get_train_list_http():
    num = request.args.get('num', type=int, default=20)
    page = request.args.get('page', type=int, default=1)
    page = page - 1
    offset = num * page
    ret_json = {"num": num, "page": page, "total": 0, "list": []}
    i, count = ff.postgres_execute("SELECT COUNT(*) FROM train_record", True)
    if count is None:
        ret_json["total"] = 0
    else:
        ret_json["total"] = count[0][0]
    a, rows = ff.postgres_execute(
        "SELECT id, task_id, container_id, project_name, status,"
        " net_framework, assets_type, assets_directory_base, assets_directory_name,"
        " is_jump,draw_url,image_url, to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') as create_time, task_name"
        " FROM train_record order by create_time desc limit %d OFFSET %d" % (num, offset), True)
    if rows is None or len(rows) == 0:
        return json.dumps(ret_json)
    else:
        for row in rows:
            ret_json["list"].append(
                {'id': row[0], 'task_id': str(row[1]), 'task_name': str(row[13]), 'container_id': str(row[2]),
                 'project_name': str(row[3]), 'status': row[4], 'net_framework': str(row[5]),
                 'assets_type': str(row[6]), 'assets_directory_base': str(row[7]),
                 'assets_directory_name': str(row[8]), 'is_jump': row[9],
                 'draw_url': str(row[10]), 'image_url': str(row[11]),
                 'create_time': str(row[12])
                 })
        return Response(json.dumps(ret_json), mimetype='application/json')


@app.route('/stop_train', methods=['POST'])  # 此处提交的参数projectId改为taskId
def stop_train_http():
    try:
        data = request.json
        if data is not None:
            cmd = "echo '%s' | sudo -S docker stop `cat '%s/%s/train.dname'`" % (
                ff.root_password, ff.assets_base_path, data['project_name'])
            log.logger.info('停止训练:%s' % cmd)
            os.system(cmd)  # 会自动退出，所以这里不需要了
            connection, channel, method_frame, header_frame, body = do_basic_get(queue=ff.train_queue)
            if method_frame is not None:
                train_info = yaml.load(body.decode('utf-8'), Loader=yaml.FullLoader)
                if train_info['taskId'] == data["task_id"]:
                    channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                    # 保险起见再写入本地状态文件
                    os.system("echo '停止训练\c' > '%s/%s/training_data/train_status_%s.log'" % (
                        ff.assets_base_path, data["project_name"], data["task_id"]))
            ff.postgres_execute("UPDATE train_record SET "
                                "status=%d WHERE task_id='%s'" %
                                (3, data['task_id']))
    except Exception as e:
        log.logger.error(e)
        return Response(json.dumps({"res": "err"}), mimetype='application/json')
    return Response(json.dumps({"res": "ok"}), mimetype='application/json')


@app.route('/get_record_by_project_id', methods=['POST'])
def get_record_by_project_id():
    try:
        data = request.json
        if data is not None:
            suc, rows = ff.postgres_execute(
                "select net_framework as providerType, assets_directory_name as assets from train_record where project_id ='%s'" %
                data['projectId'],
                True)
            if suc:
                if rows is not None and len(rows) > 0:
                    return Response(json.dumps({"res": "ok", "providerType": rows[0][0], "assets": rows[0][1]}),
                                    mimetype='application/json')
                else:
                    return Response(json.dumps({"res": "ok", "providerType": "none", "assets": "none"}),
                                    mimetype='application/json')
    except Exception as e:
        log.logger.logger.error(e)
        return Response(json.dumps({"res": "err"}), mimetype='application/json')
    return Response(json.dumps({"res": "ok"}), mimetype='application/json')


@app.route('/restart_train', methods=['POST'])
def restart_train_http():
    try:
        data = request.json
        if data is not None:
            trainInfo = {"projectId": data["projectId"],
                         "projectName": data["projectName"],
                         "assetsDir": data["assetsDir"],
                         "assetsType": data["assetsType"],
                         "providerType": data["providerType"],
                         "providerOptions": {"yolov3Image": data["image"]}
                         }

            # config.write(open("test.cfg", "w"))
            docker_volume = "/darknet/assets"
            docker_volume_model = "/darknet/assets/yiningzeng.weights"
            if data['providerType'] == 'yolov3':
                docker_volume = "/darknet/assets"
                docker_volume_model = "/darknet/assets/yiningzeng.weights"
                if "width" in data:
                    os.system('sed -i "s/^width.*/width=%s/g" %s/yolov3-voc.cfg' % (
                        data["width"], ff.assets_base_path + "/" + data["assetsDir"]))
                if "height" in data:
                    os.system('sed -i "s/^height.*/height=%s/g" %s/yolov3-voc.cfg' % (
                        data["height"], ff.assets_base_path + "/" + data["assetsDir"]))
                if "max_batches" in data:
                    os.system('sed -i "s/^max_batches.*/max_batches=%d/g" %s/yolov3-voc.cfg' % (
                        data["max_batches"], ff.assets_base_path + "/" + data["assetsDir"]))
                    os.system('sed -i "s/^steps.*/steps=%d,%d/g" %s/yolov3-voc.cfg' % (
                        int(int(data["max_batches"]) * 0.8), int(int(data["max_batches"]) * 0.9),
                        ff.assets_base_path + "/" + data["assetsDir"]))
            # region detectron
            elif data['providerType'] == 'fasterRcnn' or data['providerType'] == 'maskRcnn':
                trainInfo["providerOptions"] = {"fasterRcnnImage": data["image"]}
                docker_volume = "/Detectron/detectron/datasets/data"
                docker_volume_model = "/Detectron/models/R-50.pkl"

                if "max_batches" in data:  # fasterRcnn 和 maskRcnn 暂时不先替换掉steps
                    os.system('sed -i "s/    MAX_ITER.*/    MAX_ITER: %d/g" %s/train-config.yaml' % (
                        data["max_batches"], ff.assets_base_path + "/" + data["assetsDir"]))
                    # os.system('sed -i "s/^STEPS.*/steps=%d,%d/g" %s/yolov3-voc.cfg' % (
                    #     int(int(data["max_batches"]) * 0.8), int(int(data["max_batches"]) * 0.9),
                    #     ff.package_base_path + "/" + data["assetsDir"]))
            # endregion
            # region detectron2
            elif data['providerType'] == 'fasterRcnn2' or data['providerType'] == 'maskRcnn2' or data[
                'providerType'] == 'keypointRcnn2':
                trainInfo["providerOptions"] = {"detectron2Image": data["image"]}
                docker_volume = "/detectron2/datasets"
                docker_volume_model = "/detectron2/models/R-50.pkl"

                if "max_batches" in data:  # fasterRcnn 和 maskRcnn 暂时不先替换掉steps
                    os.system('sed -i "s/  MAX_ITER.*/  MAX_ITER: %d/g" %s/train-config.yaml' % (
                        data["max_batches"], ff.assets_base_path + "/" + data["assetsDir"]))
                if "weights" in data:  # fasterRcnn 和 maskRcnn 暂时不先替换掉steps
                    os.system('sed -i "s/  WEIGHTS.*/  WEIGHTS: %s/g" %s/train-config.yaml' % (
                        data["weights"], ff.assets_base_path + "/" + data["assetsDir"]))
            # endregion
            elif data['providerType'] == 'other':
                trainInfo["providerOptions"] = {"otherImage": data["image"]}
                docker_volume = data['docker_volume']
                docker_volume_model = data['docker_volume_model']

            if "yolov3-voc_last.weights" not in data["assetsDir"]:
                os.system("echo %s | sudo -s rm %s/backup/yolov3-voc_last.weights" % (
                    ff.root_password, ff.assets_base_path + "/" + data["assetsDir"]))
            # 删除数据转换的状态文件
            os.system("echo %s | sudo -s rm %s/train_log/convert_data.log" % (
                ff.root_password, ff.assets_base_path + "/" + data["assetsDir"]))

            # 写入正在训练，否则队列会重新执行
            os.system("echo '正在训练\c' > '%s/%s/train_status_%s.log'" %
                      (ff.assets_base_path, data["assetsDir"], data["taskId"]))

            # 加入到训练队列
            do_basic_publish('ai.train.topic', "train.start.%s" % data['projectId'], json.dumps(trainInfo))

            cmd = "echo %s | sudo -S docker run --shm-size 32G --memory-swap -1 --rm --gpus '\"device=0,1,2,3,4\"' \
                        --name %s \
                        -v /etc/localtime:/etc/localtime:ro \
                        -v '%s':'%s' \
                        -v '%s':'%s' \
                        --add-host service-postgresql:10.10.0.4 \
                        --add-host service-rabbitmq:10.10.0.3 \
                        --add-host service-ftp:10.10.0.2 \
                        --add-host service-web:10.10.0.5 \
                        --rm -d %s" % (
                ff.root_password,
                data['projectId'].replace("_", ""),
                ff.assets_base_path + "/" + data["assetsDir"], docker_volume,
                data["weights"], docker_volume_model,
                data["image"])
            os.system("echo '%s\c' > '%s/%s/train.dname'" %
                      (data['projectId'].replace("_", ""), ff.assets_base_path, data["assetsDir"]))

            log.logger.info("\n\n**************************\n重新训练: %s\n**************************\n" % cmd)
            os.system(cmd)
            ff.postgres_execute("UPDATE train_record SET "
                                "status=%d WHERE project_id='%s'" %
                                (2, data['projectId']))
    except Exception as e:
        log.logger.error(e)
        return Response(json.dumps({"res": "err"}), mimetype='application/json')
    return Response(json.dumps({"res": "ok"}), mimetype='application/json')


# region 新版本的新增接口
# 获取所属项目列表
@app.route('/get_local_projects', methods=['GET'])
def get_local_projects():
    path_list = []
    # framework_type = "yolov3"
    search_path = ff.assets_base_path + "/*"
    for item in sorted(glob.glob(search_path), key=os.path.getctime,
                       reverse=True):  # key 根据时间排序 reverse true表示倒叙
        filepath, tempfilename = os.path.split(item)
        if os.path.isdir(item):
            path_list.append({"path": item, "dir_name": tempfilename})

    return Response(json.dumps({"res": "ok", "path_list": path_list}), mimetype='application/json')


# 获取所有模型
@app.route('/get_model_list_v2/<framework_type>/<project_name>', methods=['GET'])
def get_model_list_v4(framework_type, project_name):
    model_list = []
    # framework_type = "yolov3"
    search_path = ff.assets_base_path + "/%s/%s/*%s"
    if framework_type == net_framework.yolov4Tiny3l["name"]:
        search_path = search_path % (
            project_name, net_framework.yolov4Tiny3l["modelSavePath"], net_framework.yolov4Tiny3l["modelSuffix"])

    for item in sorted(glob.glob(search_path), key=os.path.getctime,
                       reverse=True):  # key 根据时间排序 reverse true表示倒叙
        filepath, tempfilename = os.path.split(item)
        if "server.pkl" in tempfilename or "test.weights" in tempfilename:
            continue
        model_list.append({"path": item, "filename": tempfilename})

    return Response(json.dumps({"res": "ok", "model_list": model_list}), mimetype='application/json')


# 训练中心通过项目名称获取当下的模型列表
@app.route('/get_release_models_history/<project_name>', methods=['GET'])
def get_project_relase_models_history(project_name):
    models = []
    # framework_type = "yolov3"
    search_path = ff.assets_base_path
    now_model = ""
    # 先获取当前发布的模型
    for item in sorted(glob.glob(search_path + "/%s/model_release/yolov4-tiny-3l/*.weights" % project_name),
                       key=os.path.getctime, reverse=True):
        _, now_model = os.path.split(item)
    for item in sorted(glob.glob(search_path + "/%s/model_release_history/*.weights" % project_name),
                       key=os.path.getmtime, reverse=True):  # key 根据时间排序 reverse true表示倒叙
        path, name = os.path.split(item)
        status = 0
        if now_model == name:  ## STATUS =0  表示 不是最新发布的版本， =1标识是当前最新的版本
            status = 1
        models.append({"name": name, "path": item, "status": status})
    return Response(json.dumps({"res": "ok", "message": "获取成功", "models": models}), mimetype='application/json')


# 模型删除
@app.route('/del_model', methods=['DELETE'])
def delete_model():
    p = unquote(request.args.get('p'))
    os.system("echo %s | sudo -S rm %s" % (ff.root_password, p.replace("backup", "model_release_history")))  # 重命名模型文件
    os.system("echo %s | sudo -S rm %s" % (ff.root_password, p))
    basePath, name = os.path.split(p)
    fname, fename = os.path.splitext(name)  # 文件名和后缀
    os.system("echo %s | sudo -S chmod -R 777 %s" % (ff.root_password, basePath))
    os.system("echo %s | sudo -S rm %s/%s.*" % (ff.root_password, basePath, fname))
    return Response(json.dumps({"res": "ok", "message": "成功"}), mimetype='application/json')


def online_model_func(project_name, label_name, model_path, model_name, suggest_score, width=None, height=None):
    model_base_path, _ = os.path.split(model_path)
    fname, fename = os.path.splitext(model_name)  # 文件名和后缀

    taskName = ""
    suc, rows = ff.postgres_execute("select task_name from train_record where task_id ='%s'" % fname, True)
    if suc and rows is not None and len(rows) > 0:
        taskName = rows[0][0]

    basePath = ff.assets_base_path + "/" + project_name
    os.system("echo %s | sudo -S chmod -R 777 %s" % (ff.root_password, basePath))
    search_path = basePath + "/backup"

    # 首先查看是否存在已经发布的版本文件
    result = {}
    if os.path.exists("%s/modelRelease.yaml" % search_path):
        with open("%s/modelRelease.yaml" % search_path, 'r', encoding='utf-8') as f:
            result = yaml.load(f.read(), Loader=yaml.FullLoader)
            f.close()
    # 开始写入发布的信息
    releaseDate = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    releaseDateFile = "%s/%s.releaseDate" % (model_base_path, fname)
    if os.path.exists(releaseDateFile): # 先判断是不是已经存在发布日期的文件
        with open(releaseDateFile, "r") as fs:
            releaseDate = fs.readline().replace("\n", "") # 已经存在那么把发布日期改为真实的日期
    else: # 不存在，那么新建发布日期
        os.system("echo %s | sudo -S echo '%s' > %s/%s.releaseDate" % (
            ff.root_password, releaseDate, model_base_path, fname))  #

    result[label_name] = {"unique": fname, "releaseDate": releaseDate, "suggestScore": suggest_score}
    with open("%s/modelRelease.yaml" % search_path, 'w', encoding='utf-8') as fs:
        yaml.dump(data=result, stream=fs)
        fs.close()
    fuPath = basePath + "/model_release/yolov4-tiny-3l"
    modelReleasePath = fuPath + "/" + label_name
    os.system("echo %s | sudo -S chmod -R 777 %s" % (ff.root_password, modelReleasePath))  #
    os.system("echo %s | sudo -S mkdir -p %s" % (ff.root_password, modelReleasePath))  #

    # 复制模型文件到发布目录
    os.system("echo %s | sudo -S cp -rf %s %s" % (
        ff.root_password, model_path, modelReleasePath + "/" + label_name + ".weights"))  #
    # 写入发布信息文件到发布目录
    os.system("echo %s | sudo -S echo '训练任务名称: %s\n模型发布日期: %s' > %s" % (
        ff.root_password, taskName, releaseDate, modelReleasePath + "/model_info.txt"))  #
    # 复制配置文件到发布目录
    os.system("echo %s | sudo -S cp -rf %s %s" % (
        ff.root_password, model_path.replace(".weights", ".cfg"), modelReleasePath + "/" + label_name + ".cfg"))  #
    # 复制推荐置信度文件到发布目录
    os.system("echo %s | sudo -S cp -rf %s %s" % (
        ff.root_password, model_path.replace(".weights", ".suggest"), modelReleasePath + "/suggest_score.txt"))  #
    # 写入labels.names到发布目录
    os.system(
        "echo %s | sudo -S echo '%s' > %s" % (ff.root_password, label_name, modelReleasePath + "/labels.names"))  #
    # 复制backup里的labels.names到发布目录
    os.system("echo %s | sudo -S cp -rf %s %s" % (
        ff.root_password, search_path + "/labels.names", fuPath + "/labels.names"))  #

    # 替换网络尺寸
    try:
        if width is not None:
            os.system("echo %s | sudo -S sed -i 's/^width.*=/width=%d #/' %s" %
                      (ff.root_password, width, modelReleasePath + "/" + label_name + ".cfg"))  #
        if height is not None:
            os.system("echo %s | sudo -S sed -i 's/^height.*=/height=%d #/' %s" %
                      (ff.root_password, height, modelReleasePath + "/" + label_name + ".cfg"))  #
    except:
        log.logger.error("err change project size")
    os.system("echo %s | sudo -S zip -jq %s %s/*" % (ff.root_password, modelReleasePath + ".zip", modelReleasePath))  #


@app.route('/get_model_size', methods=['GET'])
def get_model_size():
    model_name = unquote(request.args.get('model_name'))
    label_name = unquote(request.args.get('label_name'))
    project_name = unquote(request.args.get('project_name'))

    basePath = ff.assets_base_path + "/" + project_name
    fname, fename = os.path.splitext(model_name)  # 文件名和后缀

    cfgFile = basePath + "/backup/" + label_name + "/" + fname + ".cfg"

    width = os.popen(
        "sed -rn '/^width.*=[0-9]{1,}/p' %s | sed 's/width//g' | sed 's/=//g' |sed 's/ //g' |sed -r 's/#.*//g'" %
        cfgFile).read().replace('\n', '')
    height = os.popen(
        "sed -rn '/^height.*=[0-9]{1,}/p' %s | sed 's/height//g' | sed 's/=//g' |sed 's/ //g' |sed -r 's/#.*//g'" %
        cfgFile).read().replace('\n', '')
    s = "echo %s | sudo -S hostname -I" % ff.root_password
    ips = str(os.popen(s).read()).replace(" \n", "").split(' ')

    defaultIp = str(os.popen("echo %s | sudo -S cat %s" % (ff.root_password, "./ip")).read()).replace("\n", "").replace(
        " ", "")
    if defaultIp == "" and len(ips) > 0:
        defaultIp = ips[0]
    return Response(json.dumps({"res": "ok", "message": "成功",
                                "width": width, "height": height, "ips": ips, "defaultIp": defaultIp}),
                    mimetype='application/json')


# 模型发布并且上线
@app.route('/online_model', methods=['PUT'])
def online_model():
    model_path = unquote(request.args.get('model_path'))
    label_name = unquote(request.args.get('label_name'))
    model_name = unquote(request.args.get('model_name'))
    project_name = unquote(request.args.get('project_name'))
    suggest_score = unquote(request.args.get('suggest_score'))
    ip = unquote(request.args.get('ip'))
    width = request.args.get('width', type=int, default=None)
    height = request.args.get('height', type=int, default=None)
    # release = "-" + datetime.now().strftime('%Y%m%d') + "-release"
    online_model_func(project_name, label_name, model_path, model_name, suggest_score, width, height)
    os.system("echo %s | sudo -S echo '%s' > '%s'" % (ff.root_password, ip, "./ip"))  # 重命名模型文件
    return Response(json.dumps({"res": "ok", "message": "成功"}), mimetype='application/json')


# 获取当前项目的标签
@app.route('/get_labels/<project_name>', methods=['GET'])
def get_labels(project_name):
    basePath = ff.assets_base_path + "/" + project_name
    os.system("echo %s | sudo -S chmod -R 777 %s" % (ff.root_password, basePath))  # 重命名模型文件
    label_file = basePath + "/backup/labels.names"
    labels = []
    if os.path.exists(label_file):
        lines = open(label_file, 'r')
        for line in lines:
            labels.append(line.replace("\n", ""))
        lines.close()
    # for dirpath, dirnames, filenames in os.walk(search_path + project_name):
    #     for file in filenames:
    #         fullpath = os.path.join(dirpath, file)
    #         if fullpath.endswith(".names"):
    #             lines = open(fullpath, 'r')
    #             for line in lines:
    #                 labels.append(line.replace("\n", ""))
    #             lines.close()
    return Response(json.dumps({"res": "ok", "message": "成功", "labels": list(dict.fromkeys(labels).keys())}),
                    mimetype='application/json')


# 获取当前项目的标签和模型发布的最新日期
@app.route('/get_labels_with_info/<project_name>', methods=['GET'])
def get_labels_with_publish_date(project_name):
    basePath = ff.assets_base_path + "/" + project_name
    os.system("echo %s | sudo -S chmod -R 777 %s" % (ff.root_password, basePath))
    search_path = basePath + "/backup"
    label_file = search_path + "/labels.names"
    suggest_file = "%s/modelRelease.yaml" % search_path
    labels = []
    result = None
    if os.path.exists(suggest_file):
        with open(suggest_file, 'r', encoding='utf-8') as f:
            result = yaml.load(f.read(), Loader=yaml.FullLoader)
            f.close()
    if os.path.exists(label_file):
        lines = open(label_file, 'r')
        for line in lines:
            try:
                label = line.replace("\n", "")
                if result is not None and label in result.keys():
                    labels.append({"label_name": label, "release_date": result[label]["releaseDate"]})
                else:
                    labels.append({"label_name": label, "release_date": None})
            except:
                log.logger.error("err publish models")
        lines.close()
    # for dirpath, dirnames, filenames in os.walk(search_path + project_name):
    #     for file in filenames:
    #         fullpath = os.path.join(dirpath, file)
    #         if fullpath.endswith(".names"):
    #             lines = open(fullpath, 'r')
    #             for line in lines:
    #                 labels.append(line.replace("\n", ""))
    #             lines.close()
    return Response(json.dumps({"res": "ok", "message": "成功", "labels": labels}),
                    mimetype='application/json')


# 训练中心通过项目名称和标签获取当下的模型列表
@app.route('/get_models/<project_name>/<label_name>', methods=['GET'])
def get_project_label_models(project_name, label_name):
    models = []
    basePath = ff.assets_base_path + "/" + project_name
    os.system("echo '%s' | sudo -S chmod -R 777 %s" % (ff.root_password, basePath))
    search_path = basePath + "/backup"
    # framework_type = "yolov3"
    # 先获取当前发布的模型
    model_file = "%s/modelRelease.yaml" % search_path
    now_model = ""
    if os.path.exists(model_file):
        with open(model_file, 'r', encoding='utf-8') as f:
            result = yaml.load(f.read(), Loader=yaml.FullLoader)
            if label_name in result.keys():
                now_model = str(result[label_name]['unique']) + ".weights"
                now_model_path = search_path + "/" + label_name + "/" + now_model
                if os.path.exists(now_model_path):
                    suggest_file = search_path + "/" + label_name + "/" + str(result[label_name]['unique']) + ".suggest"
                    release_date_file = search_path + "/" + label_name + "/" + str(result[label_name]['unique']) + ".releaseDate"
                    suggest_score = None
                    release_date = None
                    if os.path.exists(suggest_file):
                        with open(suggest_file, "r") as fs:
                            suggest_score = fs.readline().replace("\n", "")
                    if os.path.exists(release_date_file):
                        with open(release_date_file, "r") as fs:
                            release_date = fs.readline().replace("\n", "")
                    models.append({"name": now_model, "suggest_score": suggest_score, "release_date": release_date, "path": now_model_path, "status": 2})
            f.close()
    for item in sorted(glob.glob(search_path + "/%s/*.weights" % label_name), key=os.path.getctime,
                       reverse=True):  # key 根据时间排序 reverse true表示倒叙
        path, name = os.path.split(item)
        status = 0
        if now_model != name:
            suggest_file = item.replace(os.path.splitext(item)[1], ".suggest")
            release_date_file = item.replace(os.path.splitext(item)[1], ".releaseDate")
            suggest_score = None
            release_date = None
            if os.path.exists(suggest_file):
                with open(suggest_file, "r") as fs:
                    suggest_score = fs.readline().replace("\n", "")
            if os.path.exists(release_date_file):
                with open(release_date_file, "r") as fs:
                    release_date = fs.readline().replace("\n", "")
            models.append({"name": name, "suggest_score": suggest_score, "release_date": release_date, "path": item, "label_name": label_name, "status": status})
    return Response(json.dumps({"res": "ok", "message": "获取成功", "models": models}), mimetype='application/json')


# 获取推荐置信度参数
@app.route('/ips', methods=['GET'])
def ip_get():
    s = "echo %s | sudo -S hostname -I" % ff.root_password
    log.logger.info(s)
    res = str(os.popen(s).read()).replace(" \n", "").split(' ')
    return Response(
        json.dumps({"res": "ok", "message": "成功", "ips": res}),
        mimetype='application/json')


# 这是给AOI的升级模型接口
@app.route('/get_models', methods=['GET'])
def get_models():
    projects = []
    # framework_type = "yolov3"
    search_path = ff.assets_base_path
    defaultIp = str(os.popen("echo %s | sudo -S cat %s" % (ff.root_password, "./ip")).read()).replace("\n", "").replace(
        " ", "")
    httpUrl = "http://" + defaultIp + ":1121"
    for item in sorted(glob.glob(search_path + "/*"), key=os.path.getctime,
                       reverse=True):  # key 根据时间排序 reverse true表示倒叙
        _, project = os.path.split(item)
        if os.path.isdir(item):
            one_project = {"project_name": project, "list": []}
            f_path = search_path + "/" + project + "/model_release/"
            net_frameworks = []
            for one_framework in glob.glob(f_path + "*"):
                _, one_framework_dir_name = os.path.split(one_framework)
                fra = {"net_framework": one_framework_dir_name, "models": []}
                for one_model in sorted(glob.glob(f_path + one_framework_dir_name + "/*"), key=os.path.getctime,
                                        reverse=True):
                    if one_model.endswith(".zip") or one_model.endswith(".names"):
                        baseUrl = one_model.replace(search_path, httpUrl)
                        fra["models"].append(baseUrl)
                one_project["list"].append(fra)
            projects.append(one_project)
    return Response(json.dumps({"res": 0, "message": "获取成功", "project_list": projects}), mimetype='application/json')
# endregion


class Logger(object):
    level_relations = {
        'debug': logging.DEBUG,
        'info': logging.INFO,
        'warning': logging.WARNING,
        'error': logging.ERROR,
        'crit': logging.CRITICAL
    }  # 日志级别关系映射

    def __init__(self, filename, level='info', when='D', backCount=30,
                 fmt='%(asctime)s - %(pathname)s[line:%(lineno)d] - %(levelname)s: %(message)s'):
        filename = "log/" + filename
        os.system("mkdir log")
        self.logger = logging.getLogger(filename)
        format_str = logging.Formatter(fmt)  # 设置日志格式
        self.logger.setLevel(self.level_relations.get(level))  # 设置日志级别
        sh = logging.StreamHandler()  # 往屏幕上输出
        sh.setFormatter(format_str)  # 设置屏幕上显示的格式
        th = handlers.TimedRotatingFileHandler(filename=filename, when=when, backupCount=backCount,
                                               encoding='utf-8')  # 往文件里写入#指定间隔时间自动生成文件的处理器
        # 实例化TimedRotatingFileHandler
        # interval是时间间隔，backupCount是备份文件的个数，如果超过这个个数，就会自动删除，when是间隔的时间单位，单位有以下几种：
        # S 秒
        # M 分
        # H 小时、
        # D 天、
        # W 每星期（interval==0时代表星期一）
        # midnight 每天凌晨
        th.setFormatter(format_str)  # 设置文件里写入的格式
        self.logger.addHandler(sh)  # 把对象加到logger里
        self.logger.addHandler(th)


if __name__ == '__main__':
    log = Logger('server.log', when="D")
    log.logger.error("开始了")
    if not os.path.isfile("/usr/local/bin/dockertrain"):
        print("dockertrain 执行文件不存在")
        exit(99)
    wechat_monitor = False
    with open("baseConfig.yaml", 'r', encoding='utf-8') as f:
        baseConfig = yaml.load(f.read(), Loader=yaml.FullLoader)
        f.close()

    ff = pikaqiu(root_password=baseConfig['root_password'],
                 rabbitmq_host=baseConfig['rabbitmq_host'],
                 rabbitmq_username=baseConfig['rabbitmq_username'],
                 rabbitmq_password=baseConfig['rabbitmq_password'],
                 assets_base_path='/qtingvisionfolder/Projects')
    ff.init(sql=True, sql_host=baseConfig['sql_host'],
            draw_host=baseConfig['draw_host'],
            draw_port=baseConfig['draw_port'])
    # 创建后台执行的 schedulers
    scheduler = BackgroundScheduler()
    # 添加调度任务
    '''
    weeks(int)  间隔几周
    days(int)   间隔几天
    hours(int)  间隔几小时
    minutes(int)        间隔几分钟
    seconds(int)        间隔多少秒
    start_date(datetime or str) 开始日期
    end_date(datetime or str)   结束日期
    timezone(datetime.tzinfo or   str)  时区
    '''
    get_train_one()
    scheduler.add_job(get_train_one, 'interval', minutes=1)

    if wechat_monitor:
        bot = Bot(cache_path=True, console_qr=True)
        myself = bot.self
        my_friend = bot.friends().search('郭永龙')[0]
        # my_friend.send('微信监督开始')
        bot.file_helper.send('微信监督开始')

    scheduler.start()

    log.logger.info("start")
    # ff.consume(ch, on_message_callback)
    app.run(host="0.0.0.0", port=18888)
    embed()
