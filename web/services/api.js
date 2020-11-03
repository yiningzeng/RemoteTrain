import request from '../utils/request';
import { stringify } from 'qs';

// const ip="192.168.31.75:18888";//"10.50.102.166";
const ip = `${localStorage.getItem("api.url") === null?"localhost":localStorage.getItem("api.url")}:${localStorage.getItem("api.port") === null?888:localStorage.getItem("api.port")}`;
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

export async function getValPathList() {
    return request(`http://${ip}/get_val_path_list`, {
        method: 'GET',
    });
}

export async function getVocPathList() {
    return request(`http://${ip}/get_voc_path_list`, {
        method: 'GET',
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

// region 新增接口
export async function getLocalPathList() {
    return request(`http://${ip}/get_local_projects`, {
        method: 'GET',
    });
}
export async function getModelByProject(params) {
    return request(`http://${ip}/get_models/${params.project_name}`, {
        method: 'GET',
    });
}
export async function get_release_models_history(params) {
    return request(`http://${ip}/get_release_models_history/${params.project_name}`, {
        method: 'GET',
    });
}
export async function getModelListV2(params) {
    return request(`http://${ip}/get_model_list_v2/${params.framework_type}/${params.project_name}`, {
        method: 'GET',
    });
}

export async function del_model(params) {
    console.log("getList"+JSON.stringify(params));
    return request(`http://${ip}/del_model?${stringify(params)}`, {
        method: 'DELETE',
    });
}

export async function online_model(params) {
    console.log("getList"+JSON.stringify(params));
    return request(`http://${ip}/online_model?${stringify(params)}`, {
        method: 'PUT',
    });
}

export async function offline_model(params) {
    console.log("getList"+JSON.stringify(params));
    return request(`http://${ip}/offline_model?${stringify(params)}`, {
        method: 'PUT',
    });
}
//http://localhost:18888/get_model_list_v2/yolov4-tiny-3l/后道

// endregion

