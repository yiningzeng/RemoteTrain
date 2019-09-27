# -*- coding=utf-8 -*-
# !/usr/bin/env python
import os
import glob
import pika
import json
import time
import socket
import psycopg2
import numpy as np
from wxpy import *
import logging as log
from retry import retry
from visdom import Visdom
from datetime import datetime
from flask_cors import CORS
from flask import Flask, request, Response
from apscheduler.schedulers.background import BackgroundScheduler

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
log.basicConfig(level=log.INFO,  # 控制台打印的日志级别
                filename='server.log',
                filemode='a',  # 模式，有w和a，w就是写模式，每次都会重新写日志，覆盖之前的日志
                # a是追加模式，默认如果不写的话，就是追加模式
                format=
                '%(asctime)s - %(pathname)s[line:%(lineno)d] - %(levelname)s: %(message)s'
                # 日志格式
                )


class pikaqiu(object):

    def __init__(self, root_password='icubic-123', host='localhost', port=5672,
                 username='guest', password='guest', package_base_path='/assets',
                 train_exchange='ai.train.topic', train_queue='ai.train.topic-queue', train_routing_key='train.start.#',
                 test_exchange='ai.test.topic', test_queue='ai.test.topic-queue', test_routing_key='test.start.#',
                 package_exchange='ai.package.topic', package_queue='ai.package.topic-queue',
                 package_routing_key='package.upload-done.#'
                 ):
        self.package_base_path = package_base_path
        self.root_password = root_password
        self.host = host
        self.port = port
        self.username = username
        self.password = password
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
        self.parameters = pika.URLParameters("amqp://%s:%s@%s:%d" % (username, password, host, port))
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
                # os.system("echo 训练失败-梯度爆炸了 > '%s/%s/train_status.log'" % (self.package_base_path, assets_directory_name))  # 会自动退出，所以这里不需要了
                # os.system("echo '%s' | sudo -S docker stop `cat '%s/%s/train.dname'`" % (self.root_password, self.package_base_path, assets_directory_name))  # 会自动退出，所以这里不需要了
                self.postgres_execute("UPDATE train_record SET "
                                      "status=%d, project_name='%s'"
                                      " WHERE project_id='%s'" %
                                      (-1, str(rows[0][3]) + "-梯度爆炸了", rows[0][0]))
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
                            draw_log = self.package_base_path + "/" + assets_directory_name + "/draw.log"
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
            log.info("sql null")
            return False, result
        log.info(sql)
        try:
            cur = self.postgres_conn.cursor()
            cur.execute(sql)
            if select:
                result = cur.fetchall()
            self.postgres_conn.commit()
            cur.close()
        except Exception:
            return False, result
        else:
            log.info("sql执行成功")
            return True, result

    def postgres_disconnect(self):
        self.postgres_conn.close()
        return True

    @retry(pika.exceptions.AMQPConnectionError, delay=5, jitter=(1, 3))
    def init(self, sql=True, sql_host='localhost', draw=True, draw_host='localhost', draw_port=8097):
        self.draw = draw
        self.draw_host = draw_host
        self.draw_port = draw_port
        self.sql_host = sql_host
        if draw:
            os.system("nohup visdom -port %d > visdom.log 2>&1 & \echo $! > visdom.pid" % draw_port)
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


