FROM registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_auto-ai-power-v2.0
WORKDIR /darknet
COPY voc2DarknetAssets-python2.py /darknet
COPY darknet-final.py /darknet
COPY darknet-server.py /darknet
COPY darknet53.conv.74 /darknet
COPY start.sh /darknet
VOLUME /darknet/assets
EXPOSE 8097
RUN rm darknet-2.7.py
RUN rm darknet.py
CMD bash start.sh
