FROM registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-wo-auto-v4.1
WORKDIR /Detectron
COPY start.sh /Detectron
COPY train /usr/local/bin
VOLUME /Detectron/detectron/datasets/data
EXPOSE 8100
CMD bash start.sh
