from urllib import parse
from urllib import request
import glob
import os
from PIL import Image

if __name__ == '__main__':
    file_list = glob.glob('/home/baymin/daily-work/new-work/素材/yunsheng_date/2019-9-9/工位5-1/*.json')
    for num, fileName in enumerate(file_list):
        if os.path.exists(fileName):  # 如果文件存在
            f = open(fileName, 'rb')  # 里面为文件路径
            newcontent = str(f.read(), encoding = "utf-8").replace("C:/Users/admin/Desktop/%E5%B7%A5%E4%BD%8D5-1", "${path}")
            f.close()

            # 打开「detail_content」文件
            fout = open(fileName, 'w')
            # 写入文件内容
            fout.write(str(newcontent))
            fout.close()

            # newFileName = parse.unquote(fileName)  # 解码url
            # print(newFileName)
            # im = Image.open(fileName)
            # im.save(newFileName)
            # os.remove(fileName)
        else:
            print('no such file:%s' % fileName)  # 则返回文件不存在
