import request from '../utils/request';
import { stringify } from 'qs';

// const ip="192.168.31.75:18888";//"10.50.102.166";
const ip = `${localStorage.getItem("api.url") === null?"server.qtingvision.com":localStorage.getItem("api.url")}:${localStorage.getItem("api.port") === null?888:localStorage.getItem("api.port")}`;
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

export async function getModelList(params) {
    return request(`http://${ip}/get_model_list/${params.type}/${params.path}`, {
        method: 'GET',
    });
}

export async function startTest(params) {
    return request(`http://${ip}/start_test`, {
        method: 'POST',
        body: params
    });
}

export async function stopTrain(params) {
    return request(`http://${ip}/stop_train`, {
        method: 'POST',
        body: params
    });
}

export async function continueTrainTrain(params) {
    return request(`http://${ip}/restart_train`, {
        method: 'POST',
        body: params
    });
}

