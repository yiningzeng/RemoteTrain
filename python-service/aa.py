# -*- coding: UTF-8 -*-
import glob
import xml.etree.ElementTree as ET
import pickle
import os
from os import listdir, getcwd
from os.path import join

sets=[('2012', 'TCFBA'), ('2012', 'TDINR'), ('2012', 'TDNPR'), ('2012', 'TEOTS'), ('2012', 'TEWR0'),('2012', 'TPDPL'),('2012', 'TSFAS'),('2012', 'TTP2S')]

classes = ["TCFBA", "TDINR", "TDNPR", "TEOTS", "TEWR0","TPDPL","TSFAS","TTP2S"]


def convert(size, box):
    dw = 1./(size[0])
    dh = 1./(size[1])
    x = (box[0] + box[1])/2.0 - 1
    y = (box[2] + box[3])/2.0 - 1
    w = box[1] - box[0]
    h = box[3] - box[2]
    x = x*dw
    w = w*dw
    y = y*dh
    h = h*dh
    return (x,y,w,h)

def convert_annotation(year, image_id):
    print('%s'%(image_id))
    in_file = open('VOCdevkit/VOC%s/Annotations/%s.xml'%(year, image_id))
    out_file = open('VOCdevkit/VOC%s/labels/%s.txt'%(year, image_id), 'w')
    tree=ET.parse(in_file)
    root = tree.getroot()
    size = root.find('size')
    w = int(size.find('width').text)
    h = int(size.find('height').text)

    for obj in root.iter('object'):
        difficult = obj.find('difficult').text
        cls = obj.find('name').text
        if cls not in classes or int(difficult)==1:
            continue
        cls_id = classes.index(cls)
        xmlbox = obj.find('bndbox')
        b = (float(xmlbox.find('xmin').text), float(xmlbox.find('xmax').text), float(xmlbox.find('ymin').text), float(xmlbox.find('ymax').text))
        bb = convert((w,h), b)
        out_file.write(str(cls_id) + " " + " ".join([str(a) for a in bb]) + '\n')

if __name__ == '__main__':
    wd = getcwd()

    for year, image_set in sets:
        if not os.path.exists('VOCdevkit/VOC%s/labels/'%(year)):
            os.makedirs('VOCdevkit/VOC%s/labels/'%(year))
        image_ids=glob.glob('/home/baymin/daily-work/new-work/素材/腾讯面板/VOCdevkit/VOC2012/JPEGImages/*.jpg')
        list_file = open('%s_%s.txt'%(year, image_set), 'w')
        for num, image_id in enumerate(image_ids):
            filepath, tmpfilename = os.path.split(image_id)
            filename = os.path.splitext(tmpfilename)[0]
            print('=======%s' % filename)
            if filename == '1' or filename == '-1':
                continue
            list_file.write('%s/VOCdevkit/VOC%s/JPEGImages/%s.jpg\n'%(wd, year, filename))
            convert_annotation(year, filename)
        list_file.close()

    os.system("cat *_*.txt > train.txt")
    os.system("cat *_*.txt > val.txt")
