import React from 'react';
import ReactDOM from 'react-dom';
import Iframe from 'react-iframe';
import { SettingOutlined, SmileTwoTone } from '@ant-design/icons';
import '@ant-design/compatible/assets/index.css';
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
    Select,
    Switch,
    Input,
    notification,
    Radio,
    Badge,
    Popconfirm,
    Image,
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
        lossImgPreviewVisible: false,
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
        pagination: {defaultPageSize:100, current:1},
        loading: false,
        leftVisible: false,
        rightVisible: false,
        doChangeAssetsDir: true,

        api: {
            url: localStorage.getItem("api.url") === null?"localhost":localStorage.getItem("api.url"),
            port: localStorage.getItem("api.port") === null?18888:localStorage.getItem("api.port"),
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
                page: 1,
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
                        current: 1,
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
                page: pager.current,
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
                else if (v === 4) return <div><Tag color="#008000">训练完成</Tag><SmileTwoTone /></div>;
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

        const expandedRowRender = (record) => {
            return <div>
                    <Row>
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
                        }}>打开测试</Button>
                        <Button type="primary" size="small" style={{marginLeft: 10}} onClick={() => {
                            this.setState({
                                ...this.state,
                                imageLossTimer: moment().valueOf(),
                            })
                        }}>刷新Loss</Button>
                        <Button type="primary" size="small" style={{marginLeft: 10}} onClick={() => {
                            this.setState({
                                ...this.state,
                                lossImgPreviewVisible: true,
                            })
                        }}>预览图表</Button>
                        {/*<Button type="primary" size="small" style={{marginLeft: 10}}>日志</Button>*/}
                    </Row>
                    <Row>
                        <Col span={12} offset={4}>
                            <Image
                                width="100%"
                                height={600}
                                src={record.draw_url + "?id=" + moment().valueOf() + this.state.imageLossTimer}
                                preview={{
                                    visible: this.state.lossImgPreviewVisible,
                                    onVisibleChange: (visible, prevVisible) => {
                                        this.setState({
                                            ...this.state,
                                            lossImgPreviewVisible: visible,
                                        })
                                    },
                                }}
                                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA+gAAAPoCAIAAADCwUOzAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFHGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDIwLTExLTAzVDE3OjQ0OjEzKzA4OjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMC0xMS0wM1QxNzo1NjoxMiswODowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyMC0xMS0wM1QxNzo1NjoxMiswODowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpjYzgzM2Q1My02OTI0LWNkNDgtODU3MC03ZGEyZDY4NDQ3MDciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6Y2M4MzNkNTMtNjkyNC1jZDQ4LTg1NzAtN2RhMmQ2ODQ0NzA3IiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6Y2M4MzNkNTMtNjkyNC1jZDQ4LTg1NzAtN2RhMmQ2ODQ0NzA3Ij4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpjYzgzM2Q1My02OTI0LWNkNDgtODU3MC03ZGEyZDY4NDQ3MDciIHN0RXZ0OndoZW49IjIwMjAtMTEtMDNUMTc6NDQ6MTMrMDg6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE5IChXaW5kb3dzKSIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz5dVwhgAACJDUlEQVR4nO3de1zUdd7//w/jMAzDYQA5iogKgkhiYmp5KA+Vull2mWu6rUZ1tWZlZgd3rVwjr/yqranrKTNX0i3L9UCbZlqi1mqumkc85xERUOR8HIaZ3x+fvebiJ/oCK4W3Pu5/7G2bmSfzniczw0v4zOetORslTbvmVWfOnBGCwrW3TPDtt9++yfeoUJByhCDlCEHKEYKUIwQpRwhSjhCkHCFIOULQoDU+bm7/978AAAAANE1rjIO70/l//wsAAABAa5yDu6Zpb7+d3NBLAAAAABqRRjq4AwAAAKiJwR0AAABQAIM7AAAAoAAGdwAAAEABDO4AAACAAtycjfK0i8nJyUlJSQ29ikYqJSWFcq6FcgSUI6AcAeUIKEdAOQLKEVCORNicqQEJm2YBAG4mdjEUgpQjBClHCFKOEKQcIcihMgAAAIACGNwBAAAABTC4AwAAAApgcAcAAAAUYGzoBdzKKioqCgoKAgICTCZTQ6/lSjk5OYcOHSotLU1MTAwPD2/o5aCBlZSUHDt2LDQ0tOaTIS8vz2Aw+Pn53eh7v+odXXVJAADczviN+w302WefDRky5Ouvv27ohVzFN99888ILL4wYMSI5Obmh14KGt3Hjxqeeeurdd991XZKbm/vUU089//zzRUVFN/Sur3VHtZcEAMBtjsH9Bvr+++/37Nmza9eu60o5HI4btJ6aBg8ePGLECJvNlpGRcRPuDo1cUFBQq1atYmJiXJfk5+dv3bp106ZNpaWlN/Sur3VHtZcEAMBtTqVDZRwOx5o1a1auXBkXF/fyyy/7+vpqmlZUVPTNN9+kpaXdcccdzz77rNFoPHr06Pr16y9cuDBo0KAePXpompabm/vtt99u27atU6dOPXv2nDVrVrNmzZ588slmzZrVjA8ePHjmzJkeHh5JSUmtWrXS7zQ3N3fSpElnzpx5+eWXH3jgAf3CvXv3rl+/vrCwcOjQoWfPnv3HP/5Rc0m6Xbt2paenV1VVff/998uWLevTp0+df/G32WyffPJJamqqr6/vK6+80rFjR/3yo0ePrlix4qeffmrVqlXfvn3vvffejRs3btq0yel0PvbYY127dtVv9sYbb+zdu/d//ud/zpw54+fn17dvX+G+LBaLv7+/pmkGw//vH29HjhyZOXNmbm7unXfeecUjOn369JIlSy5cuBAYGPjaa68FBga6rsrNzf3ggw/Onz/v7u7+2muvRUZGyo9U0zS73W6z2WpfbjAYTCbTFavCDXX06NHdu3dHR0cnJibql+Tm5q5fv76ystJut8+ZM6d///733nuvfpXD4Vi1atXChQs7der05ptv1n4ZXut19Je//OXQoUOdO3ceP3682WyW76j2knRXfX7WvvcLFy48+eST8kugJpvNZrfba19uNBob4XFuAIDbVuMd3M+ePev6/5GRkXa7fdiwYV999VVMTMyhQ4c+/fTTf/zjH+3bt8/Pz1+3bt3KlSubNm06ePDgkJCQw4cPf/LJJydOnLh48aJrcP/nP/+5du3aNWvWGAyGyMjI1atXp6SkbNu2rbS0VI97e3vPmDEjMDAwKyvr448/Xr9+fVxc3JYtW377299qmubt7f3www//4Q9/mDVrlsFg2Lt377Jlyy5cuLB27drS0tIWLVp8/fXXixcv/uqrr+Lj4/U1//jjj6dPn3Y4HIcOHfryyy/btGkjD+55eXkPP/zwvn37YmNjL1++nJqamp6erk/Ahw8fXr9+/Z49eywWi7u7e48ePb755puFCxeGhoa2bt1aH9xHjx69ZMkSX1/fnj17/td//dd///d//4zOP/jgg/HjxwcEBPj4+KSlpbkekcPheP/99xcuXBgWFpabm3v58uW//e1vCxYseOyxxzRN+/vf/z516lQfH5+CgoKSkpJPP/106tSpzz77rHxfCxYsWLlyZWVl5RWXx8bGjho1qlu3bj9j/fh5XC+Z3NxcfW7Ozc39/vvvbTabwWD45z//abVa9ctdL8OWLVtu3779888/X7duXXx8vOtleNXX0apVq0aPHm0wGLy9vdPS0nbv3v3Pf/5Tv+tr3VHtJWnXfn7WvvfCwsKVK1cmJSXNnTu3zn8EZmZmzpo16/vvv699Vc+ePV9++eXb5CD7mm+513UtQYIECRK8eUFhc6YGVHvTrHnz5nl6ej744IP5+flZWVmxsbGBgYHHjh1zOp2nTp0KDAy0Wq3Hjx93Op1VVVUzZ8709PT8zW9+o2erq6sPHDjg4+PTpEmTcePGXbp0qUePHm3btv3888+rq6tPnTrVtGnTJk2aDB8+/NKlS4888khsbOzMmTOzsrJatGjh4+Ozbdu24uLiJ554wt3dPSUlxel0VlZWjh8/3mQyWa3W7du3FxcXr1q1ymKxtG/fvri4WL/TysrK3//+956enq+99lppaWl1dbX8kE+cONGsWbPevXtfvnx5y5YtgYGBAQEBJ0+e1B9RVlZWq1atTCbTunXrnE7n3Llz/f39Dxw4UFlZ6XQ6R48ebbFYXn755UWLFvn5+TVr1iwzM7POkufPn1+zpcOHD1ut1mbNmp0+fTo/P3/NmjVeXl4JCQnFxcVVVVVxcXEhISEffvjhgQMHFi1aFB4ePmzYMD3Yu3dvPz+/9957b8+ePStWrGjZsqXrawrWrl370ksvPVfLe++9d+TIkTrj+BVd6yVjtVoDAwOPHj2qP82cTuecOXPMZvNDDz1UXFx86NAhb2/vli1b6s/5a72Oqqqqhg8fHh4evmjRoszMzFdeecXT03PQoEHyHdVekvD8vOLe8/PzL1261KlTJ09Pz5UrV9b58C9fvrxo0aLaT8Xnnntu0aJFly9f/jW7VhO7GApByhGClCMEKUcIUo4QbLy/ca+ppKRkyZIl3t7er732mp+fn81mi46ODg4OdjgcDofDbDbX/KWa0Wj08PCoGTcYDGaz2eFweHp6jh07NjAw8MMPP6yqqrrjjjv0q5xOp7u7+4QJEwIDA2fNmlVUVBQfH79y5crCwsKmTZu+9957BoMhOzvby8vr888/f+KJJ0wmk9FodDqdPXv2vOeeezRNu//++9u2bZuRkbF79+5evXppmmYymfQ/spvNZovFUudjbN269dq1ay9duvTEE0/s3LmzvLzcZDLl5eW1bt3aaDSGhoa++uqrL7/88vTp0++9994PPvhg4MCB7du31zQtNzf3xIkTHh4eLVu27Nev3+TJk6urq/ft29esWbPrKnnp0qWapj3++OMtW7bUNK1Pnz4xMTHnz5//8ccfe/bsOXjw4Pnz548fP17TtG7dus2ePVt/4Jqm/fa3vz148OC77777zjvvdOrU6Z133rnvvvvqvLv77rvvrrvuqn1Av4eHh7e393WtHL/QtV4y+v/x9fXVn8klJSUff/yxu7t7aWnpk08+abfbLRZLRUVFenr63Xfffa3XkdFo/Mtf/pKZmbl///6+ffvm5ORUV1dXVlaWlZVZLJar3tFVlyQ8P++7776a966fneall156+eWXFy9ePGjQIKNReqPz8/MbMmTIQw89VPsqT0/PmkeLAQDQsNQY3DVNs9vtFRUV+lHRJpNp5cqVmqbpP/Ltdrubm5vRaLzib+JXDIX6KKBPBnFxcbWv0r+a66hcd3f3qqqqioqKiooKfbyIj49/7LHH9CHAYDAYjcbg4GDXfV2+fLmsrMzLy+tnP8bTp08/+eSTRqPx1VdfnT17dlVVldVqdV37+OOPT5o06d///vff/va3jIyMTz75RL88MDDw2Wef3bJly4wZMwoLC7Ozs++///7777//eu/dYDDY7faysjLXIyouLq6srNSPOH/nnXceeughfQHbtm3buXPnlClT9ONhRo8e3b179wkTJmzbtm3fvn0vv/zyuHHj3nrrLfnu/vKXvyxfvrz2Ye6xsbGvvPLKgw8+eL3rx01gt9tdLwqHwxEREdGmTZt27drp1171daRpmp+f36hRo77++uv77ruvf//+Cxcu1DStPv+arUl4fta+d03TysrKKioq9HcG+SufPXt20qRJ1zpUJjk5ueZjAQCgAakxuBuNRqvVajQaXYdEG43GXbt2FRcX33///e7u7t7e3qWlpRUVFfq1Bw4csNlsTqfzl9ypt7e32WyOiIhYvny5PmTk5eVt2bIlJycnJCSk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wR0AAABQAIM7AAAAoAAGdwAAAEABDO4AAACAAtiAST1sTCCgHAHlCChHQDkCyhFQjoByBJQjEc7x3oA4974QpBwhSDlCkHKEIOUIQcoRgpQjBClHCFKOEKQcIcihMgAAAIACGNwBAAAABTC4AwAAAAow1v+mDocjLy9P07TAwMBr3aasrGzPnj2XL1/Wb19eXh4WFta7d+9fvlAAAADgdlbfwd1ut7/66quff/75d999Jwzuy5cvf+ONN0pKStzc3Kqrq51O58CBAxncAQAAgF+ovoP7a6+9NmfOHKvV6ubmJtwsLS1N07To6Giz2RwcHDxo0KCBAwf+CssEAAAAbm/1GtzXrVt34MCBpk2bVlVVCTez2WzZ2dndu3fv3r37sWPHbDZbfHx8aGjor7RUAAAA4PZVr8G9X79+iYmJd955p3yzsrKyc+fOlZaWHj582MfHp6CgYMWKFePHj3/77bd/+UIBAACA21l9d07Nysq68847Kysrd+3a1aZNm6ve5uzZs/369evbt+/EiRMtFktZWVmPHj2ys7M3btzYrVu361pWcnLyta5KSkpKSUn5GdfeMkFBY1sq5TSqoKCxLZVyGlVQ0NiWSjmNKihobEulnEYVFDS2pTZAOcLmTDVduHAhODjYarUeP378Wre5ePFiTk6O/plU3fTp061W68iRI+t5Ly5smiUEKUcIUo4QpBwhSDlCkHKEIOUIQcoRgpQjBClHCP6a53EPCgrKyck5cuSI65Ly8vLq6mqDgbPFAwAAAL/IdZzHvTa73b527dri4uKoqKi77757w4YNEydODAkJWbVqldls1jStrKzMYDBYrdZfabUAAADAbapeg3tOTk56errdbq+urk5PT/f29g4LC9M07ejRo7NmzaqqqgoODl68eHHPnj39/f2PHTu2adOm5s2b5+TkzJ8/32w2T5gw4QY/CgAAAOAWV6+DWGbOnPn000+Xl5fb7fbRo0dPnz79P2GDYciQIbm5ucOHDy8vL/f29l6/fv3QoUPHjBkzaNCgYcOGBQQEpKamhoSE3MiHAAAAANz66vUb9zFjxjz66KN2u13TNIPBEBERoV/erl27mJiYF1980WazmUwmTdOMRuOUKVOGDRuWlZXldDq7dOkSEBBw41YPAAAA3CbqNbiHh4eHh4dfPW80apqmT+0uCQkJCQkJv3xxAAAAAHSc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q98yJSXlly9PLdXV1c8995y3t3ezZs1++OGHX/3rFxYWDhs27JFHHrl06dKv/sWBW4zrHdjf3/+NN97QL7x06dIjjzwyfPjwwsLCG3rv17qjVatWtW/ffvTo0Tf03huW3rzVan322Wcbei34FdzMJ+3+/fu9vLxCQkJ8fHyee+650tLSm3CnN8fs2bNbtGjh5+f3xz/+8WfET5069eCDD44aNaq8vLzOG+/fv/+hhx7y9va+8847b/R7nbqu8rvVwYMHjxgxws3NLTExcevWrZs3b3744YcPHjz41FNPVVRU1PPfAw6H43qvEiK1bd26defOnfVZT/1vuWvXrr1793733Xf1X4bsuh5RAzIYDG+88UZERERBQUFOTo72a6+8tLQ0LS1t69at+p8+AAhc78AdOnR4/fXX9Qvz8/O3bt26adOm0tLSG3rv17qjoKCgVq1axcTE3NB7v3Hq856mN2+z2TIyMuoZQWN2g560tZ8Y33777d13392yZcutW7e2adNm1apVhYWFv+6dXuuub4KkpKRBgwZVVlbq48H1ysrK2rZt24YNG646hl3xiNq1a/fmm2+6ubmdP3/+Rr/XXcu///3vBrnf+rvKoTLu7u7p6enffPNNTEzMmDFjmjZt+vDDD2/ZsuXIkSPNmzdv167d119//de//vXEiROtW7eeMWPG2rVrIyIigoKC9HhBQcGbb7753nvveXt7t23b1s3NTb/c4XCkpqZ++OGHS5cuLS4ujo+Pb9KkieuqtLS0uXPnLlu2LDs7+84773RddS3/+Mc/9u3bN27cuFatWumX5Obmvv/++59++umGDRvi4+P9/Pyudcur2rt378cff3zy5Emn0+nh4WG1Wv39/V2PaMqUKbNnz968eXN0dLTrkQrkR7Rjx44333zz448/1jTtjjvucK1/xYoVM2bM+O6778rKysLDww8fPvzpp58uW7bMbre3bt26SZMmNptt9uzZEyZMKCgoSExM1L+mw+H497//nZOTk5GR0axZM1fh1/LDDz9MmjRp06ZN7dq1c7Xk7u6ekpKSl5f38MMPr127dubMmaWlpTW/R65FvvPOO7Nnz/7pp5+6du3qOqYoNzf3n//858KFCy9evOjj4zNp0qT9+/dHRUX5+PgUFRX985///Oc//1lVVaV3e61vxHfffTdv3rxt27a1aNHik08+ee+993Jzczt06KCvITMzc+XKlSkpKSUlJZqm/fnPf163bl1UVFTtb8exY8dGjBhx9OjRoKCgL7/8snnz5l5eXnV+y4BGouY78DPPPKNpWm5u7po1a77++mu73e7m5ubu7h4ZGanf2OFwrFy5cuzYsYcOHeratav+x+iioqK1a9fOmzfv3LlzLVq0+J//+Z/vv/++ZcuWrvc04YV81Ts6evTod999ZzQae/fu7bprTdOOHDny5ptvLlmy5NixYx07drzWvS9dutTX17d169b1efjy+4Bu48aNs2fP3r9/f7t27Tw9PWu+OcTFxbm5udlstpo/p6ZNm/bBBx8YjcbY2Fg3N7cdO3ZMnDgxLS2t5nugq/mNGze2bt06KCho0qRJu3btuvPOOy0Wi+s2ubm5r7/++vz584ODg6OiovQL9+7du2TJkrVr1wYEBOzYsWPKlCkGgyEmJqbOd2PcOLWftLV/Tv3jH/8ICQmJiIio59csKCh49913P/zwQ9dzSdO0gwcPvvPOO6dPnw4KCurZs2dCQkK3bt26deumP2M/+uijV199tWXLlocPH96xY0f79u2FZ4XwY85msy1dunTKlCmnT59OTEy84tDfsrKy999/f9q0adu3b09ISHAdGrRt27Z33303NTX1zJkzHh4eXl5e69at+/jjj7/++utmzZoFBwfX51F7eHhs3779hx9+SEhIqK6ufueddw4fPux6vetOnz799ttvz507Nycn55577qn5iD7//PPvvvuuurraaDR6enq6jiOy2Wwff/zxu+++e+bMGdcjMhgMFRUVH330kbu7+0MPPTR16tRrfY+2bds2ZsyYDRs2dOzYsearuKCgYPbs2Z9++unatWuvmBBsNltlZWVVLU6n0/X2kpmZ+fzzzyclJdWnmQZz1d/Dz58/39PT8ze/+Y3+n1lZWS1btgwICNiyZUtxcfHLL7/s6+sbFBQUFxeXmJjYunXrsLCwb7/91ul0HjhwICIiwt/fPzY21t3d/fHHH9dLKS0tHTp0aOvWrXv06NGxY0eLxdKzZ8/8/Hyn01lZWfnUU0+1adPmvvvuu/POO729vTt27Hj+/Hn5LwVjx44NCwu7cOGC/p/Lli2Lj4+/++6727Zt27x584CAgA8//PCqt7yWxYsXt2jRwmAw+Pn5Pfroo2lpafrlrkd0xx13RERE+Pj4LFy4UP5S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kZpvKQ6HY9++fWaz2d/f32g0pqenGwyGFi1aWK3WwsJC1zRiMBj0A2Bcw4DAarWaTKYHHnjg3Xff1S85duzY0aNH77jjjt27d+u/Kn3//fd37Njx+uuvf/XVV3/5y1/0f40/9dRTPXv2rP0F63nSkcbjKk+jgoKCrKwsh8NRWFhY++w/DocjMzOzsrLS4XBkZGS4etc0rXPnzg888MCpU6emTJly4sSJ+fPnP/TQQ5GRkZGRkWVlZQsWLFiwYMG5c+e8vLzuueee4OBg/aljt9sXLlw4d+7cI0eOaJp27733BgcHX+/74KpVq+bMmfPFF19cvHgxPj5e/2jRdX0Fi8UyfPjw8vLy9evX79+/f+7cuR9++KHrEb399tt79+5duXLlP/7xD39//+eee074UsIjunz5cllZmclkys7O/vLLL7Oystzc3MrLywsKClzxxMTEO+644+LFi/3793d9/jo0NPT1118vKCh4+eWXz5w589VXXz300EO5ubkdO3bMyMh4//33586d+/7772dlZQkLmzBhgoeHx/z58zdu3Lhnz54RI0b86U9/GjBggMlkunDhQllZmf7NLSkpKSsry8jIcDgclZWVmZmZ+jydmZnZpEkTk8m0c+fOL774QtM0Nze33NxcTdNsNpt+0I7dbs/IyND/gevSvXv3iIiI3Nzcr7/+esuWLW+++ebZs2ePHj06a9asDz744L333tP/9qJpmv4Z1s8+++yzzz47fvz4888/X1BQMGHChODg4NpLys3NvXz5ssPhyMnJ0Zdx+vTpM2fOdOrUafXq1R9//HGj2jIMqKervgP37dvXx8cnMzNz27Zt69evf+utt0pKSvSj7F577bXDhw/v2rXrt7/97YoVK/r06aO/Odvt9urq6vPnz9tsNtcXl1/IV72j3Nzc2kt64YUXrFbrihUrVq5cuXfv3okTJ54+ffqBBx5ITEx0vQm47l3+mXKFnJyc4uJih8ORlZVVUFBw1fcWs9k8c+ZMm802bty4ffv2bd26NTk5WdO06upq/c2h9s+poqIi/ary8vLs7Ozad+RagMFguHDhwp///OdDhw7NnDlz//797du379u3b9++fdu3b79///6FCxeeOHFi9uzZgwcPTkhICAkJyc3NzcnJ0TeacTWJhlX7WVf7uVT/b1zNYeDQoUOzZs3q16+f/pnvqz69HQ7Hrl27Tp8+PX369JUrV06ZMqWoqKjONdf5Y672i8vhcJw6dcrNzc3Hx+fAgQNz5szRNM3Dw6OwsFCP79y5s3379oGBgfv27XvyyScLCgp69ep1+PDhms/5OhkMhiZNmhw+fHj69OmHDx+eOHHi2bNnH3zwwcTExLKysosXLxqNRofDsW3btu+//17TNKfTqfdpMBgeeeQRo9H4008//fvf/169evWf//xnTdPee++9srKyP/zhD4cPH16/fv0DDzywa9eubt261ed7pE8yCxcu3LJlS3p6+jPPPPPWW2/pk8y33347b968Tz755OLFi9HR0XFxcS1atND/Be7t7d27d+9nr6Z3796uv8sVFBTok1ujVvvomaVLl+onPLnq+fYLCwuffPJJi8Xi4eHRvXt31+GDuuLi4scff9zb27t169atW7det26dfnlVVdWsWbOaNm0aEhISExMTGxs7f/58/UCi6urqZcuWNWvWLCgoKCoqKiYmZsqUKdd7JpAjR4706tXLdQ6BwYMHu46tvC779+/39vYOCQkZOnSofjyW6xEFBQVZrda4uDj9k9QC4RFVV1evXbs2KCjIbDZHRka+//77nTt3Dg4OnjdvXs2v8I9//CM6OvqKj8Dqn6T28fHRD/d8//339ctPnTr10UcfRUdHf/zxx3V+Fmrbtm2RkZH+/v5RUVH9+vXLycnRv/KoUaO8vLxMJtNdd921du3atLS0bt26eXh4WCyWJ598Uj+q79SpU23btrVYLOHh4b///e+fffZZq9X61FNP6b3179/fbDZ7eno++uijV11Gnz59LBZLmzZt0tLSqqurDx06NGfOnJiYmM8//1z/QHdlZaV+m0GDBkVHR+ufA3vrrbf0g89qL2nq1KmhoaEmk6lFixb6cXvffPON/ut5Ly8vPz+/kJCQd955h7PKQC3XegcuLy+Pi4vTT12ya9cu/cKUlBR/f3/9FDHPPfecflzpTz/99Oijj3p6eprN5v79++/fv7/m1xdeyNe6o6su6cCBA7GxsVarNSgoyMfHZ/jw4fprrfa9L126VN9Sqj57uIwfP97Pz89kMrVt23bp0qXCe4vrscfExDzxxBMRERGuN4faP6dWrFjRoUMH/XfnY8eOrX1H+tfcvn17nz59nn/++YSEBP2Etq73SafTmZWV1adPHx8fnzZt2sTFxf3rX//SL585c2aLFi1MJlNoaOgV5xVBQ6n9pK39XJo5c2ZERITJZAoJCanzG3et8eaqr46qqqonn3xS/4uxt7d3YGBgQkLC119/LR/jXuePuau+tC9fvtyrVy9vb+/Q0ND77rtv4sSJfn5+DzzwgB4PCgqyWCwvvfSS0+kcP368fhBOmzZtXM/5+li/fn3v3r2ff/75Nm3aREVFeXt7Dxs2zPWz9cCBA61bt7ZYLBERES+//PLjjz/u7+//8ssvu+KFhYUREREBAQGJiYmuwWbGjBn6B9xbtWr15ptv6p8Vqef36KqTjNPpvHDhwm9/+1tfX9/g4OB27do98MADdX7s+ApLly5NTEy8rsjN5+b8/x8UqGlaXl5eRkZGUVFRkyZNIiMjr9i81+FwnD17NjMzU9O0gICAFi1a1N4Cd9euXefPn7/rrruuOPXmuXPn9KMgYmNjo6Oja16VnZ29d+9eh8PRsmVL/VCQ62W323fs2KH/hejuu+92HR11vc6ePXvp0qWYmJiaf0vatWtXfn6+0Wi866676vk3JuERnT179sSJExEREW3atLHb7QcPHmzevHnNPzLY7XaHw6H/+vmKL3vo0KGDBw/ecccdNQ8C0f+qa7PZ6vOo8/Lydu7caTKZevTo4br92bNnMzIynE6n/oFag8Fw7tw5/Rfh+sc99ZVcunTp2LFj+lkjvb299X/DxMfH22y2c+fOXbx4UdO0kJCQyMjI2ispKSk5evRo06ZNXX8MuWLZNpttwIABO3bsmDVr1j333HP48OH4+HhXdSUlJVcsST/XpM1ms1gs+id3H3nkkYsXL5aXl+sHDuXn5+tn4BkwYECdtQCNhPAOXFBQcPz48bCwsJpvrefOndM/Su46fbLNZjt79qz+y7/g4OAWLVpccbzptV7IrjecK+7oWksqKirauXOnw+Hw9/fv3Lnzte5d/z3itX6mXCEzM/Ps2bPV1dW+vr76LC68t9R87KdPn87MzNTfHDRNu+LnlN1uP3fuXGFhoZubW2RkZERExBV35DpYWT988eLFiz/++GPTpk3vvvvumsvTf9AUFhZ26tQpNDTU1ee5c+f0v6a2bNmSI2cag9pP2oqKiiueS4WFhdf7jas93lz11ZGTk9O9e/eoqKjDhw8bDIbg4OBjx44FBgamp6cLnyep88ec1Wq96ku7oKDg5MmTFRUVsbGxgYGBP/30U15e3p133nn58uWzZ886HI6IiAj9OZ+RkVFVVeXp6dm6dWuHwyHviujr69u0aVP9N9b66+L8+fN79uwJDw93vd51OTk5+ufaY2JizGbzvn37fHx8XBsd6C399NNPERERNY++/umnn/bs2RMdHZ2YmKhfUv/v0VUnGdf3qLCw0GAw1H9gq7nOjIyMDh06XFfqJrvK4A40iJ07dz733HPHjh377//+71deeeVaBw5ei8PheOKJJ9LT08eNG1dSUmKxWHbv3r1mzZply5b9vI/jAADwM+Tm5uqbMfXv37+4uNhqteqn5tu/f7/8qc2bxuFwvPTSS6tXrxZuc++997777rs15280BgzuaCzefvvthQsXlpSU6NsCPP7449f7FXJzc2fNmrV27drCwkJPT099O4x7772Xg90BADfTwYMHX3nlFX1fFF9f34SEhMmTJ7ds2bKh1/V/Dh8+fOLECeEGLVq0iIuLayT/0oALgzsai5KSktLSUofD4e7urp+M9ud9nYyMDKPRWF5eHhAQUHMnZAAAbpqysrILFy54eXmVl5e3bNmSXyHhV8HgDgAAACiAf/8BAAAACmBwBwAAABTA4A4AAAAogMEdAAAAUMD/B/+KYyYpcfifAAAAAElFTkSuQmCC"
                            />
                        </Col>
                    </Row>
                </div>
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
                            <SettingOutlined />
                        </Button>
                    </Button.Group>,
                ]}
                footer={
                    <Table
                        rowKey="task_id"
                        columns={columns}
                        dataSource={list}
                        onChange={this.handleTableChange}
                        expandable={{
                            expandedRowRender,
                            expandRowByClick: true,
                        }}
                        pagination={this.state.pagination}
                    />
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
