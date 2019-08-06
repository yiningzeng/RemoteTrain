# !/usr/bin/env python
import pika
import os
from retry import retry
from apscheduler.schedulers.background import BackgroundScheduler

# rabbitmq 文档 https://pika.readthedocs.io/en/stable/modules/channel.html
# retry https://github.com/invl/retry
# pika https://pypi.org/project/pika/

if __name__ == '__main__':
    credentials = pika.PlainCredentials('baymin','baymin1024')
    connection = pika.BlockingConnection(pika.ConnectionParameters(host='192.168.31.157', port=5672, credentials=credentials))    #('192.168.31.157', 5672, '/', credentials))
    channel = connection.channel()

    # 声明queue
    # channel.queue_declare(queue='balance')
    # n RabbitMQ a message can never be sent directly to the queue, it always needs to go through an exchange.

    # channel.basic_publish(exchange='ai.train.topic',
    #               routing_key='train.start.test.fast',
    #               body='{fufuasdaskjdsa: "asdasdasdasds"}')
    # connection.close()
    @retry()
    def make_trouble():
        print('\nretry')
        '''Retry until succeed'''

    def backcall(ch, method, properties, body):  # 参数body是发送过来的消息。
        print(ch, method, properties)
        print('\n[x] Received %r' % body)
        os.system("notify-send '训练队列' '%s' -t %d" % (body, 100000))

        # 1.开始训练
        # 2.训练结束后生成done.txt 在目录下
        # 答复此条消息已经处理完成，这里要判断，在目录下有没有done.txt，有的话就回复完成
        # ch.basic_ack(method.delivery_tag)


    # channel.basic_get(queue='ai.train.topic-queue', auto_ack=False,  callback=backcall)

    channel.basic_consume('ai.train.topic-queue', backcall)
        # backcall,  # 回调函数。执行结束后立即执行另外一个函数返回给发送端是否执行完毕。
        #                   queue=,
                          # )  # 如果注释掉，对方没有收到消息的话不会将消息丢失，始终在队列里等待下次发送。

    print('waiting for message To exit   press CTRL+C')
    channel.start_consuming()  # 启动后进入死循环。一直等待消息。