var server_url = "http://127.0.0.1:5900";
var backend_opt = false
import Swal from "sweetalert2"
import * as gm from '../../core/gridMethods'
import * as hm from '../../core/homePageMethods'
const pageAlias = {'home':hm,'grid':gm}

const btn_class =   { 
                        customClass:    {
                                            confirmButton: 'btn btn-primary',
                                            cancelButton: 'btn btn-tertiary ms-3'
                                        },
                        buttonsStyling: false,
                        reverseButtons: true,
                        confirmButtonText: "OK",
                        cancelButtonText: 'Cancel',
                        showCancelButton: false
                    }

export async function postData(url = '', data = {}) {
    // Default options are marked with *
    const session_var = Object.keys(sessionStorage)
    if (session_var.indexOf("owner_name") > -1 && sessionStorage["owner_name"] !== "None") {
        data["owner_name"] = sessionStorage["owner_name"]
    }
    if (session_var.indexOf("model_name") > -1 && sessionStorage["model_name"] !== "None") {
        data["model_name"] = sessionStorage["model_name"]
    }
    if (session_var.indexOf("table_name") > -1 && sessionStorage["table_name"] !== "None") {
        data["table_name"] = sessionStorage["table_name"]
    }

    const response = await fetch(server_url+url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    });
    if (response.status == 200) {
        if (response.headers.get('Content-Type') == 'application/json') {
            return response.json(); // parses JSON response into native JavaScript objects
        } else {
            let blobType = response.headers.get('Content-Type')
            let file_name = response.headers.get('Content-Disposition').split("filename=")[1].slice(0, -1)
            response.blob().then(blob_obj => downloadExcel(blob_obj, file_name, blobType))

        }
    } else if (response.status == 401) {
        window.location.href = "/sign-in";
    } else if (response.status == 403) {
        window.location.href = "/sign-out";
    }
    else {
        let val = await response.text()
        // confirmBox("Error!", val)
        confirmBox("Oops!", val)
        return Promise.reject(new Error(val))
    }
}

export function confirmBox(title, content, action = null, cancel = null) {
    if (cancel){
        btn_class.customClass.confirmButton =  'btn btn-primary ms-auto me-3' 
        btn_class.showCancelButton = true
    } else {
        btn_class.customClass.confirmButton =  'btn btn-primary' 
        btn_class.showCancelButton = false
    }

    let swal_dict = {}
    swal_dict['allowOutsideClick'] = false
    if (title == ""){
        swal_dict['icon'] = "info"
        title = "Info"
    } else if (title.toLowerCase().substring(0, 7) == "success"){
        swal_dict['icon'] = "success"
    } else if (title.toLowerCase().substring(0, 5) == "error"){
        swal_dict['icon'] = "error"
    } else if (title.toLowerCase().substring(0, 7) == "warning"){
        swal_dict['icon'] = "warning"
    } else if (title.toLowerCase().substring(0, 5) == "alert"){
        swal_dict['icon'] = "warning"
    } else if (title.toLowerCase().substring(0, 4) == "oops"){
        swal_dict['icon'] = "warning"
    }

    swal_dict['title'] = title
    if(typeof(content)!="string"){
        swal_dict['html'] = content
    }else{
        swal_dict['text'] = content
    }
    

    const swal_mixin = Swal.mixin(btn_class);

    swal_mixin.fire(swal_dict).then((result) => {
        if (result.isConfirmed && action) {
            action()
        } else if (result.isDenied && cancel) {
            cancel()
        }
    });
}

export function get_cl_element(tagname, classlist, id = null, childelement = null) {
    let element = document.createElement(tagname)
    if (id) {
        element.id = id
    }
    if (classlist) {
        let class_names = classlist.split(" ")
        for (let class_name of class_names) {
            element.classList.add(class_name)
        }
    }
    if (childelement) {
        element.appendChild(childelement)
    }
    return element
}

function downloadExcel(blob, filename, blobType) {
    // It is necessary to create a new blob object with mime-type explicitly set
    // otherwise only Chrome works like it should
    var newBlob = new Blob([blob], { type: blobType })

    // IE doesn't allow using a blob object directly as link href
    // instead it is necessary to use msSaveOrOpenBlob
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(newBlob);
        return;
    }

    // For other browsers: 
    // Create a link pointing to the ObjectURL containing the blob.
    const data = window.URL.createObjectURL(newBlob);
    var link = document.createElement('a');
    link.href = data;
    link.download = filename;
    link.click();
    setTimeout(function () {
        // For Firefox it is necessary to delay revoking the ObjectURL
        window.URL.revokeObjectURL(data);
    }, 1000);
}

