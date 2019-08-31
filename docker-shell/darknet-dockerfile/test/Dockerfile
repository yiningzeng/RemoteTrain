FROM registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_auto-ai-power-v3.6
WORKDIR /darknet
COPY start.sh /darknet
COPY voc2DarknetAssets-python2.py /darknet
VOLUME /darknet/assets
EXPOSE 8070
EXPOSE 8100
CMD bash start.sh