# 获取单个解包队列数据
def get_package_one():
    log.info('get_package_one:%s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    os.system("notify-send '%s' '%s' -t %d" % ('解包', '解包数据', 10000))
    connection, channel, method_frame, header_frame, body = do_basic_get(queue=ff.package_queue)
    if method_frame is None:
        log.info("解包数据：Empty Basic.Get Response (Basic.GetEmpty)")
        return None, None
        # We have data
    else:
        log.info("解包数据： %s %s delivery-tag %s: %s" % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                      header_frame.content_type,
                                                      method_frame.delivery_tag,
                                                      body.decode('utf-8')))
        package_info = json.loads(body.decode('utf-8'))
        log.info('开始解包')
        os.system('echo "%s" | sudo -S chmod -R 777 /assets' % ff.root_password)
        os.system(
            "tar -xvf '%s/%s' -C '%s'" % (ff.package_base_path, package_info["packageName"], ff.package_base_path))
        os.system("echo 1 > '%s/%s/untar.log'" % (ff.package_base_path, package_info["packageDir"]))
        os.system("echo '%s\c' > '%s/%s/project_id.log'" % (
            package_info['projectId'], ff.package_base_path, package_info["packageDir"]))
        os.system("echo 等待训练 > '%s/%s/train_status.log'" % (ff.package_base_path, package_info["packageDir"]))
        os.system(
            "echo '%s' | sudo -S rm '%s/%s'" % (ff.root_password, ff.package_base_path, package_info["packageName"]))
        # region 更新数据库
        # 这里插入前需要判断是否存在相同的项目
        suc, rows = ff.postgres_execute("SELECT * FROM train_record WHERE project_id='%s'" %
                                        package_info['projectId'],
                                        True)
        if rows is None or len(rows) <= 0:
            ff.postgres_execute("INSERT INTO train_record "
                                "(project_id, project_name,"
                                " status, assets_directory_base,"
                                " assets_directory_name, create_time) "
                                "VALUES ('%s', '%s', %d, '%s', '%s', '%s')" %
                                (package_info['projectId'],
                                 package_info['projectName'],
                                 1,
                                 ff.package_base_path,
                                 package_info["packageDir"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        else:
            ff.postgres_execute("UPDATE train_record SET "
                                "project_name='%s', status=%d,"
                                " assets_directory_base='%s', assets_directory_name='%s',"
                                " create_time='%s' WHERE project_id='%s'" %
                                (package_info['projectName'],
                                 1,
                                 ff.package_base_path,
                                 package_info["packageDir"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                 package_info['projectId']))
        # endregion
        channel.basic_ack(method_frame.delivery_tag)
        connection.close()
        return method_frame.delivery_tag, body.decode('utf-8')


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
    log.info('get_train_one:%s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    os.system("notify-send '%s' '%s' -t %d" % ('ceshi', '测试', 10000))
    connection, channel, method_frame, header_frame, body = do_basic_get(queue=ff.train_queue)
    # chan.basic_ack(msg.delivery_tag)
    # It can be empty if the queue is empty so don't do anything

    if method_frame is None:
        log.info("训练：Empty Basic.Get Response (Basic.GetEmpty)")
        return None, None
        # We have data
    else:
        # 这里需要检查训练素材包是否已经解包，如果未解包，这里需要拒绝，让它重新排队ff.channel.basic_nack
        train_info = json.loads(body.decode('utf-8'))
        if not os.path.exists("%s/%s/untar.log" % (ff.package_base_path, train_info["assetsDir"])):
            log.info('%s 未解包完成' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            channel.basic_nack(method_frame.delivery_tag)
            log.info("解包未完成")
        else:
            # 判断训练状态文件是否存在
            if not os.path.exists("%s/%s/train_status.log" % (ff.package_base_path, train_info["assetsDir"])):
                log.info('%s 等待训练' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                os.system("echo '等待训练\c' > '%s/%s/train_status.log'" %
                          (ff.package_base_path, train_info["assetsDir"]))
                channel.basic_nack(method_frame.delivery_tag)
                log.info("等待训练")
            else:
                status = os.popen("cat '%s/%s/train_status.log' | head -n 1" %
                                  (ff.package_base_path, train_info["assetsDir"])).read().replace('\n', '')
                if "等待训练" in status:
                    channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去

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
                    if train_info['providerType'] == 'yolov3':
                        image_url = train_info['providerOptions']['yolov3Image']
                        docker_volume = "/darknet/assets"
                    elif train_info['providerType'] == 'fasterRcnn':
                        image_url = train_info['providerOptions']['fasterRcnnImage']
                        docker_volume = "/Detectron/detectron/datasets/data"
                    elif train_info['providerType'] == 'maskRcnn':
                        image_url = train_info['providerOptions']['maskRcnnImage']
                        docker_volume = "/Detectron/detectron/datasets/data"
                    elif train_info['providerType'] == 'other':
                        image_url = train_info['providerOptions']['otherImage']
                        docker_volume = train_info['providerOptions']['docker_volume']
                    train_cmd = "dockertrain -n '%s' -v '%s' -w '%s' -t 2 -r '%s' -f '%s' -d '%s'" % \
                                (train_info["projectId"],
                                 ff.package_base_path + "/" + train_info["assetsDir"],
                                 ff.root_password,
                                 image_url,
                                 train_info['providerType'],
                                 docker_volume)
                    log.info("\n\n**************************\n训练的命令: %s\n**************************\n" % train_cmd)

                    if image_url is None or docker_volume is None:
                        log.info(
                            "\n\n**************************\n镜像地址和映射的容器内目录不可为空\n**************************\n")
                        return

                    res = os.popen(train_cmd).read().replace('\n', '')
                    container_id = os.popen("cat %s/container_id.log" % ff.package_base_path + "/" + train_info[
                        "assetsDir"]).read().replace('\n', '')
                    if len(container_id) > 80:
                        container_id = "more than 80"
                    # elif len(container_id) < 63:
                    #     container_id = "less 63"
                    if "train_done" not in res:
                        log.info("训练有误: %s" % res)
                        draw_url = 'http://%s:%d/env/%s' % (ff.draw_host, ff.draw_port, train_info['projectId'])
                        sql = "UPDATE train_record SET container_id='%s', status=%d, net_framework='%s'," \
                              " assets_type='%s', draw_url='%s', image_url='%s' where project_id='%s'" % \
                              (container_id, -1, train_info['providerType'],
                               train_info['assetsType'],
                               draw_url,
                               image_url,
                               train_info['projectId'])
                        log.info("训练:" + sql)
                        ff.postgres_execute(sql)
                        os.system("echo '训练失败\c' > '%s/%s/train_status.log'" %
                                  (ff.package_base_path,
                                   train_info["assetsDir"]))
                        return
                    # 如果res长度==64，那么就是container_id

                    os.system("echo '正在训练\c' > '%s/%s/train_status.log'" %
                              (ff.package_base_path,
                               train_info["assetsDir"]))

                    # region 更新数据库
                    draw_url = 'http://%s:%d/env/%s' % (ff.draw_host, ff.draw_port, train_info['projectId'])
                    sql = "UPDATE train_record SET container_id='%s', status=%d, net_framework='%s'," \
                          " assets_type='%s', draw_url='%s', image_url='%s' where project_id='%s'" % \
                          (container_id, 2, train_info['providerType'],
                           train_info['assetsType'],
                           draw_url,
                           image_url,
                           train_info['projectId'])
                    log.info("训练:" + sql)
                    ff.postgres_execute(sql)
                    # endregion

                    # region 初始化画图visdom
                    if ff.draw:
                        # 保留画图日志，下次打开可直接加载
                        draw_log = ff.package_base_path + "/" + train_info["assetsDir"] + "/draw.log"
                        ff.draw_windows = Visdom(env=train_info['projectId'], log_to_filename=draw_log)
                        if os.path.exists(draw_log):
                            print("已经存在直接加载")
                            ff.draw_windows.replay_log(draw_log)
                    # endregion

                elif "正在训练" in status:
                    channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去
                elif "训练失败" in status:
                    ff.postgres_execute(
                        "UPDATE train_record SET status=%d"
                        "where project_id='%s'" %
                        (-1, train_info['projectId']))
                    channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                elif "训练完成" in status:
                    # region 更新数据库
                    # os.system("echo '训练完成\c' > %s/%s/train_status.log" % (ff.package_base_path,
                    #                                                       train_info["assetsDir"]))
                    ff.postgres_execute(
                        "UPDATE train_record SET status=%d"
                        "where project_id='%s'" %
                        (4, train_info['projectId']))
                    # endregion
                    channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
            log.info("训练：%s Basic.GetOk %s delivery-tag %i: %s" % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                                   header_frame.content_type,
                                                                   method_frame.delivery_tag,
                                                                   body.decode('utf-8')))
    connection.close()
    return method_frame.delivery_tag, body.decode('utf-8')


# 获取单个训练队列数据
def get_test_one():
    log.info('get_test_one:%s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    connection, channel, method_frame, header_frame, body = do_basic_get(queue=ff.test_queue)
    if method_frame is None:
        return None, None
    else:
        test_info = json.loads(body.decode('utf-8'))
        testing = int(os.popen(
            "echo %s | sudo -S docker ps -a | grep %s |wc -l" % (ff.root_password, "power-ai-testing")).read().replace(
            '\n', ''))
        if testing == 0:
            if not os.path.exists("%s/%s/test_status" % (ff.package_base_path, test_info["assetsDir"])):
                os.system("echo '等待检测\c' > '%s/%s/test_status'" %
                          (ff.package_base_path, test_info["assetsDir"]))
                channel.basic_nack(method_frame.delivery_tag)
            else:
                status = os.popen("cat '%s/%s/test_status' | head -n 1" %
                                  (ff.package_base_path, test_info["assetsDir"])).read().replace('\n', '')
                if "等待检测" in status:
                    channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去
                    image_url = None
                    docker_volume = None
                    if test_info['providerType'] == 'yolov3':
                        docker_volume = "/darknet/assets"
                    elif test_info['providerType'] == 'fasterRcnn':
                        docker_volume = "/Detectron/detectron/datasets/data"
                    elif test_info['providerType'] == 'maskRcnn':
                        docker_volume = "/Detectron/detectron/datasets/data"
                    elif test_info['providerType'] == 'other':
                        docker_volume = test_info['providerOptions']['docker_volume']
                    train_cmd = "dockertrain -n 'Power-Ai-%s' -v '%s' -w '%s' -t 2 -r '%s' -f '%s' -d '%s'" % \
                                (test_info["projectId"],
                                 ff.package_base_path + "/" + test_info["assetsDir"],
                                 ff.root_password,
                                 image_url,
                                 test_info['providerType'],
                                 docker_volume)
                    log.info("\n\n**************************\n测试的命令: %s\n**************************\n" % train_cmd)
                elif "正在测试" in status:
                    channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去
                elif "测试失败" in status:
                    channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                elif "测试完成" in status:
                    os.system("echo %s | sudo -S chmod -R 777 %s/%s" % (
                        ff.root_password, ff.package_base_path, test_info["assetsDir"]))
                    os.system("rm %s/%s/test_status" % (ff.package_base_path, test_info["assetsDir"]))
                    os.system("tar -C %s -cf %s/%s.tar infer" % (ff.package_base_path + "/" + test_info["assetsDir"],
                                                                 ff.package_base_path + "/" + test_info["assetsDir"],
                                                                 test_info["assetsDir"] + "检测结果"))
                    os.system("rm -r %s/%s/infer" % (ff.package_base_path, test_info["assetsDir"]))
                    channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
    connection.close()
    return method_frame.delivery_tag, body.decode('utf-8')


@app.route('/power-ai-train', methods=['POST'])
def do_power_ai_train_http():
    data = request.json  # 获取 JOSN 数据
    # data = data.get('obj')     #  以字典形式获取参数
    if data is not None:
        package_info = {"projectId": data["projectId"], "projectName": data["projectName"],
                        "packageDir": data["packageDir"], "packageName": data["packageName"]}
        # region 更新数据库
        # 这里插入前需要判断是否存在相同的项目
        suc, rows = ff.postgres_execute("SELECT * FROM train_record WHERE project_id='%s'" % package_info['projectId'],
                                        True)
        if rows is None or len(rows) <= 0:
            ff.postgres_execute("INSERT INTO train_record "
                                "(project_id, project_name,"
                                " status, assets_directory_base,"
                                " assets_directory_name, create_time) "
                                "VALUES ('%s', '%s', %d, '%s', '%s', '%s')" %
                                (package_info['projectId'],
                                 package_info['projectName'],
                                 0,
                                 ff.package_base_path,
                                 package_info["packageDir"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        else:
            ff.postgres_execute("UPDATE train_record SET "
                                "project_name='%s', status=%d,"
                                " assets_directory_base='%s', assets_directory_name='%s',"
                                " create_time='%s' WHERE project_id='%s'" %
                                (package_info['projectName'],
                                 0,
                                 ff.package_base_path,
                                 package_info["packageDir"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                 package_info['projectId']))
        # endregion
        return Response(json.dumps({"res": "ok"}), mimetype='application/json')
    else:
        return Response(json.dumps({"res": "err"}), mimetype='application/json')


@app.route('/train', methods=['POST'])
def do_train_http():
    data = request.json  # 获取 JOSN 数据
    # data = data.get('obj')     #  以字典形式获取参数
    if data is not None:
        # const
        # trainInfo = {
        #     projectId: project.id,
        #     projectName: project.name,
        #     assetsDir: tarBaseName,
        #     assetsType: project.exportFormat.providerType,
        #     ...project.trainFormat,
        # };
        # {"projectId":"","projectName":"","assetsDir":"素材目录","assetsType":"pascalVOC","ip":"","providerOptions":{"yolov3Image":"registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_auto-ai-power-v3.6","yolov3net":{"angle":360,"batch":64,"burn_in":1000,"channels":3,"decay":0.0005,"exposure":1.5,"gpu_numb":6,"height":608,"hue":0.1,"learning_rate":0.001,"max_batches":50000,"saturation":1.5,"subdivisions":32,"width":608}},"providerType":"yolov3"}
        package_info = {"projectId": data["projectId"], "projectName": data["projectName"],
                        "packageDir": data["packageDir"], "packageName": data["packageName"]}
        trainInfo = {"projectId": data["projectId"],
                     "projectName": data["projectName"],
                     "assetsDir": data["assetsDir"],
                     "assetsType": data["assetsType"],
                     "providerType": data["providerType"],
                     "providerOptions": {"yolov3Image": data["image"]}
                     }
        if data['providerType'] == 'fasterRcnn':
            trainInfo["providerOptions"] = {"fasterRcnnImage": data["image"]}
        elif data['providerType'] == 'maskRcnn':
            trainInfo["providerOptions"] = {"maskRcnnImage": data["image"]}
        elif data['providerType'] == 'other':
            trainInfo["providerOptions"] = {"otherImage": data["image"]}

        do_basic_publish('ai.package.topic', "package.upload-done.%s" % data['projectName'], json.dumps(package_info))
        do_basic_publish('ai.train.topic', "train.start.%s" % data['projectName'], json.dumps(trainInfo))
        # region 更新数据库
        # 这里插入前需要判断是否存在相同的项目
        suc, rows = ff.postgres_execute("SELECT * FROM train_record WHERE project_id='%s'" % package_info['projectId'],
                                        True)
        if rows is None or len(rows) <= 0:
            ff.postgres_execute("INSERT INTO train_record "
                                "(project_id, project_name,"
                                " status, assets_directory_base,"
                                " assets_directory_name, create_time) "
                                "VALUES ('%s', '%s', %d, '%s', '%s', '%s')" %
                                (package_info['projectId'],
                                 package_info['projectName'],
                                 0,
                                 ff.package_base_path,
                                 package_info["packageDir"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        else:
            ff.postgres_execute("UPDATE train_record SET "
                                "project_name='%s', status=%d,"
                                " assets_directory_base='%s', assets_directory_name='%s',"
                                " create_time='%s' WHERE project_id='%s'" %
                                (package_info['projectName'],
                                 0,
                                 ff.package_base_path,
                                 package_info["packageDir"],
                                 datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                 package_info['projectId']))
        # endregion
        return Response(json.dumps({"res": "ok"}), mimetype='application/json')
    else:
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
            log.error('send wechat err')
        # ff.draw_chat(err=True)
        log.error(e)
    return Response(json.dumps({"res": "ok"}), mimetype='application/json')


@app.route('/train_list', methods=['GET'])
def get_train_list_http():
    num = request.args.get('num', type=int, default=20)
    page = request.args.get('page', type=int, default=0)
    offset = num * page
    ret_json = {"num": num, "page": page, "total": 0, "list": []}
    i, count = ff.postgres_execute("SELECT COUNT(*) FROM train_record", True)
    if count is None:
        ret_json["total"] = 0
    else:
        ret_json["total"] = count[0][0]
    a, rows = ff.postgres_execute(
        "SELECT id, project_id, container_id, project_name, status,"
        " net_framework, assets_type, assets_directory_base, assets_directory_name,"
        " is_jump,draw_url,image_url, to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') as create_time"
        " FROM train_record order by create_time desc limit %d OFFSET %d" % (num, offset), True)
    if rows is None or len(rows) == 0:
        return json.dumps(ret_json)
    else:
        for row in rows:
            ret_json["list"].append({'id': row[0], 'project_id': str(row[1]), 'container_id': str(row[2]),
                                     'project_name': str(row[3]), 'status': row[4], 'net_framework': str(row[5]),
                                     'assets_type': str(row[6]), 'assets_directory_base': str(row[7]),
                                     'assets_directory_name': str(row[8]), 'is_jump': row[9],
                                     'draw_url': str(row[10]), 'image_url': str(row[11]),
                                     'create_time': str(row[12])
                                     })
        return Response(json.dumps(ret_json), mimetype='application/json')


# region 测试服务的所有接口
@app.route('/get_model_list/<framework_type>/<path>', methods=['GET'])
def get_model_list(framework_type, path):
    weights_list = []
    width = 0
    height = 0
    max_batches = 0
    # framework_type = "yolov3"
    search_path = "/assets/%s/backup/*.weights"
    if framework_type == 'yolov3':
        search_path = "/assets/%s/backup/*.weights"
        cmd = "sed -n '/width/p' %s/yolov3-voc.cfg | sed 's/width//g' |sed 's/=//g' |sed 's/ //g'" % (
                    ff.package_base_path + "/" + path)
        width = os.popen(cmd).read().replace('\n', '')
        height = os.popen("sed -n '/height/p' %s/yolov3-voc.cfg | sed 's/height//g' |sed 's/=//g' |sed 's/ //g'" % (
                    ff.package_base_path + "/" + path)).read().replace('\n', '')
        max_batches = os.popen(
            "sed -n '/max_batches/p' %s/yolov3-voc.cfg | sed 's/max_batches//g' |sed 's/=//g' |sed 's/ //g'" % (
                        ff.package_base_path + "/" + path)).read().replace('\n', '')
    elif framework_type == 'fasterRcnn' or framework_type == 'maskRcnn':
        search_path = "/assets/%s/result/train/coco_2014_train/generalized_rcnn/*.pkl"
        max_batches = os.popen(
            "sed -n '/MAX_ITER/p' %s/train-config.yaml | sed 's/MAX_ITER//g' |sed 's/://g' |sed 's/ //g'" % (
                    ff.package_base_path + "/" + path)).read().replace('\n', '')
    elif framework_type == 'other':
        search_path = "不支持，后续开发"

    for item in sorted(glob.glob(search_path % path), key=os.path.getmtime,
                       reverse=True):  # key 根据时间排序 reverse true表示倒叙
        filepath, tempfilename = os.path.split(item)
        if "server.pkl" in tempfilename or "test.weights" in tempfilename:
            continue
        weights_list.append({"path": item, "filename": tempfilename})

    return Response(json.dumps({"res": "ok", "weights_list": weights_list, "width": width, "height": height, "max_batches": max_batches}), mimetype='application/json')


@app.route('/start_test', methods=['POST'])
def start_test():
    try:
        data = request.json
        if data is not None:
            docker_volume = "/darknet/assets"
            docker_volume_model = "/darknet/assets/backup/yolov3-voc_last.weights"
            port = data['port']  # 检测服务的端口 容器内外都一致，java 中间件对外端口在这个基础上+1
            docker_name = "darknet-service-testing"  # 用于每次新建 删除
            if data['providerType'] == 'yolov3':
                docker_name = "darknet-service-testing"
                docker_volume = "/darknet/assets"
                docker_volume_model = "/darknet/assets/backup/yolov3-voc_last.weights"
            elif data['providerType'] == 'fasterRcnn':
                docker_name = "detectron-service-testing"
                docker_volume = "/Detectron/detectron/datasets/data"
                docker_volume_model = "/Detectron/detectron/datasets/data/result/train/coco_2014_train/generalized_rcnn/server.pkl"
            elif data['providerType'] == 'maskRcnn':
                docker_name = "detectron-service-testing"
                docker_volume = "/Detectron/detectron/datasets/data"
                docker_volume_model = "/Detectron/detectron/datasets/data/result/train/coco_2014_train/generalized_rcnn/server.pkl"
            elif data['providerType'] == 'other':
                docker_name = "other-service-testing"
                docker_volume = data['docker_volume']
                docker_volume_model = data['docker_volume_model']

            os.system('cp %s/yolov3-voc.cfg %s/yolov3-voc-test.cfg' % (
                ff.package_base_path + "/" + data["assetsDir"],
                ff.package_base_path + "/" + data["assetsDir"]))

            os.system('sed -i "s/^batch.*/batch=1/g" %s/yolov3-voc-test.cfg' % (ff.package_base_path + "/" + data["assetsDir"]))
            os.system('sed -i "s/^subdivisions.*/subdivisions=1/g" %s/yolov3-voc-test.cfg' % (ff.package_base_path + "/" + data["assetsDir"]))

            os.system("echo '%s' | sudo -S docker stop '%s'" % (ff.root_password, docker_name))
            cmd = "echo %s | sudo -S docker run --gpus '\"device=5\"' \
                        --name %s \
                        -p %d:8070 \
                        -p %d:%d \
                        -v /opt/remote_train_web/aiimg/:/aiimg \
                        -v /opt/remote_train_web/excel/:/excel \
                        -v /etc/localtime:/etc/localtime:ro \
                        -v '%s':'%s' \
                        -v '%s':'%s' \
                        --add-host service-postgresql:10.10.0.4 \
                        --add-host service-rabbitmq:10.10.0.3 \
                        --add-host service-ftp:10.10.0.2 \
                        --add-host service-web:10.10.0.5 \
                        --rm -d %s" % (
                ff.root_password,
                docker_name,
                port + 1,
                port, port,
                ff.package_base_path + "/" + data["assetsDir"], docker_volume,
                data["weights"], docker_volume_model,
                data["image"])
            log.info("\n\n**************************\n测试的命令: %s\n**************************\n" % cmd)
            os.system(cmd)
            start_time = time.time()
            while 1:
                time.sleep(0.5)
                if net_is_used(int(port)):
                    break
                if (time.time() - start_time) > 60:
                    return Response(json.dumps({"res": "err", "msg": "开启超时，请手动查询状态"}), mimetype='application/json')
            # registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_auto_test-service-ai-power-v4.5
    except Exception as e:
        log.error(e)
        return Response(json.dumps({"res": "err", "msg": "开启失败"}), mimetype='application/json')
    return Response(json.dumps({"res": "ok", "msg": "开启成功"}), mimetype='application/json')


@app.route('/stop_train', methods=['POST'])
def stop_train_http():
    try:
        data = request.json
        if data is not None:
            cmd = "echo '%s' | sudo -S docker stop `cat '%s/%s/train.dname'`" % (
                ff.root_password, ff.package_base_path, data['assetsDir'])
            log.info('停止训练:%s' % cmd)
            os.system(cmd)  # 会自动退出，所以这里不需要了
            ff.postgres_execute("UPDATE train_record SET "
                                "status=%d WHERE project_id='%s'" %
                                (3, data['projectId']))
    except Exception as e:
        log.error(e)
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
            docker_volume_model = "/darknet/assets/backup/yolov3-voc_last.weights"
            if data['providerType'] == 'yolov3':
                docker_volume = "/darknet/assets"
                docker_volume_model = "/darknet/assets/backup/yolov3-voc_last.weights"

                if "width" in data:
                    os.system('sed -i "s/^width.*/width=%s/g" %s/yolov3-voc.cfg' % (
                        data["width"], ff.package_base_path + "/" + data["assetsDir"]))
                if "height" in data:
                    os.system('sed -i "s/^height.*/height=%s/g" %s/yolov3-voc.cfg' % (
                        data["height"], ff.package_base_path + "/" + data["assetsDir"]))
                if "max_batches" in data:
                    os.system('sed -i "s/^max_batches.*/max_batches=%d/g" %s/yolov3-voc.cfg' % (
                        data["max_batches"], ff.package_base_path + "/" + data["assetsDir"]))
                    os.system('sed -i "s/^steps.*/steps=%d,%d/g" %s/yolov3-voc.cfg' % (
                        int(int(data["max_batches"]) * 0.8), int(int(data["max_batches"]) * 0.9),
                        ff.package_base_path + "/" + data["assetsDir"]))

            elif data['providerType'] == 'fasterRcnn' or data['providerType'] == 'maskRcnn':
                trainInfo["providerOptions"] = {"fasterRcnnImage": data["image"]}
                docker_volume = "/Detectron/detectron/datasets/data"
                docker_volume_model = "/Detectron/models/R-50.pkl"

                if "max_batches" in data: # fasterRcnn 和 maskRcnn 暂时不先替换掉steps
                    os.system('sed -i "s/    MAX_ITER.*/    MAX_ITER: %d/g" %s/train-config.yaml' % (
                        data["max_batches"], ff.package_base_path + "/" + data["assetsDir"]))
                    # os.system('sed -i "s/^STEPS.*/steps=%d,%d/g" %s/yolov3-voc.cfg' % (
                    #     int(int(data["max_batches"]) * 0.8), int(int(data["max_batches"]) * 0.9),
                    #     ff.package_base_path + "/" + data["assetsDir"]))
            elif data['providerType'] == 'other':
                trainInfo["providerOptions"] = {"otherImage": data["image"]}
                docker_volume = data['docker_volume']
                docker_volume_model = data['docker_volume_model']

            if "yolov3-voc_last.weights" not in data["assetsDir"]:
                os.system("echo %s | sudo -s rm %s/backup/yolov3-voc_last.weights" % (ff.root_password, ff.package_base_path + "/" + data["assetsDir"]))
            os.system("echo %s | sudo -s rm %s/train_log/convert_data.log" % (ff.root_password, ff.package_base_path + "/" + data["assetsDir"]))

            # 写入正在训练，否则队列会重新执行
            os.system("echo '正在训练\c' > '%s/%s/train_status.log'" %
                      (ff.package_base_path, data["assetsDir"]))

            # 加入到训练队列
            do_basic_publish('ai.train.topic', "train.start.%s" % data['projectId'], json.dumps(trainInfo))

            cmd = "echo %s | sudo -S docker run --gpus all \
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
                ff.package_base_path + "/" + data["assetsDir"], docker_volume,
                data["weights"], docker_volume_model,
                data["image"])
            os.system("echo '%s\c' > '%s/%s/train.dname'" %
                      (data['projectId'].replace("_", ""), ff.package_base_path, data["assetsDir"]))

            log.info("\n\n**************************\n重新训练: %s\n**************************\n" % cmd)
            os.system(cmd)
            ff.postgres_execute("UPDATE train_record SET "
                                "status=%d WHERE project_id='%s'" %
                                (2, data['projectId']))
    except Exception as e:
        log.error(e)
        return Response(json.dumps({"res": "err"}), mimetype='application/json')
    return Response(json.dumps({"res": "ok"}), mimetype='application/json')
# endregion


if __name__ == '__main__':
    # id = os.popen(
    #     'cat /home/baymin/daily-work/ftp/train-assets-cizhuan-fasterRcnn-20190808/container_id.log | head -n 1')
    # .read().replace('\n', '')
    #
    # print(id)

    # channel = connection.channel()
    debug = False
    wechat_monitor = False
    if debug:
        ff = pikaqiu(root_password='baymin1024', host='192.168.31.157', username='baymin', password='baymin1024',
                     package_base_path='/assets')
    else:
        ff = pikaqiu(root_password='icubic-123', host='192.168.31.75', username='baymin', password='baymin1024',
                     package_base_path='/assets')
    # init(self, sql=True, sql_host='localhost', draw=True, draw_host='localhost', draw_port=8097):
    # sql: 是否开启数据库，sql_host：数据库地址，draw：是否开启画图，draw_host：画图的服务地址，draw_port：画图的服务端口
    ff.init(sql=False, sql_host='192.168.31.75', draw_host='maps.qtingvision.com', draw_port=888)

    # 创建后台执行的 schedulers
    scheduler = BackgroundScheduler()
    # 添加调度任务

    # 提醒写日报
    # scheduler.add_job(remind, 'cron', second="0/2")

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
    if debug:
        scheduler.add_job(get_train_one, 'interval', minutes=10000)
        scheduler.add_job(get_package_one, 'interval', minutes=5000)
        scheduler.add_job(get_test_one, 'interval', seconds=5)
    else:
        if wechat_monitor:
            bot = Bot(cache_path=True, console_qr=True)
            myself = bot.self
            my_friend = bot.friends().search('郭永龙')[0]
            # my_friend.send('微信监督开始')
            bot.file_helper.send('微信监督开始')
        scheduler.add_job(get_train_one, 'interval', minutes=10)
        scheduler.add_job(get_package_one, 'interval', minutes=5)
        scheduler.add_job(get_test_one, 'interval', seconds=5)
    # scheduler.add_job(get_package_one, 'interval', seconds=5)
    scheduler.start()

    log.info("start")
    # ff.consume(ch, on_message_callback)
    app.run(host="0.0.0.0", port=18888)
    embed()
