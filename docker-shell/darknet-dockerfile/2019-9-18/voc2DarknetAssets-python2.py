# coding=utf-8
import xml.etree.ElementTree as ET
import pickle
import os
import numpy as np
import glob
import argparse
from PIL import Image
from kmeans import kmeans
from os import listdir, getcwd
from os.path import join
import imghdr

sets = []

classes = []


def parse_args():
    parser = argparse.ArgumentParser(description='End-to-end inference')
    parser.add_argument(
        '--voc-type',
        dest='vyear',
        help='voc数据集的版本',
        default="2012",
        type=str
    )
    parser.add_argument(
        '--voc-dir',
        dest='voc_dir',
        help='voc数据集的容器目录',
        default="/darknet/assets/",
        type=str
    )
    parser.add_argument(
        '--size',
        dest='size',
        help='图片的尺寸',
        default=608,
        type=int
    )
    parser.add_argument(
        '--clusters',
        dest='clusters',
        help='聚类的数目',
        default=9,
        type=int
    )
    parser.add_argument(
        '--change-ext',
        dest='change_ext',
        help='自动更改后缀',
        default=True,
        type=bool
    )
    # parser.add_argument(
    #     '--change-ext-del',
    #     dest='change_ext_del',
    #     help='自动更改后缀后，是否删除原始图片',
    #     default=True,
    #     type=bool
    # )
    parser.add_argument(
        '--output-dir',
        dest='output_dir',
        help='directory for visualization pdfs (default: /tmp/infer_simple)',
        default='/darknet/assets/train-assets/',
        type=str
    )
    # if len(sys.argv) == 1:
    #     parser.print_help()
    #     sys.exit(1)
    return parser.parse_args()


def convert(size, box):
    dw = 1. / (size[0])
    dh = 1. / (size[1])
    x = (box[0] + box[1]) / 2.0 - 1
    y = (box[2] + box[3]) / 2.0 - 1
    w = box[1] - box[0]
    h = box[3] - box[2]
    x = x * dw
    w = w * dw
    y = y * dh
    h = h * dh
    return (x, y, w, h)


def convert_annotation(dir, image_id):
    in_file = open('%s/Annotations/%s.xml' % (dir, image_id))
    out_file = open('%s/labels/%s.txt' % (dir, image_id), 'w')
    tree = ET.parse(in_file)
    root = tree.getroot()
    size = root.find('size')
    w = int(size.find('width').text)
    h = int(size.find('height').text)

    for obj in root.iter('object'):
        difficult = obj.find('difficult').text
        cls = obj.find('name').text
        if cls not in classes or int(difficult) == 1:
            continue
        cls_id = classes.index(cls)
        xmlbox = obj.find('bndbox')
        b = (float(xmlbox.find('xmin').text), float(xmlbox.find('xmax').text), float(xmlbox.find('ymin').text),
             float(xmlbox.find('ymax').text))
        bb = convert((w, h), b)
        out_file.write(str(cls_id) + " " + " ".join([str(a) for a in bb]) + '\n')


# 加载YOLO格式的标注数据
def load_dataset(path):
    jpegimages = os.path.join(path, 'JPEGImages')
    if not os.path.exists(jpegimages):
        print('no JPEGImages folders, program abort')
        return None
    labels_txt = os.path.join(path, 'labels')
    if not os.path.exists(labels_txt):
        print('no labels folders, program abort')
        return None

    label_file = os.listdir(labels_txt)
    print('label count: {}'.format(len(label_file)))
    dataset = []
    for label in label_file:
        with open(os.path.join(labels_txt, label), 'r') as f:
            txt_content = f.readlines()

        for line in txt_content:
            line_split = line.split(' ')
            roi_with = float(line_split[len(line_split) - 2])
            roi_height = float(line_split[len(line_split) - 1])
            if roi_with == 0 or roi_height == 0:
                continue
            dataset.append([roi_with, roi_height])
            # print([roi_with, roi_height])

    return np.array(dataset)


def get_anchor(path, clusters, size):
    data = load_dataset(path)
    out = kmeans(data, k=clusters)
    aors = []
    print(out)
    print("Boxes:\n {}-{}".format(out[:, 0] * size, out[:, 1] * size))
    print("yolov3：anchor ")
    for i, obj in enumerate(out[:, 0] * size):
        aors.append((round(obj, 1), round((out[:, 1] * size)[num], 1)))
    str_aors = ','.join(str(i) for i in aors).replace("(", "").replace(")", "").replace(" ", "")
    return str_aors, aors


