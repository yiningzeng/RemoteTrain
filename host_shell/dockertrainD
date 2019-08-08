#!/bin/bash
password="icubic-123"
port=8097
peoject_name=""
volume=""
registry="registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-wo-v3.6"
print_help() {
cat <<EOF
usage:	dockertrainD	-p  映射到本地的端口 默认8097 如果被占用会自动分配，只检测端口占用情况，可能存在多个未开启的容器相同端口的情况
			-n  项目名 默认 ""
			-v  需要映射的素材目录(必填)
			-r  docker镜像的地址 默认registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:ai-power-wo-v3.6
			-w  root密码 默认icubic-123
			-g  复制脚本到/usr/local/bin/，后面执行可以全局dockertrainD
			-h  帮助
EOF
exit 1
}

while getopts "p:n:v:r:w:gh" opt; do
  case $opt in
    p)
      port=$OPTARG
      ;;
    n)
      project_name=$OPTARG
      ;;
    v)
      volume=$OPTARG
      ;;
    r)
      registry=$OPTARG
      ;;
    w)
      password=$OPTARG
      ;;
    g)
      echo $password | sudo -S cp -rf dockertrain /usr/local/bin/
      exit 1
      ;;
    h)
      print_help
      ;;
    \?)
      print_help
      ;;
  esac
done

echo "首先判断端口是否占用情况"

while :
do
        if netstat -tlpn | grep $port
        then
                echo "端口占用"
                port=`expr $port + 1`
        else
                echo "$port端口可用"
                break
        fi
done

echo "******************************"
echo "* 最终数据："
echo "* 端口：$port"
echo "* 项目名：$project_name"
echo "* 映射的目录：$volume"
echo "* 镜像：$registry"
echo "******************************"

if [ -n volume ];then
  echo "映射目录不可为空"
  exit 1
fi  

nvidia-smi
echo $password | sudo -S docker run --gpus all -d -p $port:8097 -v $volume:/Detectron/detectron/datasets/data/ --name $peoject_name$port $registry
