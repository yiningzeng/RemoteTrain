#!/usr/bin/env python
# encoding=utf8
# Copyright (c) 2017-present, Facebook, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
##############################################################################

"""Perform inference on a single image or all images with a certain extension
(e.g., .jpg) in a folder.
"""

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict
import argparse
import cv2  # NOQA (Must import before importing caffe2 due to bug in cv2)
import glob
import logging
import os
import base64
import sys
import time
import random
import json
from flask import Flask, request
import numpy as np

from caffe2.python import workspace

from detectron.core.config import assert_and_infer_cfg
from detectron.core.config import cfg
from detectron.core.config import merge_cfg_from_file
from detectron.utils.io import cache_url
from detectron.utils.logging import setup_logging
from detectron.utils.timer import Timer
import detectron.core.test_engine as infer_engine
import detectron.datasets.dummy_datasets as dummy_datasets
import detectron.utils.c2 as c2_utils
import detectron.utils.vis as vis_utils

c2_utils.import_detectron_ops()
reload(sys)
sys.setdefaultencoding('utf8')
# OpenCL may be enabled by default in OpenCV3; disable it because it's not
# thread safe and causes unwanted GPU memory allocations.
cv2.ocl.setUseOpenCL(False)

app = Flask(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description='End-to-end inference')
    parser.add_argument(
        '--cfg',
        dest='cfg',
        help='cfg model file (/path/to/model_config.yaml)',
        default="/Detectron/detectron/datasets/data/train-config.yaml",
        type=str
    )
    parser.add_argument(
        '--model',
        dest='weights',
        help='weights model file (/path/to/model_weights.pkl)',
        default="/Detectron/detectron/datasets/data/result/train/coco_2014_train/generalized_rcnn/server.pkl",
        type=str
    )
    parser.add_argument(
        '--output-dir',
        dest='output_dir',
        help='directory for visualization pdfs (default: /tmp/infer_simple)',
        default='/aiimg/',
        type=str
    )
    parser.add_argument(
        '--image-ext',
        dest='image_ext',
        help='image file name extension (default: jpg)',
        default='jpg',
        type=str
    )
    parser.add_argument(
        '--always-out',
        dest='out_when_no_box',
        help='output image even when no object is found',
        action='store_true'
    )
    parser.add_argument(
        '--output-ext',
        dest='output_ext',
        help='output image file format (default: pdf)',
        default='jpg',
        type=str
    )
    parser.add_argument(
        '--thresh',
        dest='thresh',
        help='Threshold for visualizing detections',
        default=0.7,
        type=float
    )
    parser.add_argument(
        '--kp-thresh',
        dest='kp_thresh',
        help='Threshold for visualizing keypoints',
        default=2.0,
        type=float
    )
    parser.add_argument(
        '--port',
        dest='port',
        help='8200',
        default=8200,
        type=float
    )
    parser.add_argument(
        '--is-save',
        dest='is_save',
        help='is_save_result_image',
        default=1,
        type=int
    )
    # if len(sys.argv) == 1:
    #     parser.print_help()
    #     sys.exit(1)
    return parser.parse_args()


@app.route('/pandas/', methods=['GET', 'POST'])
def main():
    # print("score:" + str(score))
    img_data = base64.b64decode(str(request.form['photo']))
    f_name = str(request.form['name'])
    # 转换为np数组
    img_array = np.fromstring(img_data, np.uint8)
    # 转换成opencv可用格式
    img = cv2.imdecode(img_array, cv2.COLOR_RGB2BGR)
    try:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    except Exception as e:
        print(e)

    timers = defaultdict(Timer)
    t = time.time()
    print("name:" + str(int(t)))
    start_time = time.time()
    with c2_utils.NamedCudaScope(0):
        cls_boxes, cls_segms, cls_keyps = infer_engine.im_detect_all(
            model, img, None, timers=timers
        )
    end_time = time.time()
    total_time = end_time - start_time
    print(cls_boxes)
    logger.info('Inference time: {:.3f}s'.format(time.time() - t))
    for k, v in timers.items():
        logger.info(' | {}: {:.3f}s'.format(k, v.average_time))

    ret = {"num": 0, "label_str": "OK,", "points": "", "img_name": f_name, "process_time": "s"}
    tempPoints = []
    for i, boxTemp in enumerate(cls_boxes):
        if len(boxTemp) == 0:
            continue
        ret["num"] = len(boxTemp)
        for n, box in enumerate(boxTemp):
            print(box)
            tempPoints.append(box)
            if args.is_save == 1:
                cv2.putText(img, str(box[4]), (int(box[0]), int(box[1])),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.5, (0, 255, 255))
                cv2.rectangle(img, (int(box[0]), int(box[1])),
                              (int(box[2]), int(box[3])), (0, 255, 255))
            #if float(box[4]) > float(score):
            ret["label_str"] = "NG"
    if args.is_save == 1:
        out_put_path = args.output_dir + "/" + str(int(t)) + "." + args.output_ext
        print(out_put_path)
        cv2.imwrite(out_put_path, img)
    ret["process_time"] = total_time
    ret["img_name"] = str(int(t)) + "." + args.output_ext
    ret["points"] = str(tempPoints)
    return json.dumps(ret)

if __name__ == '__main__':
    workspace.GlobalInit(['caffe2', '--caffe2_log_level=0'])
    setup_logging(__name__)
    args = parse_args()

    merge_cfg_from_file(args.cfg)
    cfg.NUM_GPUS = 1
    args.weights = cache_url(args.weights, cfg.DOWNLOAD_CACHE)
    assert_and_infer_cfg(cache_urls=False)
    model = infer_engine.initialize_model_from_cfg(args.weights)

    assert not cfg.MODEL.RPN_ONLY, \
        'RPN models are not supported'
    assert not cfg.TEST.PRECOMPUTED_PROPOSALS, \
        'Models that require precomputed proposals are not supported'
    logger = logging.getLogger(__name__)
    app.run(host="0.0.0.0", port=args.port)
