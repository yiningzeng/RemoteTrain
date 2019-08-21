import request from '../utils/request';
import { stringify } from 'qs';

const ip="192.168.31.75:18888";//"10.50.102.166";
export async function getList(params) {
    console.log("getList"+JSON.stringify(params));
    return request(`http://${ip}/train_list?${stringify(params)}`, {
        method: 'GET',
    });
}
export async function doTrain(params) {
    console.log("getList"+JSON.stringify(params));
    return request(`http://${ip}/train`, {
        method: 'POST',
        body: params
    });
}