async function postFile(url, file, data = {}) {
    const session_var = Object.keys(sessionStorage)
    if (session_var.indexOf("owner_name") > -1 && sessionStorage["owner_name"] !== "None") {
        data["owner_name"] = sessionStorage["owner_name"]
    }
    if (session_var.indexOf("model_name") > -1 && sessionStorage["model_name"] !== "None") {
        data["model_name"] = sessionStorage["model_name"]
    }
    if (session_var.indexOf("table_name") > -1 && sessionStorage["table_name"] !== "None") {
        data["table_name"] = sessionStorage["table_name"]
    }

    let formData = new FormData();
    formData.append("file", file);

    for (let key in data) {
        formData.append(key, data[key])
    }
    
    const response = await fetch(server_url+url, { method: "POST", body: formData })
    if (response.status == 200) {
        return response.json(); // parses JSON response into native JavaScript objects
    } else if (response.status == 401) {
        window.location.href = "/sign-in";
    } else if (response.status == 403) {
        window.location.href = "/sign-out";
    }
    else {
        let val = await response.text()
        confirmBox("Error!", val)
        return Promise.reject(new Error(val))
    }

}


const worker = new Worker(new URL('../../workers/sqlWorker.js', import.meta.url), { type: 'module' });
const py_worker = new Worker(new URL('../../workers/pyWorker.js', import.meta.url), { type: 'module' });

export function executeQuery(action,dbname = null, query = null, params = [],project_name = null) {
    if (!project_name){
        project_name = getProjectName()
    }
    let projectName = project_name
    if (!projectName){
      projectName = 'Default'
    }
    return new Promise((resolve, reject) => {
        const id = Date.now() + Math.random(); // Unique ID for tracking
        // Send a message to the worker with the query details and unique ID
        worker.postMessage({ id, action,dbname,projectName, query, params });
        // Handler function to process the response from the worker
        const onMessageHandler = (event) => {
            if (event.data.id === id) {
                // Remove the event listener once the relevant response is received
                worker.removeEventListener('message', onMessageHandler);
                if (event.data.success) {
                    resolve(event.data.result);
                } else {
                    reject(event.data.error);
                }
            }
        };
        // Add an event listener to handle messages from the worker
        worker.addEventListener('message', onMessageHandler);
    });
  }
  
export async function tableInfo(model_name,tablename) {
    let query;
    let rows = await executeQuery('fetchData',model_name,"SELECT 1 FROM sqlite_master WHERE type = 'view' AND LOWER(name)=?",[tablename.toLowerCase()])
  
    if (rows.length > 0) {
        query = `SELECT name, CASE WHEN type = '' THEN 'VARCHAR' ELSE type END, [notnull], pk
                  FROM pragma_table_xinfo('${tablename}')`;
    } else {
        query = `SELECT name, type, [notnull], pk
                  FROM pragma_table_xinfo('${tablename}')`;
    }
    
    const result = await executeQuery('fetchData',model_name,query);
    return result;
}
  
export async function checkTableExists(modelName,tableName){
    let query = `SELECT 1 FROM [${tableName.toLowerCase()}]`
    try{
      const result = await executeQuery('fetchData',modelName,query);
    }catch{
      return false
    }
    return true
  
}
  
const getProjectName = () =>{
    const Projects = localStorage.getItem('Projects')
    if (Projects){
      let all_projects = JSON.parse(Projects)
      if (Object.keys(all_projects).length > 0){
        const projName = Object.keys(all_projects).filter(key => all_projects[key]['status'] === "Active");
        return projName[0]
    
      }
    }
    return null
}

export async function fetchData(pageName,action, data = {},useBackend = false) {
    if (useBackend) {
        let url = `/${pageName}/${action}`
        return await postData(url, data);
    } else {
        return await pageAlias[pageName][action](data);
    }
}

export async function uploadFile(pageName,action,file, data = {},useBackend = false) {
    if (useBackend) {
        let url = `/${pageName}/${action}`
        return await postFile(url,file, data);
    } else {
        return await executeQuery(action,data.model_name,null,[file])
    }
}

export function executePython(action,code,projectName,modelName,files,fileName,blobFiles,wheelFiles) {
    return new Promise((resolve, reject) => {
        const id = Date.now() + Math.random(); // Unique ID for tracking
        // Send a message to the worker with the query details and unique ID
        py_worker.postMessage({ id,action, code,projectName,modelName,files,fileName,blobFiles,wheelFiles });
        // Handler function to process the response from the worker
        const onMessageHandler = (event) => {
            if (event.data.type == 'stdout'){
                const outputContainer = document.getElementById('outputTxt');    
                const stdoutLines = event.data.text.split(';');

                stdoutLines.forEach(line => {
                    if (line) {
                        const lineElement = document.createElement('div');
                        lineElement.textContent = line;
                        outputContainer.appendChild(lineElement);
                    }
                });
            }
            if (event.data.id === id) {
                // Remove the event listener once the relevant response is received
                py_worker.removeEventListener('message', onMessageHandler);
                if (event.data.success) {
                    resolve(event.data);
                } else {
                    reject(event.data.error);
                }
            }
        };
        // Add an event listener to handle messages from the worker
        py_worker.addEventListener('message', onMessageHandler);
    });
}