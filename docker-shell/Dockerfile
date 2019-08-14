FROM registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_ai-power-v1.3
WORKDIR /darknet
COPY docker-darknet /darknet
RUN ls /darknet
VOLUME /darknet/assets
RUN pip install kmeans
CMD sh start.sh
