# -*- coding:utf-8 -*-
# !python3
"""
Python 3 wrapper for identifying objects in images

Requires DLL compilation

Both the GPU and no-GPU version should be compiled; the no-GPU version should be renamed "yolo_cpp_dll_nogpu.dll".

On a GPU system, you can force CPU evaluation by any of:

- Set global variable DARKNET_FORCE_CPU to True
- Set environment variable CUDA_VISIBLE_DEVICES to -1
- Set environment variable "FORCE_CPU" to "true"


To use, either run performDetect() after import, or modify the end of this file.

See the docstring of performDetect() for parameters.

Directly viewing or returning bounding-boxed images requires scikit-image to be installed (`pip install scikit-image`)


Original *nix 2.7: https://github.com/pjreddie/darknet/blob/0f110834f4e18b30d5f101bf8f1724c34b7b83db/python/darknet.py
Windows Python 2.7 version: https://github.com/AlexeyAB/darknet/blob/fc496d52bf22a0bb257300d3c79be9cd80e722cb/build/darknet/x64/darknet.py

@author: Philip Kahn
@date: 20180503
"""
# pylint: disable=R, W0401, W0614, W0703
from ctypes import *
import math
import random
import os
import glob
import cv2
import argparse
import base64
from flask import Flask, request
import numpy as np
from skimage import io, draw
import sys
import scipy.misc
import json
import time
import logging as log

app = Flask(__name__)

log.basicConfig(level=log.INFO, 
                filename='/excel/detecton_server.log',
                filemode='a', 
                format=
                '%(asctime)s - %(pathname)s[line:%(lineno)d] - %(levelname)s: %(message)s'
                )

is_detecton = False

cfg = "/darknet/assets/yolov3-voc-test.cfg"
model = "/darknet/assets/backup/yolov3-voc_last.weights"
data = "/darknet/assets/voc.data"
save_path = "/aiimg/"
thresh = 0.1
lib_dll = "/darknet/libdark.so"


def parse_args():
    parser = argparse.ArgumentParser(description='End-to-end inference')
    parser.add_argument(
        '--cfg',
        dest='cfg',
        help='配置文件',
        default="/darknet/assets/yolov3-voc-test.cfg",
        type=str
    )
    parser.add_argument(
        '--model',
        dest='model',
        help='权重文件',
        default="/darknet/assets/backup/yolov3-voc_last.weights",
        type=str
    )
    parser.add_argument(
        '--thresh',
        dest='thresh',
        help='置信度',
        default=0.1,
        type=float
    )
    parser.add_argument(
        '--libdll',
        dest='libdll',
        help='so库目录',
        default="/darknet/libdark.so",
        type=str
    )
    parser.add_argument(
        '--port',
        dest='port',
        help='http服务端口',
        default=8100,
        type=int
    )
    return parser.parse_args()


def sample(probs):
    s = sum(probs)
    probs = [a / s for a in probs]
    r = random.uniform(0, 1)
    for i in range(len(probs)):
        r = r - probs[i]
        if r <= 0:
            return i
    return len(probs) - 1


def c_array(ctype, values):
    arr = (ctype * len(values))()
    arr[:] = values
    return arr


class BOX(Structure):
    _fields_ = [("x", c_float),
                ("y", c_float),
                ("w", c_float),
                ("h", c_float)]


class DETECTION(Structure):
    _fields_ = [("bbox", BOX),
                ("classes", c_int),
                ("prob", POINTER(c_float)),
                ("mask", POINTER(c_float)),
                ("objectness", c_float),
                ("sort_class", c_int)]


class IMAGE(Structure):
    _fields_ = [("w", c_int),
                ("h", c_int),
                ("c", c_int),
                ("data", POINTER(c_float))]


class METADATA(Structure):
    _fields_ = [("classes", c_int),
                ("names", POINTER(c_char_p))]


args = parse_args()
cfg = args.cfg
model = args.model  # "assets/backup/yolov3-voc_last.weights"
thresh = args.thresh
lib_dll = args.libdll