if __name__ == '__main__':
    args = parse_args()
    os.system("rm %s/*.names" % args.voc_dir)
    os.system("rm %s/*.data" % args.voc_dir)
    os.system("rm %s/*.txt" % args.voc_dir)
    val_count = int(os.popen("ls -l %s|grep _val.txt|wc -l" % args.voc_dir).read().replace('\n', ''))
    set_files = sorted(glob.glob(args.voc_dir+'/ImageSets/Main/*.txt'))
    # set_files = [args.voc_dir + '/ImageSets/Main/big_dian.txt',
    #              args.voc_dir + '/ImageSets/Main/xian.txt',
    #              args.voc_dir + '/ImageSets/Main/dian.txt',
    #              args.voc_dir + '/ImageSets/Main/white_dian.txt',
    #              args.voc_dir + '/ImageSets/Main/big_yahen.txt',
    #              args.voc_dir + '/ImageSets/Main/normal_yahen.txt',
    #              args.voc_dir + '/ImageSets/Main/others.txt'
    #              ]
    for num, set in enumerate(set_files):
        fname, fename = os.path.splitext(os.path.split(set)[1])
        if val_count > 0:
            if "_train" in fname:
                one_class = fname.replace("_train", "")
                classes.append(one_class)
                os.system("echo %s >> %s/voc.names" % (one_class, args.voc_dir))
        else:
            classes.append(fname)
            os.system("echo %s >> %s/voc.names" % (fname, args.voc_dir))
        sets.append(('2012', fname))

    print("\n########################################\n")
    all_lose = 0
    for year, image_set in sets:
        if not os.path.exists('%s/labels/' % args.voc_dir):
            os.makedirs('%s/labels/' % args.voc_dir)
        image_ids = open('%s/ImageSets/Main/%s.txt' % (args.voc_dir, image_set)).read().strip().split()
        list_file = open('%s/%s_%s.txt' % (args.voc_dir, year, image_set), 'w')
        label_num = 0
        lose = 0
        for image_id in image_ids:
            filename = os.path.splitext(image_id)[0]
            if filename == '1':
                label_num = label_num + 1
                continue
            if filename == '-1':
                continue
            if not os.path.exists('%s/Annotations/%s.xml' % (args.voc_dir, filename)):
                # print("%s.xml丢失" % filename)
                lose = lose + 1
                continue
            if not os.path.exists('%s/JPEGImages/%s' % (args.voc_dir, image_id)):
                # print("%s.xml丢失" % filename)
                lose = lose + 1
                continue
            if imghdr.what('%s/JPEGImages/%s' % (args.voc_dir, image_id)) is None:
                # 完美解决梯度爆炸的问题
                lose = lose + 1
                continue
            # print(image_id)
            if args.change_ext and ".jpg" not in image_id:
                # print(" convert to jpg")
                im = Image.open('%s/JPEGImages/%s' % (args.voc_dir, image_id))
                im.save('%s/JPEGImages/%s.jpg' % (args.voc_dir, filename))
            list_file.write('%s/JPEGImages/%s.jpg\n' % (args.voc_dir, filename))
            convert_annotation(args.voc_dir, filename)
        all_lose = all_lose + lose
        print("label name: %s, num: %d, lose: %d\n" % (image_set, label_num, lose))
        list_file.close()
    print("########################################\n")
    print("all label num: %d, lose: %d\n########################################" % (len(classes), all_lose))
    if val_count > 0:
        os.system("cat %s/*_train.txt > %s/train.txt" % (args.voc_dir, args.voc_dir))
        os.system("cat %s/*_val.txt > %s/val.txt" % (args.voc_dir, args.voc_dir))
    else:
        os.system("cat %s/*_*.txt > %s/train.txt" % (args.voc_dir, args.voc_dir))
        os.system("cat %s/*_*.txt > %s/val.txt" % (args.voc_dir, args.voc_dir))

    # 写入voc.data
    os.system("echo 'classes = %d' >> '%s/voc.data'" % (len(classes), args.voc_dir))
    os.system("echo 'train = %s/train.txt' >> '%s/voc.data'" % (args.voc_dir, args.voc_dir))
    os.system("echo 'valid = %s/val.txt' >> '%s/voc.data'" % (args.voc_dir, args.voc_dir))
    os.system("echo 'names = %s/voc.names' >> '%s/voc.data'" % (args.voc_dir, args.voc_dir))
    os.system("echo 'backup = %s/backup' >> '%s/voc.data'" % (args.voc_dir, args.voc_dir))
    # 新增2个参数，为了画图，为了...? 为了爱
    os.system("echo 'draw_url = %s' >> '%s/voc.data'" % ("http://192.168.31.75:18888/draw_chart", args.voc_dir))
    os.system('echo "project_id = \c" >> "%s/voc.data"' % args.voc_dir)
    os.system("cat '%s/project_id.log' >> '%s/voc.data'" % (args.voc_dir, args.voc_dir))
    # * draw_url=http://192.168.31.75:18888/draw_chart
    # * project_id=项目名称
    os.system("mkdir -p '%s/backup'" % args.voc_dir)

    # 更改配置文件信息
    os.system('sed -i "s/@classes@/%d/g" "%s/yolov3-voc.cfg"' % (len(classes), args.voc_dir))
    os.system('sed -i "s/@filters@/%d/g" "%s/yolov3-voc.cfg"' % ((len(classes) + 5) * 3, args.voc_dir))
    os.system('/darknet/darknet detector calc_anchors_with_cfg "%s/voc.data" "%s/yolov3-voc.cfg" '
              '\echo $! > "%s/get_anchors_pid.log"' % (
                  args.voc_dir, args.voc_dir, args.voc_dir))
    anchors = os.popen('cat /darknet/anchors.txt').read().replace('\n', '')
    os.system('sed -i "s/@anchors@/%s/g" "%s/yolov3-voc.cfg"' % (anchors, args.voc_dir))
    print("\nAnchors: {}".format(anchors))
    print("done")
    # 更改聚类信息
    # str_anchors, anchors = get_anchor(args.voc_dir, args.clusters, args.size)
