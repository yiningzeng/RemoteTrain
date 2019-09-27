import React from 'react';
import ReactDOM from 'react-dom';
import Iframe from 'react-iframe';

import dva, { connect } from 'dva';
import { InputNumber, Tag, Row, Modal, Spin, Col, Table, message, PageHeader, Button, Typography, Drawer, Divider, Icon, Card , Select, Switch, Form, Input, DatePicker} from 'antd';
// 由于 antd 组件的默认文案是英文，所以需要修改为中文
import zhCN from 'antd/lib/locale-provider/zh_CN';
import moment from 'moment';
import 'moment/locale/zh-cn';
import { getList, getModelList, doTrain, startTest, stopTrain, continueTrainTrain } from './services/api';
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const InputGroup = Input.Group;
moment.locale('zh-cn');
const { confirm } = Modal;
class FreeFish extends React.Component {
    state = {
        test: {
            frontImage: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet-test:",
            baseImage: "latest",
            showTestDrawer: false,
            showTestDrawerUrl: "",
            showTestModal: false,
            loading: false,
            tips: "载入可使用的权重文件... ",
            doTest: {
                providerType: "yolov3",
                assetsDir: "", //nowAssetsDir
                weights: undefined,
                port: 8100,
                javaUrl: "ai.8101.api.qtingvision.com",
                javaPort: 888,
                image: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet-test:latest",
            },
        },
        timer: null,
        refreshInterval: localStorage.getItem("refreshInterval") === null?30000:localStorage.getItem("refreshInterval"),
        refreshTime: moment().format("YYYY-MM-DD HH:mm:ss"),
        selectedRowKeys: [], // Check here to configure the default column
        pagination: {defaultPageSize:50, current:0},
        loading: false,
        leftVisible: false,
        rightVisible: false,
        doChangeAssetsDir: true,

        /*
        *  package_info = {"projectId": data["projectId"], "projectName": data["projectName"], "packageDir": data["packageDir"], "packageName": data["packageName"]}
        trainInfo = {"projectId": data["projectId"],
                     "projectName": data["projectName"],
                     "assetsDir": data["assetsDir"],
                     "assetsType": data["assetsType"],
                     "providerType": data["providerType"],
                     "providerOptions": {"yolov3Image": data["image"]}
                     }*/
        api: {
            url: localStorage.getItem("api.url") === null?"server.qtingvision.com":localStorage.getItem("api.url"),
            port: localStorage.getItem("api.port") === null?888:localStorage.getItem("api.port"),
        },
        train : {
            frontImage: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet:",
            baseImage: "latest",
            doTrain: {
                projectId: undefined, // 项目id
                projectName: undefined, // 项目名称
                packageDir: undefined, // tar压缩包里面文件夹的目录名
                packageName: "", //tar包的名称
                assetsDir: undefined, // 素材文件夹，和packageDir相同
                assetsType: "pascalVoc", // 素材的类型，pascalVoc和coco和other
                providerType: "yolov3", // 框架的类型yolov3 fasterRcnn maskRcnn
                image: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet:latest", // 镜像路径
            },
        },
        continueTrain: {
            showModal: false,
            loading: false,
            frontImage: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet:",
            baseImage: "latest",
            width: undefined,
            height: undefined,
            max_batches: undefined,
            projectId: undefined, // 项目id
            assetsType: "pascalVoc", // 素材的类型，pascalVoc和coco和other
            projectName: undefined, // 项目名称
            providerType: "yolov3", // 框架的类型yolov3 fasterRcnn maskRcnn
            image: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet:latest", // 镜像路径
            assetsDir: "", //nowAssetsDir
            weights: undefined,
        }
    };

    onSelectChange = (selectedRowKeys) => {
        console.log('selectedRowKeys changed: ', selectedRowKeys);
        this.setState({ selectedRowKeys });
    };

    componentDidMount() {
        const {dispatch} = this.props;
        message.success(`正在加载`);
        dispatch({
            type: 'service/getList',
            payload: {
                page: 0,
                num: 50,
            },
            callback: (v) => {
                console.log(`加载：${JSON.stringify(v)}`);
                //<Pagination
                //       total={85}
                //       showTotal={total => `Total ${total} items`}
                //       pageSize={20}
                //       defaultCurrent={1}
                //     />
                // noinspection JSAnnotator
                this.setState({
                    ...this.state,
                    pagination:{
                        ...this.state.pagination,
                        total: v["total"],
                        pageSize: v["num"],
                        current: 0,
                    }
                });
            },
        });
        this.state.timer=setInterval(()=>{
            dispatch({
                type: 'service/getList',
                payload: {
                    page: this.state.pagination.current,
                    num: this.state.pagination.defaultPageSize,
                },
                callback: (v) => {
                    console.log(`加载：${JSON.stringify(v)}`);
                    this.setState({
                        ...this.state,
                        refreshTime: moment().format("YYYY-MM-DD HH:mm:ss"),
                        pagination:{
                            ...this.state.pagination,
                            total: v["total"],
                            pageSize: v["num"],
                        }
                    });
                },
            });
            console.log("我是定时任务");
        }, this.state.refreshInterval);
    }

    componentWillUnmount() {
        if(this.state.timer!= null) {
            clearInterval(this.state.timer);
        }
    }

    handleTableChange = (pagination, filters, sorter) => {
        const pager = { ...this.state.pagination };
        pager.current = pagination.current;
        this.setState({
            pagination: pager,
        });
        console.log(`页码：${JSON.stringify(pager)}`);

        const { dispatch } = this.props;
        dispatch({
            type: 'service/getList',
            payload: {
                page: pager.current-1,
                num: pager.pageSize,
            },
            callback: (v) => {
                console.log(`${JSON.stringify(v)}`);
            },
        });
    };

