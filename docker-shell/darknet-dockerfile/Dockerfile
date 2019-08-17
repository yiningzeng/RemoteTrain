FROM registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_auto-ai-power-v2.0
WORKDIR /darknet
COPY voc2DarknetAssets-python2.py /darknet
COPY darknet53.conv.74 /darknet
COPY start.sh /darknet
VOLUME /darknet/assets
EXPOSE 8097
CMD sh start.sh
