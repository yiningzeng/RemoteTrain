# !/usr/bin/env python
import os
import pika
import json
import time
import psycopg2
from wxpy import *
import logging as log
from retry import retry
from datetime import datetime
from flask_cors import CORS
from flask import Flask, request, Response
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)

# rabbitmq 文档 https://pika.readthedocs.io/en/stable/modules/channel.html
# retry https://github.com/invl/retry
# pika https://pypi.org/project/pika/

#


'''
usage:  dockertrainD  -p  映射到本地的端口 默认8097 如果被占用会自动分配，只检测端口占用情况，可能存在多个未开启的容器相同端口的情况
                      -n  项目名 默认 ""
                      -v  需要映射的素材目录(必填)
                      -r  docker镜像的地址 默认registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-wo-v3.6
                      -w  root密码 默认icubic-123
                      -g  复制脚本到/usr/local/bin/，后面执行可以全局dockertrainD
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
                 username='guest', password='guest', package_base_path='/home/baymin/daily-work/ftp/',
                 train_exchange='ai.train.topic', train_queue='ai.train.topic-queue', train_routing_key='train.start.#',
                 package_exchange='ai.package.topic', package_queue='ai.package.topic-queue',
                 package_routing_key='package.upload-done.#'
                 ):
        self.channel = None
        self.package_base_path = package_base_path
        self.root_password = root_password
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        # region 训练队列参数
        self.train_exchange = train_exchange
        self.train_queue = train_queue
        self.train_routing_key = train_routing_key
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

    '''
    获取单个解包队列数据
    '''

    def get_package_one(self):
        log.info('get_package_one:%s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        os.system("notify-send '%s' '%s' -t %d" % ('解包', '解包数据', 10000))
        method_frame, header_frame, body = self.channel.basic_get(queue=self.package_queue, auto_ack=False)
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
            os.system("tar -xvf %s/%s -C %s" % (self.package_base_path, package_info["packageName"], self.package_base_path))
            os.system("echo 1 > %s/%s/untar.txt" % (self.package_base_path, package_info["packageDir"]))
            os.system("echo 等待训练 > %s/%s/train_status.txt" % (self.package_base_path, package_info["packageDir"]))
            os.system("rm %s/%s" % (self.package_base_path, package_info["packageName"]))
            # region 更新数据库
            # 这里插入前需要判断是否存在相同的项目
            suc, rows = self.postgres_execute("SELECT * FROM train_record WHERE project_id='%s'" %
                                              package_info['projectId'],
                                              True)
            if len(rows) > 0:
                self.postgres_execute("UPDATE train_record SET "
                                      "project_name='%s', status=%d,"
                                      " assets_directory_base='%s', assets_directory_name='%s',"
                                      " create_time='%s' WHERE project_id='%s'" %
                                      (package_info['projectName'],
                                       1,
                                       self.package_base_path,
                                       package_info["packageDir"],
                                       datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                       package_info['projectId']))
            else:
                self.postgres_execute("INSERT INTO train_record "
                                      "(project_id, project_name,"
                                      " status, assets_directory_base,"
                                      " assets_directory_name, create_time) "
                
                                      "VALUES ('%s', '%s', %d, '%s', '%s', '%s')" %
                                      (package_info['projectId'],
                                       package_info['projectName'],
                                       1,
                                       self.package_base_path,
                                       package_info["packageDir"],
                                       datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            # endregion
            ch.basic_ack(method_frame.delivery_tag)
            return method_frame.delivery_tag, body.decode('utf-8')

    '''
    获取单个训练队列数据
    '''
    def get_train_one(self):
        log.info('get_train_one:%s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        os.system("notify-send '%s' '%s' -t %d" % ('ceshi', '测试', 10000))
        method_frame, header_frame, body = self.channel.basic_get(queue=self.train_queue, auto_ack=False)
        # chan.basic_ack(msg.delivery_tag)
        # It can be empty if the queue is empty so don't do anything

        if method_frame is None:
            log.info("训练：Empty Basic.Get Response (Basic.GetEmpty)")
            return None, None
            # We have data
        else:
            # 这里需要检查训练素材包是否已经解包，如果未解包，这里需要拒绝，让它重新排队self.channel.basic_nack
            train_info = json.loads(body.decode('utf-8'))
            if not os.path.exists("%s%s/untar.txt" % (self.package_base_path, train_info["assetsDir"])):
                log.info('%s 未解包完成' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                self.channel.basic_nack(method_frame.delivery_tag)
                log.info("解包未完成")
            else:
                # 判断训练状态文件是否存在
                if not os.path.exists("%s%s/train_status.txt" % (self.package_base_path, train_info["assetsDir"])):
                    log.info('%s 等待训练' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                    os.system("echo '等待训练\c' > %s/%s/train_status.txt" % (self.package_base_path, train_info["assetsDir"]))
                    self.channel.basic_nack(method_frame.delivery_tag)
                    log.info("等待训练")
                else:
                    status = os.popen("cat  %s/%s/train_status.txt | head -n 1" %
                                      (self.package_base_path, train_info["assetsDir"])).read().replace('\n', '')
                    if status == "等待训练":
                        self.channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去
                        res = os.popen("dockertrainD -n %s -v %s -w %s -t 1" %
                                       (train_info["assetsDir"],
                                        self.package_base_path + train_info["assetsDir"],
                                        self.root_password)).read().replace('\n', '')
                        if len(res) != 64:
                            log.info("训练有误: %s" % res)
                            return
                        # 如果res长度==64，那么就是container_id

                        os.system("echo '正在训练\c' > %s/%s/train_status.txt" %
                                  (self.package_base_path,
                                   train_info["assetsDir"]))

                        # region 更新数据库
                        sql = "UPDATE train_record SET container_id='%s', status=%d, net_framework='%s'," \
                              " assets_type='%s' where project_id='%s'" % \
                              (res, 2, train_info['providerType'],
                               train_info['assetsType'], train_info['projectId'])
                        log.info("训练:"+sql)
                        self.postgres_execute(sql)
                        # endregion

                    elif status == "正在训练":
                        self.channel.basic_nack(method_frame.delivery_tag)  # 告诉队列他要滚回队列去
                    elif status == "训练完成":
                        # region 更新数据库
                        # os.system("echo '训练完成\c' > %s/%s/train_status.txt" % (self.package_base_path,
                        #                                                       train_info["assetsDir"]))
                        self.postgres_execute(
                            "UPDATE train_record SET status=%d"
                            "where project_id='%s'" %
                            (3, train_info['projectId']))
                        # endregion
                        self.channel.basic_ack(method_frame.delivery_tag)  # 告诉队列可以放行了
                log.info("训练：%s Basic.GetOk %s delivery-tag %i: %s" % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                                    header_frame.content_type,
                                                                    method_frame.delivery_tag,
                                                                    body.decode('utf-8')))
            return method_frame.delivery_tag, body.decode('utf-8')

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
    def init(self, sql=True, sql_host='localhost'):
        if sql:
            self.postgres_connect(host=sql_host)
        connection = pika.BlockingConnection(self.parameters)
        channel = connection.channel()
        self.channel = channel
        try:
            # region创建训练队列
            channel.exchange_declare(self.train_exchange, "topic", passive=True, durable=True)
            channel.queue_declare(self.train_queue, passive=True, durable=True)
            channel.queue_bind(self.train_queue, self.train_exchange, self.train_routing_key)
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
            # region创建训练素材解包队列
            channel = connection.channel()
            channel.exchange_declare(self.package_exchange, "topic", durable=True)
            channel.queue_declare(self.package_queue)
            channel.queue_bind(self.package_queue, self.package_exchange, self.package_routing_key)
            # endregion
        return channel
        # self.get_one(channel)


CORS(app, resources=r'/*')
@app.route('/train_list', methods=['GET'])
def main():
    num = request.args.get('num', type=int, default=20)
    page = request.args.get('page', type=int, default=0)
    offset = num * page
    ret_json = {"num": num, "page": page, "total": 0, "list": []}
    i, count = ff.postgres_execute("SELECT COUNT(*) FROM train_record", True)
    ret_json["total"] = count[0][0]
    a, rows = ff.postgres_execute(
        "SELECT id, project_id, container_id, project_name, status,"
        " net_framework, assets_type, assets_directory_base, assets_directory_name,"
        " is_jump, to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') as create_time"
        " FROM train_record order by create_time limit %d OFFSET %d" % (num, offset), True)
    if rows is None or len(rows) == 0:
        return json.dumps(ret_json)
    else:
        for row in rows:
            ret_json["list"].append({'id': row[0], 'project_id': str(row[1]), 'container_id': str(row[2]),
                                     'project_name': str(row[3]), 'status': row[4], 'net_framework': str(row[5]),
                                     'assets_type': str(row[6]), 'assets_directory_base': str(row[7]),
                                     'assets_directory_name': str(row[8]), 'is_jump': row[9], 'create_time': str(row[10])
                                     })
        return Response(json.dumps(ret_json), mimetype='application/json')


if __name__ == '__main__':
    # id = os.popen(
    #     'cat /home/baymin/daily-work/ftp/train-assets-cizhuan-fasterRcnn-20190808/container_id.txt | head -n 1')
    # .read().replace('\n', '')
    #
    # print(id)

    # channel = connection.channel()

    ff = pikaqiu(root_password='baymin1024', host='192.168.31.75', username='baymin', password='baymin1024',
                 package_base_path='/home/baymin/daily-work/ftp/')
    ch = ff.init(sql_host='192.168.31.75')

    # 创建后台执行的 schedulers
    scheduler = BackgroundScheduler()
    # 添加调度任务

    # 提醒写日报
    # scheduler.add_job(remind, 'cron', second="0/2")

    '''
    weeks(int)	间隔几周
    days(int)	间隔几天
    hours(int)	间隔几小时
    minutes(int)	间隔几分钟
    seconds(int)	间隔多少秒
    start_date(datetime or str)	开始日期
    end_date(datetime or str)	结束日期
    timezone(datetime.tzinfo or   str)	时区
    '''
    scheduler.add_job(ff.get_train_one, 'interval', minutes=30)
    scheduler.add_job(ff.get_package_one, 'interval', minutes=20)
    # scheduler.add_job(ff.get_train_one, 'interval', seconds=10)
    # scheduler.add_job(ff.get_package_one, 'interval', seconds=5)
    scheduler.start()

    log.info("start")
    # ff.consume(ch, on_message_callback)
    app.run(host="0.0.0.0", port=18888)
    embed()

    # 声明queue
    # channel.queue_declare(queue='balance')
    # n RabbitMQ a message can never be sent directly to the queue, it always needs to go through an exchange.

    # channel.basic_publish(exchange='ai.train.topic',
    #               routing_key='train.start.test.fast',
    #               body='{fufuasdaskjdsa: "asdasdasdasds"}')
    # connection.close()

    # @retry()
    # def make_trouble():
    #     print('\nretry')
    #     '''Retry until succeed'''
    #
    #

    # def backcall(ch, method, properties, body):  # 参数body是发送过来的消息。
    #     print(ch, method, properties)
    #     print('\n[x] Received %r' % body)
    #     os.system("notify-send '训练队列' '%s' -t %d" % (body, 100000))
    #
    #     # 1.开始训练
    #     # 2.训练结束后生成done.txt 在目录下
    #     # 答复此条消息已经处理完成，这里要判断，在目录下有没有done.txt，有的话就回复完成
    #     # ch.basic_ack(method.delivery_tag)
    #
    #
    # print(channel.basic_get(queue='ai.train.topic-queue', auto_ack=False))
    #
    # # bot = Bot(cache_path=True, console_qr=True)
    # # 创建后台执行的 schedulers
    # scheduler = BackgroundScheduler()
    # # 添加调度任务
    #
    # # 提醒写日报
    # # scheduler.add_job(remind, 'cron', second="0/2")
    # scheduler.add_job(remind, 'interval', seconds=5)
    # # scheduler.add_job(create_daily, 'cron', second="0", minute="5", hour="1", day_of_week="MON-SUN")
    # # scheduler.add_job(push_daily, 'cron', second="0", minute="5", hour="19", day_of_week="MON-SUN")
    # # 调度方法为 timedTask，触发器选择 interval(间隔性)，间隔时长为 2 秒  0 15 10 ? * MON-FRI
    # # scheduler.add_job(send_daily, 'cron', second="0", minute="30", hour="20", day_of_week="MON-SAT")
    #
    # # time.sleep(6)
    # # print(channel.basic_get(queue='ai.train.topic-queue', auto_ack=False))
    # # print(channel.basic_get(queue='ai.train.topic-queue', auto_ack=False))
    # # print(channel.basic_get(queue='ai.train.topic-queue', auto_ack=False))
    # # print(channel.basic_get(queue='ai.train.topic-queue', auto_ack=False))
    #
    # # channel.basic_consume('ai.train.topic-queue', backcall)
    # # backcall,  # 回调函数。执行结束后立即执行另外一个函数返回给发送端是否执行完毕。
    # #                   queue=,
    # # )  # 如果注释掉，对方没有收到消息的话不会将消息丢失，始终在队列里等待下次发送。
    #
    # scheduler.start()
    # # bot.join()
    # embed()
    # # channel.start_consuming()  # 启动后进入死循环。一直等待消息。
