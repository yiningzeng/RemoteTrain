FROM registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-test-auto-v4.3
RUN mkdir -p /opt/ai
RUN mkdir -p /excel
WORKDIR /opt/ai
VOLUME /Detectron/detectron/datasets/data
VOLUME /aiimg
VOLUME /excel
VOLUME /Detectron/detectron/datasets/data/result/train/coco_2014_train/generalized_rcnn/server.pkl
EXPOSE 8200
EXPOSE 8201
COPY power-ai-test-service.jar /opt/ai
COPY start-by-port.sh /opt/ai
COPY stop-by-port.sh /opt/ai
COPY search-by-port.sh /opt/ai
COPY infer_simple_server_baymin.py /opt/ai
COPY start.sh /opt/ai
CMD bash start.sh
