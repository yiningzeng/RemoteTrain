FROM registry.cn-hangzhou.aliyuncs.com/baymin/darknet:latest
WORKDIR /darknet
COPY voc2DarknetAssets-python2.py /darknet
COPY libdark.so /darknet
COPY darknet /darknet
VOLUME /darknet/assets
EXPOSE 8097
CMD bash start.sh
