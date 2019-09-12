FROM registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:darknet_auto-ai-power-v4.0
WORKDIR /opt/ai
COPY start.sh /opt/ai
COPY power-ai-test-service.jar /opt/ai
COPY start-by-port.sh /opt/ai
COPY stop-by-port.sh /opt/ai
COPY search-by-port.sh /opt/ai
COPY darknet-final-server.py /opt/ai
CMD bash start.sh