    showLeftDrawer = () => {
        this.setState({
            leftVisible: true,
        });
    };

    hideLeftDrawer = () => {
        this.setState({
            leftVisible: false,
        });
    };



    render() {
        const {
            service: {trains: {list}, modelList}
        } = this.props;
        // let filters = keylist.data.map(function(item){
        //     return {text: `[${item["status"]===1?"开启":"关闭"}] ${item["key"]}`, value: item["id"]};
        // });

        /*
        * {"id":1,"project_id":"dfg",
        * "container_id":"asdvgwsdvsdfqirqwjhoijwqejwqjeqweqweqws",
        * "project_name":"测试1","status":1,"net_framework":"oodas","assets_type":"None","assets_directory_base":"None",
        * "assets_directory_name":"None","is_jump":0,"create_time":"2019-08-07 00:46:32"}*/
        const columns = [{
            title: '项目id',
            dataIndex: 'project_id',
        }, {
            title: '项目名称',
            dataIndex: 'project_name',
        }, {
            title: '容器id',
            dataIndex: 'container_id',
        }, {
            title: '网络框架',
            dataIndex: 'net_framework',
        }, {
            title: '数据类型',
            dataIndex: 'assets_type',
        }, {
            title: '文件夹',
            dataIndex: 'assets_directory_name',
        }, {
            title: '是否插队',
            dataIndex: 'is_jump',
            render: v => {
                if (v === 1) return <Tag color="#2db7f5">插队</Tag>;
                else return <Tag>正常</Tag>;
            }
        }, {
            title: '创建时间',
            dataIndex: 'create_time',
        }, {
            title: '状态',
            dataIndex: 'status',
            render: v => {
                //0:等待解包
                // 1:解包完成
                // 2:正在训练
                // 3:训练完成
                if (v === 0) return <Tag color="#A9A9A9">等待解包</Tag>;
                else if (v === 1) return <Tag color="#f50">解包完成</Tag>;
                else if (v === 2) return <Button type="danger" loading>正在训练</Button>;
                else if (v === 3) return <Tag color="#800080">暂停训练</Tag>;
                else if (v === 4) return <div><Tag color="#008000">训练完成</Tag><Icon type="smile" theme="twoTone"/></div>;
                else if (v === -1) return <Tag color="#708090">训练出错</Tag>;
                else return <Tag>未知</Tag>;
            }
        }];


        const {selectedRowKeys} = this.state;
        const rowSelection = {
            selectedRowKeys,
            onChange: this.onSelectChange,
            hideDefaultSelections: true,
            selections: [{
                key: 'all-data',
                text: 'Select All Data',
                onSelect: () => {
                    this.setState({
                        selectedRowKeys: [...Array(46).keys()], // 0...45
                    });
                },
            }, {
                key: 'odd',
                text: 'Select Odd Row',
                onSelect: (changableRowKeys) => {
                    let newSelectedRowKeys = [];
                    newSelectedRowKeys = changableRowKeys.filter((key, index) => {
                        if (index % 2 !== 0) {
                            return false;
                        }
                        return true;
                    });
                    this.setState({...this.state, selectedRowKeys: newSelectedRowKeys});
                },
            }, {
                key: 'even',
                text: 'Select Even Row',
                onSelect: (changableRowKeys) => {
                    let newSelectedRowKeys = [];
                    newSelectedRowKeys = changableRowKeys.filter((key, index) => {
                        if (index % 2 !== 0) {
                            return true;
                        }
                        return false;
                    });
                    this.setState({selectedRowKeys: newSelectedRowKeys});
                },
            }],
            onSelection: this.onSelection,
        };
        const Description = ({term, children, span = 12}) => (
            <Col span={span}>
                <div className="description">
                    <div className="term">{term}</div>
                    <div className="detail">{children}</div>
                </div>
            </Col>
        );

        const content = (
            <Row>
                <Description term="服务管理">
                    <a href="http://192.168.31.75" target="view_window">http://192.168.31.75</a>
                    <br/>
                    <a href="http://ai.qtingvision.com:888" target="view_window">http://ai.qtingvision.com:888</a>
                </Description>
                <Description term="画图服务">
                    <a href="http://192.168.31.75:8097" target="view_window">http://192.168.31.75:8097</a>
                    <br/>
                    <a href="http://draw.qtingvision.com:888" target="view_window">http://draw.qtingvision.com:888</a>
                </Description>
                <Description term="队列服务">
                    <a href="http://192.168.31.75:15672" target="view_window">http://192.168.31.75:15672</a>
                    <br/>
                    <a href="http://queue.qtingvision.com:888" target="view_window">http://queue.qtingvision.com:888</a>
                </Description>
                <Description term="ftp服务">
                    <a href="ftp://192.168.31.75:21/" target="view_window">ftp://192.168.31.75/</a>
                </Description>
                {/*<Description term="Remarks" span={24}>*/}
                {/*我是数艘模式打开的年四季度拉上你的空间按时刻把数据库但是当你什么的女生看*/}
                {/*</Description>*/}
            </Row>
        );

        const extraContent = (
            <Row>
                <Button type="danger" size="large" onClick={this.showLeftDrawer}>
                    使用前看我
                </Button>
            </Row>
        );
        return (
            <PageHeader
                backIcon={false}
                title="远程训练"
                subTitle="管理后台"
                tags={<Tag color="green">正常</Tag>}
                extra={[
                    <span>{`页面刷新时间:`}</span>,
                    <Text mark>{`${this.state.refreshTime}`}</Text>,
                    <span>刷新间隔(秒):</span>,
                    <Select defaultValue={`${this.state.refreshInterval / 1000}s`} style={{width: 120}}
                            onChange={(v) => {
                                localStorage.setItem("refreshInterval", v);
                            }}>
                        <Option value="5000">5s</Option>
                        <Option value="10000">10s</Option>
                        <Option value="30000">30s</Option>
                        <Option value="60000">60s</Option>
                    </Select>,
                    <Button key="1" type="primary" onClick={() => {
                        this.setState({
                            rightVisible: true,
                            leftVisible: true,
                            train: {
                                ...this.state.train,
                                doTrain: {
                                    ...this.state.train.doTrain,
                                    projectId: moment().format('x')
                                }
                            }
                        });
                    }}>
                        新增训练(非Power-ai)
                    </Button>,
                ]}
                footer={
                    <Table size={"small"} rowSelection={rowSelection} columns={columns} dataSource={list}
                           onChange={this.handleTableChange}
                           expandedRowRender={record => {
                               return (
                                   <Row style={{marginLeft: 50}}>
                                       <Row>
                                           <Switch style={{marginTop: -3}} checkedChildren="插队开" unCheckedChildren="插队关"
                                                   disabled={record.is_jump === 1} defaultChecked={record.is_jump === 1}
                                                   onChange={(c) => {
                                                       message.success(`待完善， ${c}`)
                                                   }}/>
                                           <Button type="primary" size="small" style={{marginLeft: 10}}
                                                   disabled={record.status !== 2} onClick={() => {
                                               confirm({
                                                   title: '提示',
                                                   content: '确定要停止训练么?',
                                                   onOk: () => {
                                                       const {dispatch} = this.props;
                                                       dispatch({
                                                           type: 'service/stopTrain',
                                                           payload: {
                                                               projectId: record.project_id,
                                                               assetsDir: record.assets_directory_name
                                                           },
                                                           callback: (v) => {
                                                               if (v.res === "ok") {
                                                                   message.success("已经停止训练");
                                                                   dispatch({
                                                                       type: 'service/getList',
                                                                       payload: {
                                                                           page: this.state.pagination.current,
                                                                           num: this.state.pagination.defaultPageSize,
                                                                       },
                                                                       callback: (v) => {
                                                                           console.log(`加载：${JSON.stringify(v)}`);
                                                                           this.setState({
                                                                               ...this.state,
                                                                               refreshTime: moment().format("YYYY-MM-DD HH:mm:ss"),
                                                                               pagination:{
                                                                                   ...this.state.pagination,
                                                                                   total: v["total"],
                                                                                   pageSize: v["num"],
                                                                               }
                                                                           });
                                                                       },
                                                                   });
                                                               } else {
                                                                   message.error("停止训练失败");
                                                               }
                                                           }
                                                       });
                                                   },
                                                   onCancel() {},
                                               });
                                           }}>停止训练</Button>
                                           <Button type="primary" size="small" style={{marginLeft: 10}}
                                                   disabled={record.status === 2} onClick={() => {
                                               this.setState(
                                                   {
                                                       ...this.state,
                                                       continueTrain: {
                                                           ...this.state.continueTrain,
                                                           loading: true,
                                                           showModal: true,
                                                       }
                                                   },
                                                   () => {
                                                       const {dispatch} = this.props;
                                                       dispatch({
                                                           type: 'service/getModelList',
                                                           payload: {
                                                               type: record.net_framework,
                                                               path: encodeURI(record.assets_directory_name)
                                                           },
                                                           callback: (v) => {
                                                               let fImage = "";
                                                               let bImage = "latest";
                                                               // let port = 8100;
                                                               // let javaUrl = "";
                                                               // let javaPort = 888;
                                                               if (record.net_framework === "yolov3") {
                                                                   // port = 8100;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/darknet:";
                                                                   // javaUrl = "ai.8101.api.qtingvision.com";
                                                               } else if (record.net_framework === "fasterRcnn") {
                                                                   // port = 8200;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/detectron:";
                                                                   // javaUrl = "ai.8101.api.qtingvision.com";
                                                               } else if (record.net_framework === "maskRcnn") {
                                                                   // port = 8300;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/detectron:";
                                                                   // javaUrl = "ai.8101.api.qtingvision.com";
                                                               } else if (record.net_framework === "other") {
                                                                   // port = 8400;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:";
                                                                   // javaUrl = "ai.8401.api.qtingvision.com";
                                                               }

                                                               this.setState({
                                                                   ...this.state,
                                                                   continueTrain: {
                                                                       ...this.state.continueTrain,
                                                                       loading: false,
                                                                       frontImage: fImage,
                                                                       baseImage: bImage,
                                                                       showModal: true,
                                                                       assetsType: record.assets_type, // 素材的类型，pascalVoc和coco和other
                                                                       projectName: record.project_name, // 项目名称
                                                                       projectId: record.project_id,
                                                                       providerType: record.net_framework,
                                                                       assetsDir: record.assets_directory_name, //nowAssetsDir
                                                                       image: `${fImage}${bImage}`,
                                                                   }
                                                               });
                                                           },
                                                       });
                                                   });
                                           }}>继续训练</Button>
                                           <Button type="primary" size="small" style={{marginLeft: 10}} onClick={() => {
                                               this.setState(
                                                   {
                                                       ...this.state,
                                                       test: {
                                                           ...this.state.test,
                                                           loading: true,
                                                           showTestModal: true,
                                                       }
                                                   },
                                                   () => {
                                                       const {dispatch} = this.props;
                                                       dispatch({
                                                           type: 'service/getModelList',
                                                           payload: {
                                                               type: record.net_framework,
                                                               path: encodeURI(record.assets_directory_name)
                                                           },
                                                           callback: (v) => {

                                                               let fImage = "";
                                                               let bImage = "latest";
                                                               let port = 8100;
                                                               let javaUrl = "";
                                                               let javaPort = 888;
                                                               if (record.net_framework === "yolov3") {
                                                                   port = 8100;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/darknet-test:";
                                                                   javaUrl = "ai.8101.api.qtingvision.com";
                                                               } else if (record.net_framework === "fasterRcnn") {
                                                                   port = 8200;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/detectron-test:";
                                                                   javaUrl = "ai.8101.api.qtingvision.com";
                                                               } else if (record.net_framework === "maskRcnn") {
                                                                   port = 8300;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/detectron-test:";
                                                                   javaUrl = "ai.8101.api.qtingvision.com";
                                                               } else if (record.net_framework === "other") {
                                                                   port = 8400;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:";
                                                                   javaUrl = "ai.8401.api.qtingvision.com";
                                                               }

                                                               this.setState({
                                                                       ...this.state,
                                                                       test: {
                                                                           ...this.state.test,
                                                                           loading: false,
                                                                           frontImage: fImage,
                                                                           baseImage: bImage,
                                                                           showTestModal: true,
                                                                           doTest: {
                                                                               ...this.state.test.doTest,
                                                                               port: port,
                                                                               javaUrl: javaUrl,
                                                                               javaPort: javaPort,
                                                                               providerType: record.net_framework,
                                                                               assetsDir: record.assets_directory_name, //nowAssetsDir
                                                                               image: `${fImage}${bImage}`
                                                                           }
                                                                       }
                                                                   });
                                                           },
                                                       });
                                                   });
                                           }}>打开测试端口</Button>
                                           <Button type="primary" size="small" style={{marginLeft: 10}}>日志</Button>
                                       </Row>
                                       <Row>
                                           <Divider/>
                                       </Row>
                                       <Row>
                                           <Iframe url={record.draw_url}
                                                   width="100%"
                                                   height="500px"
                                                   id="myId"
                                                   frameBorder={0}
                                                   className="myClassname"
                                                   display="initial"
                                                   position="relative"/>
                                           <a href={record.url} target="view_window"
                                              style={{margin: 0}}>{record.description}</a>
                                       </Row>
                                   </Row>
                               )
                           }}
                           expandRowByClick
                           pagination={this.state.pagination}/>
                }
            >
                <div className="wrap">

                    <Modal
                        title="继续训练"
                        okText="开始"
                        cancelText="取消"
                        destroyOnClose
                        width={1000}
                        visible={this.state.continueTrain.showModal}
                        onOk={() => {
                            const {dispatch} = this.props;
                            this.setState({
                                    ...this.state,
                                    continueTrain: {
                                        ...this.state.continueTrain,
                                    }
                                },
                                () => {
                                    dispatch({
                                        type: 'service/continueTrainTrain',
                                        payload: {
                                            ...this.state.continueTrain
                                        },
                                        callback: (v) => {
                                            if (v.res !== "ok") {
                                                message.error(v.msg);
                                            } else {
                                                this.setState({
                                                    ...this.state,
                                                    continueTrain: {
                                                        ...this.state.continueTrain,
                                                        showModal: false,
                                                        loading: false,
                                                    }
                                                });
                                                dispatch({
                                                    type: 'service/getList',
                                                    payload: {
                                                        page: this.state.pagination.current,
                                                        num: this.state.pagination.defaultPageSize,
                                                    },
                                                    callback: (v) => {
                                                        console.log(`加载：${JSON.stringify(v)}`);
                                                        this.setState({
                                                            ...this.state,
                                                            refreshTime: moment().format("YYYY-MM-DD HH:mm:ss"),
                                                            pagination:{
                                                                ...this.state.pagination,
                                                                total: v["total"],
                                                                pageSize: v["num"],
                                                            }
                                                        });
                                                    },
                                                });
                                            }
                                        }});
                                });
                        }}
                        onCancel={() => {
                            this.setState({
                                ...this.state,
                                continueTrain: {
                                    ...this.state.continueTrain,
                                    showModal: false,
                                }
                            });
                        }}
                        okButtonProps={{disabled: this.state.continueTrain.weights === undefined}}
                        cancelButtonProps={{disabled: false}}
                    >
                        {
                            this.state.continueTrain.providerType === "yolov3" &&   <Spin spinning={this.state.continueTrain.loading} tip={"正在加载权重文件"} delay={500}>
                                图像宽:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}} placeholder={modelList.width}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 continueTrain: {
                                                     ...this.state.continueTrain,
                                                     width: value,
                                                 }
                                             })}/>
                                图像高:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}} placeholder={modelList.height}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 continueTrain: {
                                                     ...this.state.continueTrain,
                                                     height: value,
                                                 }
                                             })}/>
                                训练最大轮数:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}} placeholder={modelList.max_batches}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 continueTrain: {
                                                     ...this.state.continueTrain,
                                                     max_batches: value,
                                                 }
                                             })}/>
                                选择加载的权重文件(如果是梯度爆炸就劲量选择前几个保留的文件):
                                <Select
                                    style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                    onChange={(v)=>{
                                        this.setState({
                                            ...this.state,
                                            continueTrain: {
                                                ...this.state.continueTrain,
                                                weights: v
                                            }
                                        });
                                    }}>
                                    {modelList.weights_list.map(d => (
                                        <Option key={d.path}>{d.filename}</Option>
                                    ))}
                                </Select>
                                镜像地址:
                                <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="镜像地址"
                                       addonBefore={this.state.continueTrain.frontImage}
                                       value={this.state.continueTrain.baseImage} allowClear
                                       onChange={(e) => this.setState({
                                           ...this.state,
                                           continueTrain: {
                                               ...this.state.continueTrain,
                                               image: `${this.state.continueTrain.frontImage}${e.target.value}`
                                           }
                                       })}/>
                            </Spin>
                        }
                        {
                            (this.state.continueTrain.providerType === "fasterRcnn" || this.state.continueTrain.providerType === "maskRcnn") &&   <Spin spinning={this.state.continueTrain.loading} tip={"正在加载权重文件"} delay={500}>
                                训练最大轮数:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}} placeholder={modelList.max_batches}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 continueTrain: {
                                                     ...this.state.continueTrain,
                                                     max_batches: value,
                                                 }
                                             })}/>
                                选择加载的权重文件(如果是梯度爆炸就劲量选择前几个保留的文件):
                                <Select
                                    style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                    onChange={(v)=>{
                                        this.setState({
                                            ...this.state,
                                            continueTrain: {
                                                ...this.state.continueTrain,
                                                weights: v
                                            }
                                        });
                                    }}>
                                    {modelList.weights_list.map(d => (
                                        <Option key={d.path}>{d.filename}</Option>
                                    ))}
                                </Select>
                                镜像地址:
                                <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="镜像地址"
                                       addonBefore={this.state.continueTrain.frontImage}
                                       value={this.state.continueTrain.baseImage} allowClear
                                       onChange={(e) => this.setState({
                                           ...this.state,
                                           continueTrain: {
                                               ...this.state.continueTrain,
                                               image: `${this.state.continueTrain.frontImage}${e.target.value}`
                                           }
                                       })}/>
                            </Spin>
                        }

                    </Modal>
                    <Modal
                        title="参数设置"
                        okText="打开测试服务"
                        cancelText="取消"
                        destroyOnClose
                        width={1000}
                        visible={this.state.test.showTestModal}
                        onOk={() => {
                            const {dispatch} = this.props;
                            this.setState({
                                    ...this.state,
                                    test: {
                                        ...this.state.test,
                                        tips: "正在打开服务",
                                        // showTestModal: false,
                                        loading: true,
                                    }
                                },
                                () => {
                                    dispatch({
                                        type: 'service/startTest',
                                        payload: {
                                            ...this.state.test.doTest
                                        },
                                        callback: (v) => {
                                            if (v.res !== "ok") {
                                                message.error(v.msg);
                                            }

                                            this.setState({
                                                ...this.state,
                                                test: {
                                                    ...this.state.test,
                                                    showTestDrawer: true,
                                                    showTestModal: false,
                                                    loading: false,
                                                    doTest: {
                                                        ...this.state.test.doTest,
                                                        weights: undefined,
                                                    },
                                                    // showTestDrawerUrl: `/test?javaUrl=${}&javaPort=${}&providerType=${this.state.test.doTest.providerType}&port=${this.state.test.port}&assets=${this.state.test.doTest.assetsDir}`,
                                                    showTestDrawerUrl: `/test?javaUrl=${this.state.test.doTest.javaUrl}&javaPort=${this.state.test.doTest.javaPort}&providerType=${this.state.test.doTest.providerType}&port=${this.state.test.doTest.port}&assets=${this.state.test.doTest.assetsDir}`,
                                                }
                                            });

                                            // const tempwindow=window.open();
                                            // tempwindow.location=`/test?port=8100&assets=${this.state.test.nowAssetsDir}`;
                                            // window.open(`/test?port=8100&assets=${this.state.test.nowAssetsDir}`, "_blank");
                                            // window.open(`/test?port=8100&assets=${this.state.test.nowAssetsDir}`, "_blank", "scrollbars=yes,resizable=1,modal=false,alwaysRaised=yes");
                                        }});
                                });
                        }}
                        onCancel={() => {
                            this.setState({
                                ...this.state,
                                test: {
                                    ...this.state.test,
                                    showTestModal: false,
                                    doTest: {
                                        ...this.state.test.doTest,
                                        weights: undefined,
                                    }
                                }
                            });
                        }}
                        okButtonProps={{disabled: this.state.test.doTest.weights === undefined}}
                        cancelButtonProps={{disabled: false}}
                    >
                        <Spin spinning={this.state.test.loading} tip={this.state.test.tips} delay={500}>
                            网络框架:
                            <Input style={{width: '100%', marginTop: "10px", marginBottom: "10px"}} placeholder="Basic usage" disabled value={this.state.test.doTest.providerType}/>
                            服务端口:
                            <Input style={{width: '100%', marginTop: "10px", marginBottom: "10px"}} placeholder="Basic usage" disabled value={this.state.test.doTest.port}/>
                            选择加载的权重文件:
                            <Select
                                style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                    onChange={(v)=>{
                                        this.setState({
                                            ...this.state,
                                            test: {
                                                ...this.state.test,
                                                doTest: {
                                                    ...this.state.test.doTest,
                                                    weights: v
                                                }
                                            }
                                        });
                                    }}>
                                {modelList.weights_list.map(d => (
                                    <Option key={d.path}>{d.filename}</Option>
                                ))}
                            </Select>
                            镜像地址:
                            <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="tar压缩包名"
                                   addonBefore={this.state.test.frontImage}
                                   value={this.state.test.baseImage} allowClear
                                   onChange={(e) => this.setState({
                                       ...this.state,
                                       test: {
                                           ...this.state.test,
                                           doTest: {
                                               ...this.state.test.doTest,
                                               image: `${this.state.test.frontImage}${e.target.value}`
                                           }
                                       }
                                   })}/>
                        </Spin>
                    </Modal>

                    <Drawer
                        title="在线测试"
                        placement="bottom"
                        width="100%"
                        height="100%"
                        closable={true}
                        onClose={()=>{this.setState({
                            ...this.state,
                            test: {
                                ...this.state.test,
                                showTestDrawer: false,
                            }
                        })}}
                        visible={this.state.test.showTestDrawer}
                    >
                        <Iframe url={this.state.test.showTestDrawerUrl}
                                width="100%"
                                height="450px"
                                id="myId"
                                frameBorder={0}
                                className="myClassname"
                                display="initial"
                                position="relative"/>
                        {/*<Iframe url={this.state.test.showTestDrawerUrl}*/}
                                {/*width="100%"*/}
                                {/*height="500px"*/}
                                {/*id="myId"*/}
                                {/*frameBorder={0}*/}
                                {/*className="myClassname"*/}
                                {/*display="initial"*/}
                                {/*position="relative"/>*/}
                    </Drawer>


                    <Drawer
                        title="新增训练(非Power-ai)-使用教程"
                        placement="left"
                        width="50%"
                        closable={true}
                        onClose={this.hideLeftDrawer}
                        visible={this.state.leftVisible}
                    >
                        <Typography>
                            <Title>介绍</Title>
                            <Paragraph>
                                远程训练系统，支持通过Power-Ai标完图直接训练，还支持手动训练其他数据和各种框架。由于软件里集成度高，几乎实现傻瓜式的配置。所以这里主要介绍怎么使用手动训练
                            </Paragraph>
                            <Paragraph>
                                由于不通框架训练使用的方式也不一样，本系统主要基于docker实现训练，目前提供3种自动化集成度高的框架。<Text mark>Yolov3</Text>和<Text
                                mark>FasterRcnn</Text>和<Text mark>MaskRcnn</Text>，
                                当然有其他集成度较高的框架也可以通过镜像直接加载。
                            </Paragraph>
                            <Paragraph>
                                <Text mark>特别说明：本系统只支持一种压缩包格式自解压<Text code>tar</Text>，上传一定要是tar格式压缩包，否则直接凉凉。</Text>
                                <br/>
                                <Text mark>特别说明：需要填写的目录绝对区分大小写！！！，否则也是直接凉凉。</Text>
                            </Paragraph>
                            <Title level={2}>Yolov3示例：</Title>
                            <Paragraph>
                                <ul>
                                    <li>
                                        <Title level={4}>1.制作标准的2012格式的Pascal Voc数据集</Title>
                                        <Paragraph>
                                            在目标检测中，主要用到了 Annotations，ImageSets，JPEGImages
                                            其中 ImageSets/Main/ 保存了具体数据集的索引，Annotations 保存了标签数据， JPEGImages 保存了图片内容。
                                            ImageSets/Main/ 文件夹以 , $class$_train.txt $class$_val.txt的格式命名。 train.txt
                                            val.txt 例外，可以没有
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>2.在Pascal Voc数据集的根目录下新建配置文件
                                            <Text mark><a target="view_window"
                                                          href="https://github.com/yiningzeng/darknet-license/blob/master/remote_train/yolov3-voc.cfg">yolov3-voc.cfg</a></Text>
                                            和<Text mark><a target="view_window"
                                                           href="https://github.com/yiningzeng/darknet-license/blob/master/remote_train/use_gpus">use_gpus</a></Text></Title>
                                        <Paragraph>
                                            如果使用服务器来训练的话，两个配置文件都不需要改动<br/>
                                            配置文件:<br/>
                                            <Text mark>yolov3-voc.cfg</Text>只需要更改<Text code>batch=68</Text>和<Text
                                            code>subdivisions=32</Text>，一般情况不用更改
                                            <br/>
                                            <Text mark>use_gpus</Text>只是需要使用的显卡的id号通过英文<Text code>,</Text>来拼接
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>3.打包文件夹并上传</Title>
                                        <Paragraph>
                                            <Text strong>ftp账号:</Text><Text code>ftpicubic</Text><br/>
                                            <Text strong>ftp密码:</Text><Text code>ftpicubic-123</Text><br/>
                                            比如你的Pascal Voc数据集的目录是<Text code>我是voc目录</Text>，那么你压缩打包的文件名是<Text
                                            code>我是voc目录.tar</Text><Text strong>你一定要记住，下一步中需要用到</Text>
                                            通过上文提供的ftp地址上传文件到根目录，推荐使用<Text code>FileZilla</Text>客户端上传
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>4.恭喜你已经完成了所有的配置，只用把信息提交就行了</Title>
                                        <Paragraph>
                                            <Text strong>点页面右上角按钮</Text>
                                            填写项目名和上一步的信息，其他如果没更新那直接默认。主要是镜像地址，使用前咨询开发
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>5.等着训练</Title>
                                    </li>
                                </ul>
                            </Paragraph>

                            <Title level={2}>Detectron示例：</Title>
                            <Paragraph>
                                <ul>
                                    <li>
                                        <Title level={4}>1.制作CoCo数据集</Title>
                                        <Paragraph>
                                            新建目录<Text mark>演示项目</Text>，在目录中放置数据集目录<Text mark>coco</Text>，区分大小写，注意这里是小写。
                                            在目标检测中，主要用到了 coco/coco_val2014，coco/coco_train2014，coco/annotations
                                            其中 coco/annotations 保存了标签数据， coco/coco_val2014，coco/coco_train2014 保存了图片内容。
                                            在coco/annotations 文件夹中 ,
                                            instances_train2014.json为训练的数据集，instances_minival2014.json为测试的数据集。
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>2.在CoCo数据集的根目录下新建配置文件</Title>
                                        <Paragraph>
                                            <Text mark>project_id.log</Text> 里面存写项目名，和画图主窗口有关<br/>
                                            新建文件<Text mark>train_log/convert_data.log</Text> 如果文件夹不存在直接创建<br/>
                                            <Text mark><a target="view_window"
                                                          href="https://github.com/yiningzeng/RemoteTrain/blob/master/config-template/train-config.yaml">
                                                train-config.yaml</a></Text><br/>
                                            配置
                                            <Text mark>train-config.yaml</Text>说明:<br/>
                                            需要更改<Text code>NUM_CLASSES: 实际目标的数目+1</Text>和<Text code>NUM_GPUS:
                                            训练需要使用的GPU数量</Text>，注意:后有空格
                                            <br/>
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>3.打包文件夹并上传</Title>
                                        <Paragraph>
                                            <Text strong>ftp账号:</Text><Text code>ftpicubic</Text><br/>
                                            <Text strong>ftp密码:</Text><Text code>ftpicubic-123</Text><br/>
                                            比如你的项目目录是<Text code>演示项目</Text>，那么你压缩打包的文件名是<Text code>演示项目.tar</Text><Text
                                            strong>你一定要记住，下一步中需要用到</Text>
                                            通过上文提供的ftp地址上传文件到根目录，推荐使用<Text code>FileZilla</Text>客户端上传
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>4.恭喜你已经完成了所有的配置，只用把信息提交就行了</Title>
                                        <Paragraph>
                                            <Text strong>点页面右上角按钮</Text>
                                            填写项目名和上一步的信息，其他如果没更新那直接默认。主要是镜像地址，使用前咨询开发
                                        </Paragraph>
                                    </li>
                                    <li>
                                        <Title level={4}>5.等着训练</Title>
                                    </li>
                                </ul>
                            </Paragraph>
                        </Typography>
                    </Drawer>

                    <Drawer
                        title="新增训练(非Power-ai)"
                        placement="right"
                        width="50%"
                        closable={false}
                        maskClosable={false}
                        onClose={() => {
                            this.setState({
                                rightVisible: false,
                                leftVisible: false,
                            });
                        }}
                        visible={this.state.rightVisible}
                    >
                        接口地址:
                        <InputGroup style={{marginTop: "10px", marginBottom: "20px"}} compact>
                            <Input style={{width: '50%'}} addonBefore="http://" value={this.state.api.url}
                                   onChange={e => {
                                       this.setState({
                                           ...this.state,
                                           api: {
                                               ...this.state.api,
                                               url: e.target.value,
                                           }
                                       });
                                   }}
                                   placeholder="网址不带http://" allowClear/>
                            <Input
                                style={{
                                    width: 30,
                                    borderLeft: 0,
                                    pointerEvents: 'none',
                                    backgroundColor: '#fff',
                                }}
                                placeholder=":"
                                disabled
                            />
                            <Input style={{width: '10%', textAlign: 'center', borderLeft: 0}}
                                   value={this.state.api.port} onChange={(e) => {
                                this.setState({
                                    ...this.state,
                                    api: {
                                        ...this.state.api,
                                        port: e.target.value,
                                    }
                                });
                            }} defaultValue={this.state.apiPort} placeholder="port"/>
                            <Button type="primary" onClick={() => {
                                localStorage.setItem("api.url", this.state.api.url);
                                localStorage.setItem("api.port", this.state.api.port);
                                message.success("保存成功");
                            }}>保存接口</Button>
                        </InputGroup>
                        项目ID:
                        <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="项目ID"
                               value={this.state.train.doTrain.projectId}
                               allowClear onChange={(e) => this.setState({
                            train: {
                                ...this.state.train,
                                doTrain: {
                                    ...this.state.train.doTrain,
                                    projectId: e.target.value
                                }
                            }
                        })}/>
                        项目名:
                        <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="项目名"
                               allowClear onChange={(e) => this.setState({
                            train: {
                                ...this.state.train,
                                doTrain: {
                                    ...this.state.train.doTrain,
                                    projectName: e.target.value
                                }
                            }
                        })}/>
                        tar压缩包名:
                        <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="tar压缩包名" addonAfter=".tar"
                               allowClear onChange={(e) => this.setState({
                            train: {
                                ...this.state.train,
                                doTrain: {
                                    ...this.state.train.doTrain,
                                    packageName: `${e.target.value}.tar`,
                                    packageDir: this.state.doChangeAssetsDir ? e.target.value : this.state.train.doTrain.packageDir,
                                    assetsDir: this.state.doChangeAssetsDir ? e.target.value : this.state.train.doTrain.assetsDir,
                                }
                            }
                        })}/>
                        解压后的目录名:
                        <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="解压后的目录名"
                               value={this.state.train.doTrain.assetsDir}
                               allowClear onChange={(e) => this.setState({
                            doChangeAssetsDir: false,
                            train: {
                                ...this.state.train,
                                doTrain: {
                                    ...this.state.train.doTrain,
                                    packageDir: e.target.value, assetsDir: e.target.value
                                }
                            }
                        })}/>
                        数据格式:
                        <Select style={{marginTop: "10px", marginBottom: "20px", width: "100%"}}
                                defaultValue="pascalVOC"
                                onChange={(value) => this.setState({
                                    train: {
                                        ...this.state.train,
                                        doTrain: {
                                            ...this.state.train.doTrain,
                                            assetsType: value
                                        }
                                    }
                                })}>
                            <Option value="pascalVOC">pascalVOC</Option>
                            <Option value="coco">coco</Option>
                            <Option value="other">other</Option>
                        </Select>
                        使用的框架:
                        <Select style={{marginTop: "10px", marginBottom: "20px", width: "100%"}} defaultValue="yolov3"
                                onChange={(value) => {
                                    console.log("providerType" + value);
                                    let fImage = "";
                                    let bImage = "latest";
                                    if (value === "yolov3") {
                                        fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/darknet:";
                                    } else if (value === "fasterRcnn") {
                                        fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/detectron:";
                                    } else if (value === "maskRcnn") {
                                        fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/detectron:";
                                    } else if (value === "other") {
                                        fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:";
                                    }
                                    this.setState({
                                        ...this.state,
                                        train: {
                                            ...this.state.train,
                                            frontImage: fImage,
                                            baseImage: bImage,
                                            doTrain: {
                                                ...this.state.train.doTrain,
                                                providerType: value,
                                                image: `${fImage}${bImage}`
                                            }
                                        }
                                    });
                                }}>
                            <Option value="yolov3">yolov3</Option>
                            <Option value="fasterRcnn">fasterRcnn</Option>
                            <Option value="maskRcnn">maskRcnn</Option>
                            <Option value="other">other</Option>
                        </Select>
                        镜像地址:
                        <InputGroup compact>
                            <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="tar压缩包名"
                                   addonBefore={this.state.train.frontImage}
                                   defaultValue={this.state.train.baseImage} allowClear
                                   onChange={(e) => {
                                       message.success(this.state.train.frontImage);
                                       this.setState({
                                           train: {
                                               ...this.state.train,
                                               baseImage: e.target.value,
                                               doTrain: {
                                                   ...this.state.train.doTrain,
                                                   image: `${this.state.train.frontImage}${e.target.value}`
                                               }
                                           }
                                       })
                                   }}/>
                        </InputGroup>

                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                bottom: 0,
                                width: '100%',
                                borderTop: '1px solid #e9e9e9',
                                padding: '10px 16px',
                                background: '#fff',
                                textAlign: 'right',
                            }}
                        >
                            <Button onClick={() => {
                                this.setState({
                                    rightVisible: false,
                                    leftVisible: false,
                                });
                            }} style={{marginRight: 8}}>
                                取消
                            </Button>
                            <Button onClick={() => {
                                const {dispatch} = this.props;
                                dispatch({
                                    type: 'service/doTrain',
                                    payload: this.state.train.doTrain,
                                    callback: (v) => {
                                        if (v["res"] === "ok") {
                                            message.success("成功加入训练队列");
                                            this.setState({
                                                ...this.state,
                                                rightVisible: false,
                                                leftVisible: false,
                                            });
                                        }
                                        else {
                                            message.error("加入训练队列失败");
                                        }
                                    },
                                });
                            }}>
                                提交
                            </Button>
                        </div>
                    </Drawer>

                    <div className="content padding">{content}</div>
                    <div className="content padding">{extraContent}</div>
                </div>
            </PageHeader>

        );
    }
}
// 1. Initialize
const app = dva();
console.log(2);
// 2. Model
// app.model(require('./src/models/service').default);
app.model({
    namespace: 'service',
    state: {
        res: {
            code: undefined,
            status: undefined,
            msg: '',
            data: [],
        },
        trains: {
            num: 0,
            page: 0,
            list: [],
        },
        modelList: {
            res: '',
            weights_list: [],
            width: undefined,
            height: undefined,
            max_batches: undefined,
        },
        dotrain:{},
        testRes: {
            res: '',
        },
        allres: {
            res: '',
        }
    },
    effects: {
        *getList({ payload,callback}, { call, put }) {
            const response = yield call(getList,payload);
            yield put({
                type: 'trains',
                payload: response,
            });
            if (callback)callback(response);
        },
        *getModelList({ payload,callback}, { call, put }) {
            const response = yield call(getModelList,payload);
            yield put({
                type: 'modelList',
                payload: response,
            });
            if (callback)callback(response);
        },
        *doTrain({ payload,callback}, { call, put }) {
            const response = yield call(doTrain,payload);
            yield put({
                type: 'dotrain',
                payload: response,
            });
            if (callback)callback(response);
        },
        *startTest({ payload,callback}, { call, put }) {
            const response = yield call(startTest,payload);
            yield put({
                type: 'testRes',
                payload: response,
            });
            if (callback)callback(response);
        },
        *stopTrain({ payload,callback}, { call, put }) {
            const response = yield call(stopTrain,payload);
            yield put({
                type: 'allres',
                payload: response,
            });
            if (callback)callback(response);
        },
        *continueTrainTrain({ payload,callback}, { call, put }) {
            const response = yield call(continueTrainTrain,payload);
            yield put({
                type: 'allres',
                payload: response,
            });
            if (callback)callback(response);
        }
    },
    reducers: {
        res(state, action) {
            return {
                ...state,
                res: action.payload,
            };
        },
        trains(state, action) {
            return {
                ...state,
                trains: action.payload,
            };
        },
        modelList(state, action) {
            return {
                ...state,
                modelList: action.payload,
            };
        },
        dotrain(state, action) {
            return {
                ...state,
                dotrain: action.payload,
            };
        },
        testRes(state, action) {
            return {
                ...state,
                testRes: action.payload,
            };
        },
        allres(state, action) {
            return {
                ...state,
                allres: action.payload,
            };
        },
    },
});
// 3. View

const App = connect(({ service }) => ({
    service
}))(function(props) {
    const { dispatch } = props;
    return (
        <div>
            <FreeFish {...props}/>
        </div>
    );
});

// 4. Router
app.router(() => <App />);

// 5. Start
app.start('#root');



// ReactDOM.render(<App />, document.getElementById('root'));
