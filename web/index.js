import React from 'react';
import ReactDOM from 'react-dom';
import dva, { connect } from 'dva';
import { Tag, Row, Col, Table, message, Divider, Icon,Spin ,Button,Select, Switch} from 'antd';
// 由于 antd 组件的默认文案是英文，所以需要修改为中文
import zhCN from 'antd/lib/locale-provider/zh_CN';
import moment from 'moment';
import 'moment/locale/zh-cn';
import { getList } from './services/api';

moment.locale('zh-cn');

class FreeFish extends React.Component {
    state = {
        selectedRowKeys: [], // Check here to configure the default column
        pagination: {defaultPageSize:50},
        loading: false,
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

    render() {
        const {
            service: { trains: { list }}
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
            render: v =>{
                if(v === 1) return <Tag color="#2db7f5">插队</Tag>;
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
                if(v === 0) return <Tag color="#A9A9A9">等待解包</Tag>;
                else if(v === 1) return  <Tag color="#f50">解包完成</Tag>;
                else if(v === 2) return  <Button type="danger" loading>正在训练</Button>;
                else if(v === 3) return  <div><Tag color="#008000">训练完成</Tag><Icon type="smile" theme="twoTone" /></div>;
                else return  <Tag>未知</Tag>;
            }
        }];


        const { selectedRowKeys } = this.state;
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
                    this.setState({ selectedRowKeys: newSelectedRowKeys });
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
                    this.setState({ selectedRowKeys: newSelectedRowKeys });
                },
            }],
            onSelection: this.onSelection,
        };
        return (
            <Table size={"small"} rowSelection={rowSelection} columns={columns} dataSource={list} onChange={this.handleTableChange}
                   expandedRowRender={record => {
                       return(
                           <Row style={{marginLeft: 50}}>
                               <Row>
                                   <Switch style={{marginTop: -3}} checkedChildren="插队开" unCheckedChildren="插队关" disabled={record.is_jump === 1} defaultChecked={record.is_jump === 1} onChange={(c)=>{message.success(`待完善， ${c}`)}}/>
                                   <Button type="primary" size="small" style={{marginLeft: 10}} disabled={record.status !== 2}>停止训练</Button>
                                   <Button type="primary" size="small" style={{marginLeft: 10}} disabled={record.status !== 2}>继续训练</Button>
                                   <Button type="primary" size="small" style={{marginLeft: 10}}>打开测试端口</Button>
                                   <Button type="primary" size="small" style={{marginLeft: 10}}>日志</Button>
                               </Row>
                               <Row>
                                   <Divider/>
                               </Row>
                               <Row>
                                   <a href={record.url} target="view_window" style={{ margin: 0 }}>{record.description}</a>
                               </Row>
                           </Row>
                       )
                   }}
                   expandRowByClick
                   pagination={this.state.pagination}/>
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
    },
    effects: {
        *getList({ payload,callback}, { call, put }) {
            const response = yield call(getList,payload);
            yield put({
                type: 'trains',
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
