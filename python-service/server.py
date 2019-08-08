# !/usr/bin/env python
import pika
import os
import json
from retry import retry
import time
from wxpy import *
import logging as log
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

# rabbitmq 文档 https://pika.readthedocs.io/en/stable/modules/channel.html
# retry https://github.com/invl/retry
# pika https://pypi.org/project/pika/

#
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

    def __init__(self, host='localhost', port=5672,
                 username='guest', password='guest', package_base_path='/home/baymin/daily-work/ftp/',
                 train_exchange='ai.train.topic', train_queue='ai.train.topic-queue', train_routing_key='train.start.#',
                 package_exchange='ai.package.topic', package_queue='ai.package.topic-queue',
                 package_routing_key='package.upload-done.#'
                 ):
        self.channel = None
        self.package_base_path = package_base_path
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

        # self.consume()

    '''
    获取单个解包队列数据
    '''
    def get_package_one(self):
        log.info('get_package_one:%s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        os.system("notify-send '%s' '%s' -t %d" % ('解包', '解包数据', 10000))
        method_frame, header_frame, body = self.channel.basic_get(queue=self.package_queue, auto_ack=False)
        if method_frame is None:
            print("解包数据：Empty Basic.Get Response (Basic.GetEmpty)")
            return None, None
            # We have data
        else:
            print("解包数据： %s %s delivery-tag %i: %s" % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                       header_frame.content_type,
                                                       method_frame.delivery_tag,
                                                       body.decode('utf-8')))
            package_info = json.loads(body.decode('utf-8'))
            log.info('开始解包')
            os.system("tar -xvf %s/%s -C %s" % (self.package_base_path, package_info["packageName"], self.package_base_path))
            os.system("echo 1 > %s/%s/untar.txt" % (self.package_base_path, package_info["packageDir"]))
            os.system("rm %s/%s" % (self.package_base_path, package_info["packageName"]))
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
            print("训练：Empty Basic.Get Response (Basic.GetEmpty)")
            return None, None
            # We have data
        else:
            # 这里需要检查训练素材包是否已经解包，如果未解包，这里需要拒绝，让它重新排队self.channel.basic_nack
            train_info = json.loads(body.decode('utf-8'))
            if not os.path.exists("%s%s/untar.txt" % (self.package_base_path, train_info["assetsDir"])):
                log.info('%s 未解包完成' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                self.channel.basic_nack(method_frame.delivery_tag)
                print("解包未完成")
            else:
                '''
                usage:  dockertrainD  -p  映射到本地的端口 默认8097 如果被占用会自动分配，只检测端口占用情况，可能存在多个未开启的容器相同端口的情况
                                      -n  项目名 默认 ""
                                      -v  需要映射的素材目录(必填)
                                      -r  docker镜像的地址 默认registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-wo-v3.6
                                      -w  root密码 默认icubic-123
                                      -g  复制脚本到/usr/local/bin/，后面执行可以全局dockertrainD
                                      -h  帮助
                '''
                cmd = "dockertrainD-old -n %s -v %s -w %s" % (train_info["assetsDir"], self.package_base_path + train_info["assetsDir"], "baymin1024")
                print("训练命令： %s" % cmd)
                os.system(cmd)
                print("训练：%s Basic.GetOk %s delivery-tag %i: %s" % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                             header_frame.content_type,
                                                             method_frame.delivery_tag,
                                                             body.decode('utf-8')))
            return method_frame.delivery_tag, body.decode('utf-8')

    @retry(pika.exceptions.AMQPConnectionError, delay=5, jitter=(1, 3))
    def init(self):
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


if __name__ == '__main__':
    # credentials = pika.PlainCredentials('baymin','baymin1024')
    # connection = pika.BlockingConnection(pika.ConnectionParameters(host='192.168.31.157', port=5672, credentials=credentials))    #('192.168.31.157', 5672, '/', credentials))
    # channel = connection.channel()

    ff = pikaqiu(host='192.168.31.157', username='baymin', password='baymin1024', package_base_path='/home/baymin/daily-work/ftp/')
    ch = ff.init()

    # region 定时获取解包队列一条数据
    def get_package(channel, method, properties, body):  # 参数body是发送过来的消息。
        print(channel, method, properties)
        print('\n[x] Received %r' % body)
        os.system("notify-send '训练队列' '%s' -t %d" % (body, 100000))
        # 1.开始训练
        # 2.训练结束后生成done.txt 在目录下
        # 答复此条消息已经处理完成，这里要判断，在目录下有没有done.txt，有的话就回复完成
        # ch.basic_ack(method.delivery_tag)
    # endregion

    # region 定时主动获取队列中的一条训练数据
    def get_train():
        delivery_tag, body = ff.get_train_one(ch)
        print(body.decode('utf-8'))
        project = json.loads(body.decode('utf-8'))
        print(project["ip"])
        ch.basic_ack(delivery_tag)


    # endregion

    # 创建后台执行的 schedulers
    scheduler = BackgroundScheduler()
    # 添加调度任务

    # 提醒写日报
    # scheduler.add_job(remind, 'cron', second="0/2")
    scheduler.add_job(ff.get_train_one, 'interval', seconds=15)
    scheduler.add_job(ff.get_package_one, 'interval', seconds=8)
    scheduler.start()

    print("start")
    # ff.consume(ch, on_message_callback)
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