# lib = CDLL("/home/pjreddie/documents/darknet/libdarknet.so", RTLD_GLOBAL)
# lib = CDLL("libdarknet.so", RTLD_GLOBAL)
hasGPU = True
if os.name == "nt":
    cwd = os.path.dirname(__file__)
    os.environ['PATH'] = cwd + ';' + os.environ['PATH']
    winGPUdll = os.path.join(cwd, "yolo_cpp_dll.dll")
    winNoGPUdll = os.path.join(cwd, "yolo_cpp_dll_nogpu.dll")
    envKeys = list()
    for k, v in os.environ.items():
        envKeys.append(k)
    try:
        try:
            tmp = os.environ["FORCE_CPU"].lower()
            if tmp in ["1", "true", "yes", "on"]:
                raise ValueError("ForceCPU")
            else:
                print("Flag value '" + tmp + "' not forcing CPU mode")
        except KeyError:
            # We never set the flag
            if 'CUDA_VISIBLE_DEVICES' in envKeys:
                if int(os.environ['CUDA_VISIBLE_DEVICES']) < 0:
                    raise ValueError("ForceCPU")
            try:
                global DARKNET_FORCE_CPU
                if DARKNET_FORCE_CPU:
                    raise ValueError("ForceCPU")
            except NameError:
                pass
            # print(os.environ.keys())
            # print("FORCE_CPU flag undefined, proceeding with GPU")
        if not os.path.exists(winGPUdll):
            raise ValueError("NoDLL")
        lib = CDLL(winGPUdll, RTLD_GLOBAL)
    except (KeyError, ValueError):
        hasGPU = False
        if os.path.exists(winNoGPUdll):
            lib = CDLL(winNoGPUdll, RTLD_GLOBAL)
            print("Notice: CPU-only mode")
        else:
            # Try the other way, in case no_gpu was
            # compile but not renamed
            lib = CDLL(winGPUdll, RTLD_GLOBAL)
            print(
                "Environment variables indicated a CPU run, but we didn't find `" + winNoGPUdll + "`. Trying a GPU run anyway.")
else:
    lib = CDLL(lib_dll, RTLD_GLOBAL)
lib.network_width.argtypes = [c_void_p]
lib.network_width.restype = c_int
lib.network_height.argtypes = [c_void_p]
lib.network_height.restype = c_int

copy_image_from_bytes = lib.copy_image_from_bytes
copy_image_from_bytes.argtypes = [IMAGE, c_char_p]


def network_width(net):
    return lib.network_width(net)


def network_height(net):
    return lib.network_height(net)


predict = lib.network_predict_ptr
predict.argtypes = [c_void_p, POINTER(c_float)]
predict.restype = POINTER(c_float)

if hasGPU:
    set_gpu = lib.cuda_set_device
    set_gpu.argtypes = [c_int]

make_image = lib.make_image
make_image.argtypes = [c_int, c_int, c_int]
make_image.restype = IMAGE

get_network_boxes = lib.get_network_boxes
get_network_boxes.argtypes = [c_void_p, c_int, c_int, c_float, c_float, POINTER(c_int), c_int, POINTER(c_int), c_int]
get_network_boxes.restype = POINTER(DETECTION)

make_network_boxes = lib.make_network_boxes
make_network_boxes.argtypes = [c_void_p]
make_network_boxes.restype = POINTER(DETECTION)

free_detections = lib.free_detections
free_detections.argtypes = [POINTER(DETECTION), c_int]

free_ptrs = lib.free_ptrs
free_ptrs.argtypes = [POINTER(c_void_p), c_int]

network_predict = lib.network_predict_ptr
network_predict.argtypes = [c_void_p, POINTER(c_float)]

reset_rnn = lib.reset_rnn
reset_rnn.argtypes = [c_void_p]

load_net = lib.load_network
load_net.argtypes = [c_char_p, c_char_p, c_int]
load_net.restype = c_void_p

load_net_custom = lib.load_network_custom
load_net_custom.argtypes = [c_char_p, c_char_p, c_int, c_int]
load_net_custom.restype = c_void_p

do_nms_obj = lib.do_nms_obj
do_nms_obj.argtypes = [POINTER(DETECTION), c_int, c_int, c_float]

