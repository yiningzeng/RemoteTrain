FROM registry.cn-hangzhou.aliyuncs.com/pytorch-powerai/detectron2:nightly-cuda10.1-cudnn7-opencv3.4.7-devel-ubuntu18.04
WORKDIR /detectron2
COPY start.sh /detectron2
COPY PowerJson2COCO.py /detectron2/tools
VOLUME /detectron2/datasets
CMD bash start.sh