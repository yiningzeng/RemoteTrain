import React from 'react';
import ReactDOM from 'react-dom';
import Iframe from 'react-iframe';

import dva, { connect } from 'dva';
import {
    InputNumber,
    Tag,
    Row,
    Modal,
    Spin,
    Col,
    Table,
    message,
    PageHeader,
    Button,
    Typography,
    Drawer,
    Divider,
    Icon,
    Card,
    Select,
    Switch,
    Form,
    Input,
    DatePicker,
    notification,
    Radio,
    Badge,
    Popconfirm
} from 'antd';
// 由于 antd 组件的默认文案是英文，所以需要修改为中文
import zhCN from 'antd/lib/locale-provider/zh_CN';
import moment from 'moment';
import 'moment/locale/zh-cn';
import { getList, getModelList, getValPathList, getVocPathList, doTrain,
    startTest, stopTrain, continueTrainTrain, getLocalPathList, getModelListV2,
    getModelByProject, get_release_models_history, del_model, online_model, offline_model } from './services/api';
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const InputGroup = Input.Group;
moment.locale('zh-cn');
const { confirm } = Modal;

/**
 *
 */
class FreeFish extends React.Component {
    state = {
        showSettingsModal: false,
        imageLossTimer: "zengyining",
        test: {
            frontImage: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet-test:",
            baseImage: "latest",
            showTestDrawer: false,
            showTestDrawerUrl: "",
            showTestModal: false,
            showStandardValidationData: false,
            loading: false,
            tips: "载入可使用的权重文件... ",
            doTest: {
                providerType: "yolov4-tiny-3l",
                assetsDir: "", // nowAssetsDir
                weights: undefined,
                valPath: undefined,
                port: 8100,
                javaUrl: "ai.8101.api.qtingvision.com",
                javaPort: 888,
                image: "registry.cn-hangzhou.aliyuncs.com/baymin/darknet-test:latest",
                projectId: undefined,
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

        api: {
            url: localStorage.getItem("api.url") === null?"server.qtingvision.com":localStorage.getItem("api.url"),
            port: localStorage.getItem("api.port") === null?888:localStorage.getItem("api.port"),
        },
        train : {
            frontImage: "registry.cn-hangzhou.aliyuncs.com/qtingvision/auto-train:",
            baseImage: "latest",
            showAiPar: false,
            doTrain: {
                taskId: undefined, // 项目id
                taskName: undefined, // 训练任务名称
                projectName: undefined, // 项目名称
                assetsDir: undefined, // 素材文件夹，和packageDir相同
                assetsType: "powerAi", // 素材的类型，pascalVoc和coco和other
                providerType: "yolov4-tiny-3l", // 框架的类型yolov3 fasterRcnn maskRcnn
                image: "registry.cn-hangzhou.aliyuncs.com/qtingvision/auto-train:latest", // 镜像路径
                bacthSize: 64,
                imageWidth: 512,
                imageHeight: 512,
                maxIter: 2000000, // 训练最大轮数
                pretrainWeight: "", // 预训练权重文件
                gpus: "0,1", // 使用的gpu id
                trianType: 0,  // 0对应从头训练 1对应自训练 2 漏检训练
            },
        },
        continueTrain: {
            showModal: false,
            loading: false,
            frontImage: "registry.cn-hangzhou.aliyuncs.com/qtingvision/auto-train:",
            baseImage: "latest",
            width: undefined,
            height: undefined,
            max_batches: undefined,
            projectId: undefined, // 项目id
            assetsType: "powerAi", // 素材的类型，pascalVoc和coco和other
            projectName: undefined, // 项目名称
            providerType: "yolov4-tiny-3l", // 框架的类型yolov3 fasterRcnn maskRcnn
            image: "registry.cn-hangzhou.aliyuncs.com/qtingvision/auto-train:latest", // 镜像路径
            assetsDir: "", //nowAssetsDir
            weights: undefined,
        },
        modelManager: {
            nowEditProjectName: undefined,
            loadingModels: true,
            firstVisible: false,
            secondVisible: false,
            secondReleaseManagerVisible: false,
        },
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
            service: {trains: {list}, modelList, modelListV2, valPathList, vocPathList, localPathList, modelByProject, get_release_models_history_res}
        } = this.props;
        const columns = [{
            title: '任务标识',
            dataIndex: 'task_id',
        }, {
            title: '训练任务名称',
            dataIndex: 'task_name',
        }, {
            title: '对应项目名称',
            dataIndex: 'project_name',
        }, {
            title: '网络框架',
            dataIndex: 'net_framework',
        }, {
            title: '数据类型',
            dataIndex: 'assets_type',
        }, {
            title: '创建时间',
            dataIndex: 'create_time',
        }, {
            title: '状态',
            dataIndex: 'status',
            render: v => {
                if (v === 0) return <Tag color="#FFA500">准备完成</Tag>;
                else if (v === 1) return <Tag color="#8A2BE2">等待训练</Tag>;
                else if (v === 2) return <Button type="primary" loading>正在训练</Button>;
                else if (v === 3) return <Tag color="#D3D3D3">暂停训练</Tag>;
                else if (v === 4) return <div><Tag color="#008000">训练完成</Tag><Icon type="smile" theme="twoTone"/></div>;
                else if (v === -1) return <Tag color="#FF0000">训练出错</Tag>;
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

        return (
            <PageHeader backIcon={false}
                title="训练中心"
                subTitle="管理后台"
                tags={<Tag color="green">在线</Tag>}
                extra={[
                    <span>{`页面刷新时间:`}</span>,
                    <Text mark>{`${this.state.refreshTime}`}</Text>,
                    <span>刷新间隔(秒):</span>,
                    <Select defaultValue={`${this.state.refreshInterval / 1000}s`} style={{width: 120}}
                            onChange={(v) => {
                                localStorage.setItem("refreshInterval", v);
                                location.reload();
                            }}>
                        <Option value="5000">5s</Option>
                        <Option value="10000">10s</Option>
                        <Option value="30000">30s</Option>
                        <Option value="60000">60s</Option>
                        <Option value="6000000">6000s</Option>
                    </Select>,
                    <Button key="1" type="primary" onClick={() => {
                        this.setState({
                            ...this.state,
                            modelManager: {
                                ...this.state.modelManager,
                                firstVisible: true
                            },
                        }, () => {
                            // 首先加载相应的数据
                            const {dispatch} = this.props;
                            dispatch({
                                type: 'service/getLocalPathList',
                                callback: (aa) => {

                                }
                            });
                        });
                    }}>
                        模型管理
                    </Button>,
                    <Button.Group style={{marginLeft: 7}}>
                        <Button key="1" type="primary" onClick={() => {
                            // 首先加载相应的数据
                            const {dispatch} = this.props;
                            dispatch({
                                type: 'service/getLocalPathList',
                                callback: (aa) => {
                                    this.setState({
                                        rightVisible: true,
                                        leftVisible: true,
                                        train: {
                                            ...this.state.train,
                                            doTrain: {
                                                ...this.state.train.doTrain,
                                                projectName: aa.path_list.length > 0 ? aa.path_list[0].dir_name : undefined,
                                                taskId: `${moment().format('x')}`
                                            }
                                        }
                                    });
                                }
                            });
                        }}>
                            新增训练任务
                        </Button>
                        <Button type="primary" onClick={() => this.setState({
                            ...this.state,
                            showSettingsModal: true,
                        })}>
                            <Icon type="setting"/>
                        </Button>
                    </Button.Group>,
                ]}
                footer={
                    <Table size={"small"} columns={columns} dataSource={list}
                           onChange={this.handleTableChange}
                           expandedRowRender={record => {
                               return (
                                   <Row style={{marginLeft: 50}}>
                                       <Row>
                                           {/*<Switch style={{marginTop: -3}} checkedChildren="插队开" unCheckedChildren="插队关"*/}
                                           {/*        disabled={record.is_jump === 1} defaultChecked={record.is_jump === 1}*/}
                                           {/*        onChange={(c) => {*/}
                                           {/*            message.success(`待完善， ${c}`)*/}
                                           {/*        }}/>*/}
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
                                                               taskId: record.project_id,
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
                                                                               pagination: {
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
                                                   onCancel() {
                                                   },
                                               });
                                           }}>停止训练</Button>
                                           {/*<Button type="primary" size="small" style={{marginLeft: 10}}*/}
                                           {/*        disabled={record.status === 2} onClick={() => {*/}
                                           {/*    this.setState(*/}
                                           {/*        {*/}
                                           {/*            ...this.state,*/}
                                           {/*            continueTrain: {*/}
                                           {/*                ...this.state.continueTrain,*/}
                                           {/*                loading: true,*/}
                                           {/*                showModal: true,*/}
                                           {/*            }*/}
                                           {/*        },*/}
                                           {/*        () => {*/}
                                           {/*            const {dispatch} = this.props;*/}
                                           {/*            dispatch({*/}
                                           {/*                type: 'service/getModelList',*/}
                                           {/*                payload: {*/}
                                           {/*                    type: record.net_framework,*/}
                                           {/*                    path: encodeURI(record.assets_directory_name)*/}
                                           {/*                },*/}
                                           {/*                callback: (v) => {*/}
                                           {/*                    dispatch({*/}
                                           {/*                        type: 'service/getVocPathList',*/}
                                           {/*                        callback: (aa) => {*/}
                                           {/*                            message.info(JSON.stringify(aa));*/}
                                           {/*                        }*/}
                                           {/*                    });*/}
                                           {/*                    let fImage = "";*/}
                                           {/*                    let bImage = "latest";*/}
                                           {/*                    // let port = 8100;*/}
                                           {/*                    // let javaUrl = "";*/}
                                           {/*                    // let javaPort = 888;*/}
                                           {/*                    if (record.net_framework === "yolov3") {*/}
                                           {/*                        // port = 8100;*/}
                                           {/*                        fImage = "registry.cn-hangzhou.aliyuncs.com/qtingvision/auto-train:";*/}
                                           {/*                        // javaUrl = "ai.8101.api.qtingvision.com";*/}
                                           {/*                    } else if (record.net_framework === "fasterRcnn" || record.net_framework === "maskRcnn") {*/}
                                           {/*                        // port = 8200;*/}
                                           {/*                        fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/detectron:";*/}
                                           {/*                        // javaUrl = "ai.8101.api.qtingvision.com";*/}
                                           {/*                    } else if (record.net_framework === "fasterRcnn2" || record.net_framework === "maskRcnn2") {*/}
                                           {/*                        // port = 8300;*/}
                                           {/*                        fImage = "registry.cn-hangzhou.aliyuncs.com/pytorch-powerai/detectron2:";*/}
                                           {/*                        // javaUrl = "ai.8101.api.qtingvision.com";*/}
                                           {/*                    } else if (record.net_framework === "other") {*/}
                                           {/*                        // port = 8400;*/}
                                           {/*                        fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:";*/}
                                           {/*                        // javaUrl = "ai.8401.api.qtingvision.com";*/}
                                           {/*                    }*/}

                                           {/*                    this.setState({*/}
                                           {/*                        ...this.state,*/}
                                           {/*                        continueTrain: {*/}
                                           {/*                            ...this.state.continueTrain,*/}
                                           {/*                            loading: false,*/}
                                           {/*                            frontImage: fImage,*/}
                                           {/*                            baseImage: bImage,*/}
                                           {/*                            showModal: true,*/}
                                           {/*                            assetsType: record.assets_type, // 素材的类型，pascalVoc和coco和other*/}
                                           {/*                            projectName: record.project_name, // 项目名称*/}
                                           {/*                            projectId: record.project_id,*/}
                                           {/*                            providerType: record.net_framework,*/}
                                           {/*                            assetsDir: record.assets_directory_name, //nowAssetsDir*/}
                                           {/*                            image: `${fImage}${bImage}`,*/}
                                           {/*                        }*/}
                                           {/*                    });*/}
                                           {/*                },*/}
                                           {/*            });*/}
                                           {/*        });*/}
                                           {/*}}>继续训练</Button>*/}
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
                                                               } else if (record.net_framework === "fasterRcnn" || record.net_framework === "maskRcnn") {
                                                                   Modal.warning({
                                                                       title: '此框架已经弃用',
                                                                       content: '已弃用，暂时不提供测试接口',
                                                                   });
                                                                   return;
                                                               } else if (record.net_framework === "fasterRcnn2") {
                                                                   port = 8200;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/pytorch-powerai/detectron2-test:";
                                                                   javaUrl = "ai.8201.api.qtingvision.com";
                                                               } else if (record.net_framework === "maskRcnn2") {
                                                                   port = 8200;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/pytorch-powerai/detectron2-test:";
                                                                   javaUrl = "ai.8201.api.qtingvision.com";
                                                               } else if (record.net_framework === "other") {
                                                                   port = 8400;
                                                                   fImage = "registry.cn-hangzhou.aliyuncs.com/baymin/ai-power:";
                                                                   javaUrl = "ai.8401.api.qtingvision.com";
                                                               }

                                                               dispatch({
                                                                   type: 'service/getValPathList',
                                                                   callback: (aa) => {

                                                                   }
                                                               });

                                                               this.setState({
                                                                   ...this.state,
                                                                   test: {
                                                                       ...this.state.test,
                                                                       loading: false,
                                                                       frontImage: fImage,
                                                                       baseImage: bImage,
                                                                       showTestModal: true,
                                                                       showStandardValidationData: false,
                                                                       doTest: {
                                                                           ...this.state.test.doTest,
                                                                           port: port,
                                                                           javaUrl: javaUrl,
                                                                           javaPort: javaPort,
                                                                           providerType: record.net_framework,
                                                                           assetsDir: record.assets_directory_name, //nowAssetsDir
                                                                           image: `${fImage}${bImage}`,
                                                                           projectId: record.project_id,
                                                                       }
                                                                   }
                                                               });
                                                           },
                                                       });
                                                   });
                                           }}>打开测试端口</Button>
                                           <Button type="primary" size="small" style={{marginLeft: 10}} onClick={() => {
                                               this.setState({
                                                   ...this.state,
                                                   imageLossTimer: moment().valueOf(),
                                               })
                                           }}>刷新Loss</Button>
                                           {/*<Button type="primary" size="small" style={{marginLeft: 10}}>日志</Button>*/}
                                       </Row>
                                       <Row>
                                           <Divider/>
                                       </Row>
                                       <Row>
                                           <Col span={12} offset={4}>
                                               <img
                                                   width="100%"
                                                   height={600}
                                                   src={record.draw_url + "?id=" + moment().valueOf() + this.state.imageLossTimer}
                                               />
                                           </Col>
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
                        title="设置"
                        okText="保存"
                        cancelText="取消"
                        destroyOnClose
                        visible={this.state.showSettingsModal}
                        onOk={() => {
                            localStorage.setItem("api.url", this.state.api.url);
                            localStorage.setItem("api.port", this.state.api.port);
                            message.success("保存成功");
                            location.reload();
                        }}
                        onCancel={() => {
                            this.setState({
                                ...this.state,
                                showSettingsModal: false,
                            });
                        }}
                    >
                        接口地址:
                        <InputGroup style={{marginTop: "10px", marginBottom: "20px"}} compact>
                            <Input style={{width: '70%'}} addonBefore="http://" value={this.state.api.url}
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
                            <Input style={{width: '15%', textAlign: 'center', borderLeft: 0}}
                                   value={this.state.api.port} onChange={(e) => {
                                this.setState({
                                    ...this.state,
                                    api: {
                                        ...this.state.api,
                                        port: e.target.value,
                                    }
                                });
                            }} defaultValue={this.state.apiPort} placeholder="port"/>
                        </InputGroup>
                    </Modal>
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
                                                            pagination: {
                                                                ...this.state.pagination,
                                                                total: v["total"],
                                                                pageSize: v["num"],
                                                            }
                                                        });
                                                    },
                                                });
                                            }
                                        }
                                    });
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
                            this.state.continueTrain.providerType === "yolov3" &&
                            <Spin spinning={this.state.continueTrain.loading} tip={"正在加载权重文件"} delay={500}>
                                图像宽:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={modelList.width}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 continueTrain: {
                                                     ...this.state.continueTrain,
                                                     width: value,
                                                 }
                                             })}/>
                                图像高:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={modelList.height}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 continueTrain: {
                                                     ...this.state.continueTrain,
                                                     height: value,
                                                 }
                                             })}/>
                                训练最大轮数:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={modelList.max_batches}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 continueTrain: {
                                                     ...this.state.continueTrain,
                                                     max_batches: value,
                                                 }
                                             })}/>
                                选择加载的权重文件(如果是梯度爆炸就选择前几个保留的文件):
                                <Select
                                    style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                    onChange={(v) => {
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
                                选择加载的数据集:<Select
                                style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                onChange={(v) => {
                                    this.setState({
                                        ...this.state,
                                        test: {
                                            ...this.state.test,
                                            doTest: {
                                                ...this.state.test.doTest,
                                                valPath: v
                                            }
                                        }
                                    });
                                }}>
                                {vocPathList.voc_path_list.map(d => (
                                    <Option key={d.path}>{d.dir_name}</Option>
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
                            (this.state.continueTrain.providerType === "fasterRcnn" || this.state.continueTrain.providerType === "maskRcnn" ||
                                this.state.continueTrain.providerType === "fasterRcnn2" || this.state.continueTrain.providerType === "maskRcnn2") &&
                            <Spin spinning={this.state.continueTrain.loading} tip={"正在加载权重文件"} delay={500}>
                                训练最大轮数:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={modelList.max_batches}
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
                                    onChange={(v) => {
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
                                                    showTestDrawerUrl: `/test?projectId=${this.state.test.doTest.projectId}&javaUrl=${this.state.test.doTest.javaUrl}&javaPort=${this.state.test.doTest.javaPort}&providerType=${this.state.test.doTest.providerType}&port=${this.state.test.doTest.port}&assets=${this.state.test.doTest.assetsDir}`,
                                                }
                                            });

                                            // const tempwindow=window.open();
                                            // tempwindow.location=`/test?port=8100&assets=${this.state.test.nowAssetsDir}`;
                                            // window.open(`/test?port=8100&assets=${this.state.test.nowAssetsDir}`, "_blank");
                                            // window.open(`/test?port=8100&assets=${this.state.test.nowAssetsDir}`, "_blank", "scrollbars=yes,resizable=1,modal=false,alwaysRaised=yes");
                                        }
                                    });
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
                            <Input style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                   placeholder="Basic usage" disabled value={this.state.test.doTest.providerType}/>
                            服务端口:
                            <Input style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                   placeholder="Basic usage" disabled value={this.state.test.doTest.port}/>
                            选择加载的权重文件:
                            <Select
                                style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                onChange={(v) => {
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
                            标准验证集:&nbsp;&nbsp;
                            <Switch checkedChildren="使用" unCheckedChildren="不使用"
                                    onChange={(c) => {
                                        this.setState({
                                            ...this.state,
                                            test: {
                                                ...this.state.test,
                                                showStandardValidationData: c,
                                            }
                                        })
                                    }}/>
                            <br/>
                            {
                                this.state.test.showStandardValidationData && <div>选择加载的标准验证集目录:<Select
                                    style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                    onChange={(v) => {
                                        this.setState({
                                            ...this.state,
                                            test: {
                                                ...this.state.test,
                                                doTest: {
                                                    ...this.state.test.doTest,
                                                    valPath: v
                                                }
                                            }
                                        });
                                    }}>
                                    {valPathList.val_path_list.map(d => (
                                        <Option key={d.path}>{d.dir_name}</Option>
                                    ))}
                                </Select>
                                </div>
                            }
                        </Spin>
                    </Modal>

                    <Drawer
                        title="在线测试"
                        placement="left"
                        width="100%"
                        height="1500px"
                        closable={true}
                        onClose={() => {
                            this.setState({
                                ...this.state,
                                test: {
                                    ...this.state.test,
                                    showTestDrawer: false,
                                }
                            })
                        }}
                        visible={this.state.test.showTestDrawer}
                    >
                        <Iframe url={this.state.test.showTestDrawerUrl}
                                width="100%"
                                height="850px"
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
                        title="新增训练任务"
                        placement="right"
                        width="40%"
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
                        训练任务名称:
                        <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="训练任务名称"
                               allowClear onChange={(e) => this.setState({
                            train: {
                                ...this.state.train,
                                doTrain: {
                                    ...this.state.train.doTrain,
                                    taskName: e.target.value
                                }
                            }
                        })}/>
                        所属项目:
                        <Select style={{marginTop: "10px", marginBottom: "20px", width: "100%"}}
                                defaultValue={localPathList === undefined ? "" : localPathList.path_list.length > 0 ? localPathList.path_list[0].dir_name : ""}
                                onChange={(value) => this.setState({
                                    train: {
                                        ...this.state.train,
                                        doTrain: {
                                            ...this.state.train.doTrain,
                                            projectName: value
                                        }
                                    }
                                })}>
                            {
                                // 这里循环
                                localPathList.path_list.map(d => (
                                    <Option key={d.dir_name}>{d.dir_name}</Option>
                                ))
                            }
                        </Select>
                        数据格式:
                        <Select style={{marginTop: "10px", marginBottom: "20px", width: "100%"}}
                                defaultValue="powerAi"
                                onChange={(value) => this.setState({
                                    train: {
                                        ...this.state.train,
                                        doTrain: {
                                            ...this.state.train.doTrain,
                                            assetsType: value
                                        }
                                    }
                                })}>
                            <Option value="powerAi">powerAi</Option>
                            <Option value="pascalVOC">pascalVOC</Option>
                            <Option value="coco">coco</Option>
                            <Option value="other">other</Option>
                        </Select>
                        使用的框架:
                        <Select style={{marginTop: "10px", marginBottom: "20px", width: "100%"}}
                                defaultValue="[darknet] yolov4-tiny-3l"
                                onChange={(value) => {
                                    console.log("providerType" + value);
                                    let fImage = "";
                                    let bImage = "latest";
                                    if (value === "yolov4-tiny-3l.cfg") {
                                        fImage = "registry.cn-hangzhou.aliyuncs.com/qtingvision/auto-train:";
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
                            <Option value="yolov4-tiny-3l.cfg">[darknet] yolov4-tiny-3l</Option>
                        </Select>
                        镜像地址:
                        <InputGroup compact>
                            <Input style={{marginTop: "10px", marginBottom: "20px"}} placeholder="镜像版本"
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
                        AI参数(选填)-专业人员操作:&nbsp;&nbsp;
                        <Switch checkedChildren="已打开调参" unCheckedChildren="已关闭调参"
                                onChange={(c) => {
                                    const {dispatch} = this.props;
                                    dispatch({
                                        type: 'service/getModelListV2',
                                        payload: {
                                            framework_type: this.state.train.doTrain.providerType,
                                            project_name: encodeURI(this.state.train.doTrain.projectName)
                                        },
                                    });
                                    this.setState({
                                        ...this.state,
                                        train: {
                                            ...this.state.train,
                                            showAiPar: c,
                                        }
                                    })
                                }}/>
                        {
                            this.state.train.showAiPar && <div>
                                每次训练所选取的样本数:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={this.state.train.doTrain.bacthSize}
                                             onChange={(value) => {
                                                 this.setState({
                                                     ...this.state,
                                                     train: {
                                                         ...this.state.train,
                                                         doTrain: {
                                                             ...this.state.train.doTrain,
                                                             bacthSize: value,
                                                         },
                                                     }
                                                 }, () => {
                                                     console.log(`ducker do train: callback ${this.state.train.doTrain.bacthSize}`);
                                                 })
                                             }}/>
                                图像宽:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={this.state.train.doTrain.imageWidth}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 train: {
                                                     ...this.state.train,
                                                     doTrain: {
                                                         ...this.state.train.doTrain,
                                                         imageWidth: value,
                                                     },
                                                 }
                                             })}/>
                                图像高:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={this.state.train.doTrain.imageHeight}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 train: {
                                                     ...this.state.train,
                                                     doTrain: {
                                                         ...this.state.train.doTrain,
                                                         imageHeight: value,
                                                     },
                                                 }
                                             })}/>
                                训练最大轮数:
                                <InputNumber style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                             placeholder={this.state.train.doTrain.maxIter}
                                             onChange={(value) => this.setState({
                                                 ...this.state,
                                                 train: {
                                                     ...this.state.train,
                                                     doTrain: {
                                                         ...this.state.train.doTrain,
                                                         maxIter: value,
                                                     },
                                                 }
                                             })}/>
                                使用的GPU:
                                <Input style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                       placeholder={this.state.train.doTrain.gpus}
                                       onChange={(e) => this.setState({
                                           ...this.state,
                                           train: {
                                               ...this.state.train,
                                               doTrain: {
                                                   ...this.state.train.doTrain,
                                                   gpus: e.target.value,
                                               },
                                           }
                                       })}/>
                                训练类型:&nbsp;&nbsp;
                                <Radio.Group defaultValue={this.state.train.doTrain.trianType}
                                             onChange={(e) => this.setState({
                                                 ...this.state,
                                                 train: {
                                                     ...this.state.train,
                                                     doTrain: {
                                                         ...this.state.train.doTrain,
                                                         trianType: e.target.value,
                                                     },
                                                 }
                                             })}>
                                    <Radio value={0}>从头训练</Radio>
                                    <Radio value={1}>对应自训练</Radio>
                                    <Radio value={2}>漏检训练</Radio>
                                </Radio.Group>
                                <br/>
                                选择加载的预训练权重文件:
                                <Select
                                    style={{width: '100%', marginTop: "10px", marginBottom: "10px"}}
                                    placeholder={"不选择的话默认使用初始的预训练文件"}
                                    onChange={(value) => {
                                        this.setState({
                                            ...this.state,
                                            train: {
                                                ...this.state.train,
                                                doTrain: {
                                                    ...this.state.train.doTrain,
                                                    pretrainweight: value,
                                                },
                                            }
                                        });
                                    }}>
                                    {modelListV2.model_list.map(d => (
                                        <Option key={d.filename}>{d.filename}</Option>
                                    ))}
                                </Select>
                                <br/>
                                <br/>
                                <br/>
                            </div>
                        }
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
                                关闭
                            </Button>
                            <Button type="primary" onClick={() => {
                                if (!this.state.train.doTrain.projectName) {
                                    notification.error({
                                        message: "不存在项目",
                                        description: "当前未找到相关的项目，请返回首页新建项目再进行训练任务",
                                    });
                                    return;
                                }
                                if (this.state.train.doTrain.taskName) {
                                    console.log(`ducker do train: ${JSON.stringify(this.state.train.doTrain)}`);
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
                                            } else {
                                                message.error("加入训练队列失败");
                                            }
                                        },
                                    });
                                } else {
                                    notification.error({
                                        message: "参数有误",
                                        description: "有部分参数未输入！请输完后重试",
                                    });
                                }
                            }}>
                                新增任务
                            </Button>
                        </div>
                    </Drawer>

                    <Drawer
                        title="项目列表"
                        width="50%"
                        maskClosable={true}
                        onClose={() => {
                            this.setState({
                                ...this.state,
                                modelManager: {
                                    ...this.state.modelManager,
                                    firstVisible: false
                                },
                            });
                        }}
                        visible={this.state.modelManager.firstVisible}
                    >
                        <Table columns={[
                            {
                                title: '项目名',
                                key: "project_name",
                                dataIndex: 'dir_name',
                                render: text => <Badge status="processing" text={text}/>,
                            },
                            {
                                title: '操作',
                                dataIndex: 'dir_name',
                                render: text => (
                                    <span>
                                    <a onClick={() => {
                                        this.setState({
                                            ...this.state,
                                            modelManager: {
                                                ...this.state.modelManager,
                                                secondVisible: true,
                                                nowEditProjectName: text,
                                            },
                                        }, () => {
                                            const {dispatch} = this.props;
                                            dispatch({
                                                type: 'service/getModelByProject',
                                                payload: {
                                                    project_name: encodeURI(text)
                                                },
                                                callback: (aa) => {
                                                    this.setState({
                                                        ...this.state,
                                                        modelManager: {
                                                            ...this.state.modelManager,
                                                            loadingModels: false,
                                                        },
                                                    });
                                                }
                                            });
                                        });
                                    }}>查看模型</a>
                                        <Divider type="vertical"/>
                                           <a onClick={() => {
                                               this.setState({
                                                   ...this.state,
                                                   modelManager: {
                                                       ...this.state.modelManager,
                                                       secondReleaseManagerVisible: true,
                                                       loadingModels: true,
                                                       nowEditProjectName: text,
                                                   },
                                               }, () => {
                                                   const {dispatch} = this.props;
                                                   dispatch({
                                                       type: 'service/getReleaseModelsHistory',
                                                       payload: {
                                                           project_name: encodeURI(text)
                                                       },
                                                       callback: (aa) => {
                                                           this.setState({
                                                               ...this.state,
                                                               modelManager: {
                                                                   ...this.state.modelManager,
                                                                   loadingModels: false,
                                                               },
                                                           });
                                                       }
                                                   });
                                               });
                                           }}>发布管理</a>
                                    </span>
                                ),
                            }]} dataSource={localPathList.path_list}/>
                        <Drawer
                            title={`${this.state.modelManager.nowEditProjectName}-模型列表`}
                            width="50%"
                            maskClosable={true}
                            onClose={() => {
                                this.setState({
                                    ...this.state,
                                    modelManager: {
                                        ...this.state.modelManager,
                                        secondVisible: false
                                    },
                                });
                            }}
                            visible={this.state.modelManager.secondVisible}
                        >
                            <Spin tip="正在加载项目..." spinning={this.state.modelManager.loadingModels}>
                                {/*<Badge status="processing" text="Running" />*/}
                                <Table columns={[
                                    {
                                        title: '模型名称',
                                        key: "name",
                                        dataIndex: 'name',
                                    }, {
                                        title: '发布状态',
                                        key: "status",
                                        dataIndex: 'status',
                                        render: v => {
                                            if (v === 1) return <Badge status="warning" text="已发布"/>;
                                            else if (v === 2) return <Badge status="processing" text="已发布(线上更新版本)"/>;
                                        },
                                    }, {
                                        title: '操作',
                                        render: (text, record) => (
                                            <span>
                                                {
                                                    record.status === 0 &&  <Popconfirm
                                                        title="发布会把最新的模型替换为当前发布的模型，如需更换可到发布管理里面选择？"
                                                        onConfirm={() => {
                                                            const {dispatch} = this.props;
                                                            dispatch({
                                                                type: 'service/onlineModel',
                                                                payload: {
                                                                    p: encodeURI(record.path)
                                                                },
                                                                callback: (aa) => {
                                                                    const {dispatch} = this.props;
                                                                    dispatch({
                                                                        type: 'service/getModelByProject',
                                                                        payload: {
                                                                            project_name: this.state.modelManager.nowEditProjectName
                                                                        },
                                                                    });
                                                                }
                                                            });
                                                            notification.success({
                                                                message: "提醒",
                                                                description: "已经发布成功，线上的AOI软件可以通过更新直接获取当前模型",
                                                            });
                                                        }}
                                                        okText="确定"
                                                        cancelText="取消"
                                                    >
                                                        <a>发布</a>
                                                    </Popconfirm>
                                                }
                                                {
                                                    record.status === 0 && <Divider type="vertical"/>
                                                }
                                                {
                                                    record.status !== 2 && <Popconfirm
                                                        title="确定要删除么？"
                                                        onConfirm={() => {
                                                            const {dispatch} = this.props;
                                                            dispatch({
                                                                type: 'service/delModel',
                                                                payload: {
                                                                    p: encodeURI(record.path)
                                                                },
                                                                callback: (aa) => {
                                                                    const {dispatch} = this.props;
                                                                    dispatch({
                                                                        type: 'service/getModelByProject',
                                                                        payload: {
                                                                            project_name: this.state.modelManager.nowEditProjectName
                                                                        },
                                                                    });
                                                                    notification.success({
                                                                        message: "恭喜",
                                                                        description: "删除成功",
                                                                    });
                                                                }
                                                            });


                                                        }}
                                                        okText="确定"
                                                        cancelText="取消"
                                                    >
                                                        <a>删除</a>
                                                    </Popconfirm>
                                                }


                                            </span>),
                                    }]} dataSource={modelByProject.models}/>
                            </Spin>
                        </Drawer>

                        <Drawer
                            title={`${this.state.modelManager.nowEditProjectName}-发布历史`}
                            width="50%"
                            maskClosable={true}
                            onClose={() => {
                                this.setState({
                                    ...this.state,
                                    modelManager: {
                                        ...this.state.modelManager,
                                        secondReleaseManagerVisible: false
                                    },
                                });
                            }}
                            visible={this.state.modelManager.secondReleaseManagerVisible}
                        >
                            <Spin tip="正在加载项目..." spinning={this.state.modelManager.loadingModels}>
                                {/*<Badge status="processing" text="Running" />*/}
                                <Table columns={[
                                    {
                                        title: '模型名称',
                                        key: "name",
                                        dataIndex: 'name',
                                    }, {
                                        title: '上线状态',
                                        key: "status",
                                        dataIndex: 'status',
                                        render: v => {
                                            if (v === 1) return <Badge status="processing" text="线上更新版本"/>;
                                        },
                                    }, {
                                        title: '操作',
                                        render: (text, record) => (
                                            <span>
                                                {
                                                    record.status === 0 &&  <Popconfirm
                                                        title="上线会把最新的模型替换为当前的模型？"
                                                        onConfirm={() => {
                                                            const {dispatch} = this.props;
                                                            dispatch({
                                                                type: 'service/onlineModel',
                                                                payload: {
                                                                    p: encodeURI(record.path),
                                                                    is_history: 1,
                                                                },
                                                                callback: (aa) => {
                                                                    const {dispatch} = this.props;
                                                                    dispatch({
                                                                        type: 'service/getReleaseModelsHistory',
                                                                        payload: {
                                                                            project_name: this.state.modelManager.nowEditProjectName
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                            notification.success({
                                                                message: "提醒",
                                                                description: "已经上线成功，线上的AOI软件可以通过更新直接获取当前模型",
                                                            });
                                                        }}
                                                        okText="确定"
                                                        cancelText="取消"
                                                    >
                                                        <a>上线</a>
                                                    </Popconfirm>
                                                }
                                            </span>),
                                    }]} dataSource={get_release_models_history_res.models}/>
                            </Spin>
                        </Drawer>
                    </Drawer>
                    {/*<div className="content padding">{content}</div>*/}
                    {/*<div className="content padding">{extraContent}</div>*/}
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
        modelListV2: {
            res: '',
            model_list: [],
        },
        valPathList: {
            res: '',
            val_path_list: [],
        },
        vocPathList: {
            res: '',
            voc_path_list: [],
        },
        localPathList: {
            res: '',
            path_list: [],
        },
        modelByProject: {
            res: '',
            message: "",
            models: [],
        },
        dotrain:{},
        testRes: {
            res: '',
        },
        allres: {
            res: '',
        },
        get_release_models_history_res: {
            res: '',
            message: "",
            models: [],
        },
        del_model_res: {
            res: '',
            message: "",
        },
        online_model_res: {
            res: '',
            message: "",
        },
        offline_model_res: {
            res: '',
            message: "",
        },
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
        *getVocPathList({ payload,callback}, { call, put }) {
            const response = yield call(getVocPathList,payload);
            yield put({
                type: 'vocPathList',
                payload: response,
            });
            if (callback)callback(response);
        },
        *getValPathList({ payload,callback}, { call, put }) {
            const response = yield call(getValPathList,payload);
            yield put({
                type: 'valPathList',
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
        },
        // region 新增接口 自训练
        *getLocalPathList({ payload,callback}, { call, put }) {
            const response = yield call(getLocalPathList,payload);
            yield put({
                type: 'localPathList',
                payload: response,
            });
            if (callback)callback(response);
        },
        *getModelByProject({ payload,callback}, { call, put }) {
            const response = yield call(getModelByProject,payload);
            yield put({
                type: 'modelByProject',
                payload: response,
            });
            if (callback)callback(response);
        },
        *getModelListV2({ payload,callback}, { call, put }) {
            const response = yield call(getModelListV2,payload);
            yield put({
                type: 'modelListV2',
                payload: response,
            });
            if (callback)callback(response);
        },
        *getReleaseModelsHistory({ payload,callback}, { call, put }) {
            const response = yield call(get_release_models_history,payload);
            yield put({
                type: 'get_release_models_history_res',
                payload: response,
            });
            if (callback)callback(response);
        },
        *delModel({ payload,callback}, { call, put }) {
            const response = yield call(del_model,payload);
            yield put({
                type: 'del_model_res',
                payload: response,
            });
            if (callback)callback(response);
        },
        *onlineModel({ payload,callback}, { call, put }) {
            const response = yield call(online_model,payload);
            yield put({
                type: 'online_model_res',
                payload: response,
            });
            if (callback)callback(response);
        },
        *offlineModel({ payload,callback}, { call, put }) {
            const response = yield call(offline_model,payload);
            yield put({
                type: 'offline_model_res',
                payload: response,
            });
            if (callback)callback(response);
        },

        // endregion
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
        valPathList(state, action) {
            return {
                ...state,
                valPathList: action.payload,
            };
        },
        vocPathList(state, action) {
            return {
                ...state,
                vocPathList: action.payload,
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
        // region 新增接口 自训练
        localPathList(state, action) {
            return {
                ...state,
                localPathList: action.payload,
            };
        },
        modelByProject(state, action) {
            return {
                ...state,
                modelByProject: action.payload,
            };
        },
        modelListV2(state, action) {
            return {
                ...state,
                modelListV2: action.payload,
            };
        },
        get_release_models_history_res(state, action) {
            return {
                ...state,
                get_release_models_history_res: action.payload,
            };
        },
        del_model_res(state, action) {
            return {
                ...state,
                del_model_res: action.payload,
            };
        },
        online_model_res(state, action) {
            return {
                ...state,
                online_model_res: action.payload,
            };
        },
        offline_model_res(state, action) {
            return {
                ...state,
                offline_model_res: action.payload,
            };
        },
        // endregion
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