do_nms_sort = lib.do_nms_sort
do_nms_sort.argtypes = [POINTER(DETECTION), c_int, c_int, c_float]

free_image = lib.free_image
free_image.argtypes = [IMAGE]

letterbox_image = lib.letterbox_image
letterbox_image.argtypes = [IMAGE, c_int, c_int]
letterbox_image.restype = IMAGE

load_meta = lib.get_metadata
lib.get_metadata.argtypes = [c_char_p]
lib.get_metadata.restype = METADATA

load_image = lib.load_image_color
load_image.argtypes = [c_char_p, c_int, c_int]
load_image.restype = IMAGE

rgbgr_image = lib.rgbgr_image
rgbgr_image.argtypes = [IMAGE]

predict_image = lib.network_predict_image
predict_image.argtypes = [c_void_p, IMAGE]
predict_image.restype = POINTER(c_float)

predict_image_letterbox = lib.network_predict_image_letterbox
predict_image_letterbox.argtypes = [c_void_p, IMAGE]
predict_image_letterbox.restype = POINTER(c_float)


def array_to_image(arr):
    import numpy as np
    # need to return old values to avoid python freeing memory
    arr = arr.transpose(2, 0, 1)
    c = arr.shape[0]
    h = arr.shape[1]
    w = arr.shape[2]
    arr = np.ascontiguousarray(arr.flat, dtype=np.float32) / 255.0
    data = arr.ctypes.data_as(POINTER(c_float))
    im = IMAGE(w, h, c, data)
    return im, arr


def classify(net, meta, im):
    out = predict_image(net, im)
    res = []
    for i in range(meta.classes):
        if altNames is None:
            nameTag = meta.names[i]
        else:
            nameTag = altNames[i]
        res.append((nameTag, out[i]))
    res = sorted(res, key=lambda x: -x[1])
    return res


def detect(net, meta, image, thresh=.5, hier_thresh=.5, nms=.45, debug=False):
    global is_detecton
    is_detecton = True
    """
    Performs the meat of the detection
    """
    # pylint: disable= C0321
    im = load_image(image, 0, 0)
    if debug: print("Loaded image")
    ret = detect_image(net, meta, im, thresh, hier_thresh, nms, debug)
    free_image(im)
    is_detecton = False
    if debug: print("freed image")
    return ret


def detect_image(net, meta, im, thresh=.5, hier_thresh=.5, nms=.45, debug=False):
    # import cv2
    # custom_image_bgr = cv2.imread(image) # use: detect(,,imagePath,)
    # custom_image = cv2.cvtColor(custom_image_bgr, cv2.COLOR_BGR2RGB)
    # custom_image = cv2.resize(custom_image,(lib.network_width(net), lib.network_height(net)), interpolation = cv2.INTER_LINEAR)
    # import scipy.misc
    # custom_image = scipy.misc.imread(image)
    # im, arr = array_to_image(custom_image)		# you should comment line below: free_image(im)
    num = c_int(0)
    if debug: print("Assigned num")
    pnum = pointer(num)
    if debug: print("Assigned pnum")
    predict_image(net, im)
    letter_box = 0
    # predict_image_letterbox(net, im)
    # letter_box = 1
    if debug: print("did prediction")
    # dets = get_network_boxes(net, shape[1], shape[0], thresh, hier_thresh, None, 0, pnum, letter_box) # OpenCV
    dets = get_network_boxes(net, im.w, im.h, thresh, hier_thresh, None, 0, pnum, letter_box)
    if debug: print("Got dets")
    num = pnum[0]
    if debug: print("got zeroth index of pnum")
    if nms:
        do_nms_sort(dets, num, meta.classes, nms)
    if debug: print("did sort")
    res = []
    if debug: print("about to range")
    for j in range(num):
        if debug: print("Ranging on " + str(j) + " of " + str(num))
        if debug: print("Classes: " + str(meta), meta.classes, meta.names)
        for i in range(meta.classes):
            if debug: print("Class-ranging on " + str(i) + " of " + str(meta.classes) + "= " + str(dets[j].prob[i]))
            if dets[j].prob[i] > 0:
                b = dets[j].bbox
                if altNames is None:
                    nameTag = meta.names[i]
                else:
                    nameTag = altNames[i]
                if debug:
                    print("Got bbox", b)
                    print(nameTag)
                    print(dets[j].prob[i])
                    print((b.x, b.y, b.w, b.h))
                res.append((nameTag, dets[j].prob[i], (b.x, b.y, b.w, b.h)))
    if debug: print("did range")
    res = sorted(res, key=lambda x: -x[1])
    if debug: print("did sort")
    free_detections(dets, num)
    if debug: print("freed detections")
    return res


@app.route('/pandas/', methods=['GET', 'POST'])
def main():
    if request.method == 'POST' or request.method == 'GET':
        log.info("\n================start===================\n")

        global is_detecton, netMain, metaMain, thresh
        img_data = base64.b64decode(str(request.form['photo']))
        f_name = str(request.form['name'])
        # 转换为np数组
        img_array = np.fromstring(img_data, np.uint8)
        # 转换成opencv可用格式
        img = cv2.imdecode(img_array, cv2.COLOR_RGB2BGR)
        try:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        except Exception as e:
            log.debug(e)
        baseName = str(int(random.uniform(0, 100))) + f_name
        out_put_path = save_path + baseName
        cv2.imwrite(out_put_path, img)
        print(out_put_path)
        while 1:
            if is_detecton:
                time.sleep(0.1)
            else:
                break

        start_time = time.time()
        detections = detect(netMain, metaMain, out_put_path, thresh)
        end_time = time.time()
        total_time = end_time - start_time
        ret = {"num": 0, "label_str": "OK,", "points": "", "img_name": baseName, "process_time": "s"}
        ret["num"] = len(detections)
        tempPoints = []
        r=detections
        for i in range(len(r)):
            label = r[i][0]
            confidence = r[i][1]
            boxColor = (int(255 * (1 - (confidence ** 2))), int(255 * (confidence ** 2)), 0)
            pstring = label+": "+str(np.rint(100 * confidence))+"%"
            print(pstring)
            x1 = r[i][2][0] - r[i][2][2] / 2
            y1 = r[i][2][1] - r[i][2][3] / 2
            x2 = r[i][2][0] + r[i][2][2] / 2
            y2 = r[i][2][1] + r[i][2][3] / 2
            print("----")
            print r[i]
            font = cv2.FONT_HERSHEY_SIMPLEX
            boxColor=(0,255,0)
            cv2.putText(img, str(label) + " " + str(confidence), (int(x1), int(y1)), cv2.FONT_HERSHEY_SIMPLEX, 1, boxColor, 1)
            cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), boxColor, 1)
            ret["label_str"] = "NG"
            tempPoints.append(r[i])
        print("----")
        cv2.imwrite(out_put_path, img)
        ret["process_time"] = total_time
        ret["points"] = str(tempPoints)
        ret = json.dumps(ret)
        log.info("\nresult: %s " % ret)
        log.info("\n================end===================\n\n\n")
        return ret
        # return performDetect(savePath=save_path+f_name,img=im,configPath=cfg,metaPath=data,weightPath=model)


if __name__ == "__main__":
    netMain = None
    metaMain = None
    altNames = None
    if not os.path.exists(cfg):
        raise ValueError("Invalid config path `" + os.path.abspath(cfg) + "`")
    if not os.path.exists(model):
        raise ValueError("Invalid weight path `" + os.path.abspath(model) + "`")
    if not os.path.exists(data):
        raise ValueError("Invalid data file path `" + os.path.abspath(data) + "`")

    if netMain is None:
        netMain = load_net_custom(cfg.encode("ascii"), model.encode("ascii"), 0, 1)  # batch size = 1
    if metaMain is None:
        metaMain = load_meta(data.encode("ascii"))
    app.run(host="0.0.0.0", port=args.port)
    # img_list=glob.glob(img_path+img_ext)
    # for num, img_file in enumerate(img_list):
    #    print(performDetect(savePath=save_path,imagePath=img_file,configPath=cfg,metaPath=data,weightPath=model))
