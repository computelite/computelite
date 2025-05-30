var server_url = "https://hub.computelite.com";
var backend_opt = false
import Swal from "sweetalert2"
import * as gm from '../../core/gridMethods'
import * as hm from '../../core/homePageMethods'
const pageAlias = {'home':hm,'grid':gm}
import { JavascriptEvaluator } from "../../page_assets/js_notebook/js/eval";
import { WebR } from "https://webr.r-wasm.org/latest/webr.mjs";

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

let CURRENT_CELL



export async function postData(url = '', data = {}) {
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
            response.blob().then(blob_obj => {
                if (url === '/home/get-attached-model'){
                    attachModel(blob_obj, file_name, blobType,data.modelId)
                }else{
                    downloadExcel(blob_obj, file_name, blobType)
                }
            })

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


async function attachModel(blob, filename, blobType,modelId) {
    var newBlob = new Blob([blob], { type: blobType })
    const initialModelName = filename.split('.')[0]
    let modelName = filename.split('.')[0]
    

    const projectName = 'Default'
    const modelTemplate = 'Sample_DB'
    if (!localStorage.getItem('Projects')) {
        localStorage.setItem('Projects', JSON.stringify({}))
    }

    const Projects = localStorage.getItem('Projects')
    let all_projects = JSON.parse(Projects)


    let msg = 'Success'
    
    try {
        if (Object.keys(all_projects).includes(projectName)) {
            if (!(modelName in all_projects[projectName]['Models'])) {
                all_projects[projectName]['Models'][modelName] = { templateName: modelTemplate, status: 'Active',modelId:modelId }
            } else {
                const all_models = all_projects[projectName]['Models']
                if (all_models[modelName]["modelId"] !== modelId){   
                    let count = 0;
                    while (modelName in all_models) {
                        if (all_models[modelName]["modelId"] === modelId){
                            return msg
                        }
                        modelName = initialModelName
                        count++;
                        modelName = `${modelName}_${count}`;
                    }
                    all_projects[projectName]['Models'][modelName] = { templateName: modelTemplate, status: 'Active',modelId:modelId }
                }else{
                    return msg
                }
            }
        } else {
            all_projects[projectName] = { 'Models': { [modelName]: { templateName: modelTemplate, status: 'Active',modelId:modelId } }, status: 'Active' }
        }
        const res = await executeQuery('attachModel', modelName, null, [newBlob])
        localStorage.setItem('Projects', JSON.stringify(all_projects))

    } catch (error) {
        msg = error
    }
    return msg

    
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


export function executePython(action,type,code,projectName,modelName,files,fileName,blobFiles,wheelFiles,kernelId = null) {
    return new Promise((resolve, reject) => {
        const id = Date.now() + Math.random(); // Unique ID for tracking
        const cell = document.getElementById(kernelId)
        if (cell != null){
            CURRENT_CELL = cell
        }
        // Send a message to the worker with the query details and unique ID
        py_worker.postMessage({ id,action, code,projectName,modelName,files,fileName,blobFiles,drawCanvas:drawCanvas.toString(),wheelFiles,type });
        // Handler function to process the response from the worker
        const onMessageHandler = (event) => {
            if (event.data.type == 'stdout'){
                const stdoutLines = event.data.text.split(';');
                if (kernelId != null){
                    const cell = document.getElementById(kernelId);
                    consoleNotebookOutput(cell,stdoutLines)
                }else{
                    const outputContainer = document.getElementById('outputTxt');    
                    stdoutLines.forEach(line => {
                        if (line) {
                            const lineElement = document.createElement('div');
                            lineElement.textContent = line;
                            outputContainer.appendChild(lineElement);
                        }
                    });
                }                
            }
            if (event.data.id === id) {
                // Remove the event listener once the relevant response is received
                py_worker.removeEventListener('message', onMessageHandler);
                if (event.data.success) {
                    resolve(event.data);
                } else {
                    reject(event.data);
                }
            }
        };
        // Add an event listener to handle messages from the worker
        py_worker.addEventListener('message', onMessageHandler);
    });
}

export function consoleNotebookOutput(cell,Lines,type = 'output') {
    let outputContainer = cell.querySelector('div.sidebar-inner');  
    if (!outputContainer){
        const outputInner = get_cl_element('computelite-output',null,null,get_cl_element('div','sidebar-inner px-4 py-2'))
        cell.querySelector('.cell-bottom').appendChild(outputInner);
        outputContainer = cell.querySelector('div.sidebar-inner');
    }

    Lines.forEach(line => {
        if (line) {
            const lineElement = document.createElement('div');
            if (type == 'error'){
                lineElement.classList.add('text-danger')
            }
            lineElement.textContent = line;
            lineElement.style.whiteSpace = "pre";
            outputContainer.appendChild(lineElement);
        }
    });

}

function drawCanvas(pixels, width, height) {
    let CURRENT_HTML_OUTPUT_ELEMENT = CURRENT_CELL.querySelector('.cell-bottom');
    const elem = document.createElement("div");
    if (!CURRENT_HTML_OUTPUT_ELEMENT) {
      console.log("HTML output from pyodide but nowhere to put it, will append to body instead.");
      document.querySelector("body")?.appendChild(elem);
    } else { 
      CURRENT_HTML_OUTPUT_ELEMENT.appendChild(elem);
    }
    const image = new ImageData(new Uint8ClampedArray(pixels), width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("Failed to acquire canvas context");
      return;
    }
    ctx.putImageData(image, 0, 0);
    CURRENT_HTML_OUTPUT_ELEMENT?.appendChild(canvas);
}

export async function drawImageFromPython(data) {
    let CURRENT_HTML_OUTPUT_ELEMENT = CURRENT_CELL.querySelector('.cell-bottom');
    // Convert Python buffer to a Blob
    const blob = new Blob([data], { type: "image/png" }); // Adjust MIME type if necessary
    const imgURL = URL.createObjectURL(blob);

    // Create a new Image object
    const img = new Image();
    img.src = imgURL;

    img.onload = () => {
        // Create a canvas element
        const canvas = get_cl_element("canvas");
        canvas.style = "width: 100%; height: auto;";
        
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;
        if (ctx) {
            // Draw the image on the canvas
            ctx.drawImage(img,0,0,canvas.width,canvas.height);
            // ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            CURRENT_HTML_OUTPUT_ELEMENT.appendChild(canvas); // Append the canvas to the body
        } else {
            console.error("Failed to get canvas context.");
        }

        // Clean up the object URL
        URL.revokeObjectURL(imgURL);
    };

    img.onerror = () => {
        console.error("Failed to load the image.");
        URL.revokeObjectURL(imgURL);
    };
}

export async function addDefaultModel(schema) {
    let data = {
        model_name: 'Default_DB',
        model_template: 'Sample_DB',
        project_name: 'Default',
        schemas:schema,
        db_user: '',
        password : '',
        host:'',
        port:0,
        db_type:'SQLITE'
    }

    const res = await fetchData('home','addNewModel',data)

    if (res.msg === 'Success'){
        return ['Default_DB', 'Sample_DB', 'Default','SQLITE']
    }
    return []
}

export async function fetchSchema (){
    try {
        const response = await fetch("./model_schema.json",{
          cache:"reload",
        });
  
        if (!response.ok) {
            throw new Error(`Failed to load schema: ${response.status} ${response.statusText}`);
        }
  
        const data = await response.json();
  
        return data;  // Return data for further usage
    } catch (error) {
        console.error("Error fetching schema:", error);
        return null;
    }
};


py_worker.onmessage = function (event) {
    if (event.data.type == 'canvas'){
        drawCanvas(event.data.pixels, event.data.width, event.data.height);
    }
}


export async function executeJavascript(kernelId, fileContent) {
    const cell = document.getElementById(kernelId)
    const output_container = cell.querySelector('.cell-bottom')
    const htmlOutput = get_cl_element("div");
    window.thisDiv = htmlOutput;
    window.applyStyle = async function(css_content){
        apply_css(css_content,htmlOutput)
    }
    output_container.appendChild(htmlOutput)

    return await runCode(fileContent,htmlOutput,cell) 
}

async function runCode(content, htmlOutput, cell) {
    return new Promise(async (resolve, reject) => {
      const jsRunner = new JavascriptEvaluator();
      const id = Date.now() + Math.random(); // Generate a unique ID for this execution
  
      function onMessageHandler(event) {
        if (event.data.id === id) {
          window.removeEventListener('message', onMessageHandler);
          if (event.data.success) {
            resolve(event.data);
          } else {
            reject(event.data);
          }
        }
      }
  
        window.addEventListener('message', onMessageHandler);

        jsRunner.run(content).then(outVal => {
            if (!renderHtmlOutput(outVal.value, htmlOutput) && outVal.error) {
                window.dispatchEvent(new MessageEvent('message', { data: { id, success: false, stdout: '', stderr: outVal.value } }));
            } else {            
                window.dispatchEvent(new MessageEvent('message', { data: { id, success: true, stdout: outVal.value, stderr: '' } }));
                handleExecutionOutput(cell, outVal, htmlOutput);
            }
        }).catch(err => {
            window.dispatchEvent(new MessageEvent('message', { data: { id, success: false, stdout: '', stderr: err  } }));
        });
    });
}
  

function apply_css (css_content,el){
    // el.style = css_content
    let style = document.createElement("style");
    style.innerHTML = css_content;
    document.head.appendChild(style);
}

function handleExecutionOutput(cell, outVal, htmlOutput) {
    const { value, error } = outVal;
    if (!renderHtmlOutput(value, htmlOutput) && value !== undefined) {
      consoleNotebookOutput(cell, [value], error ? "error" : undefined);
    }
    if (error) throw value;
}
  
function renderHtmlOutput(val, intoElement) {
    if (val instanceof HTMLElement) {
        intoElement.appendChild(val);
        return true;
    }
    return false;
}


export async function executeR(kernelId, fileContent, modelName, blobFiles) {
    const cell = document.getElementById(kernelId);
    const output_container = cell.querySelector('.cell-bottom');
    const htmlOutput = get_cl_element("div");
    output_container.appendChild(htmlOutput);

    return await runRCode(fileContent, htmlOutput, cell, modelName, blobFiles);
}

async function runRCode(query, htmlOutput, cell, modelName, blobFiles) {
    return new Promise(async (resolve, reject) => {
        const id = Date.now() + Math.random(); // Unique execution ID
        
        function onMessageHandler(event) {
            if (event.data.id === id) {
                window.removeEventListener('message', onMessageHandler);
                if (event.data.success) {
                    resolve(event.data);
                } else {
                    reject(event.data);
                }
            }
        }
        
        window.addEventListener('message', onMessageHandler);
        
        try {
            await initializeWebR(blobFiles);
            const requiredPackages = extractRequiredPackages(query);
            await installMissingPackages(requiredPackages);

            const fsModelPath = `/home/web_user/data/${modelName}.sqlite3`;
            await loadSQLiteFromOPFS(fsModelPath, modelName, 'Default');
            await window.webr.evalR(`thisDB <- "${fsModelPath}"`);

            const shelter = await new window.webr.Shelter();
            const result = await shelter.captureR(query);
            shelter.purge();

            const updatedFile = await window.webr.FS.readFile(fsModelPath);
            await saveSQLiteToOPFS(modelName, 'Default', updatedFile);

            processROutput(result, htmlOutput, cell);

            window.dispatchEvent(new MessageEvent('message', { data: { id, success: true, stdout: result, stderr: '' } }));
        } catch (error) {
            window.dispatchEvent(new MessageEvent('message', { data: { id, success: false, stdout: '', stderr: error.message } }));
        }
    });
}

function processROutput(result, htmlOutput, cell) {
    if (!result) return;

    if (result.output.length > 0) {
        for (const item of result.output) {
            if (item.type === "stdout") {
                if (isHTML(item.data)) {
                    let val = convertResult('html', item.data);
                    htmlOutput.appendChild(val);
                    val.querySelectorAll('script[type|="text/javascript"]').forEach(e => {
                        if (e.textContent !== null) eval(e.textContent);
                    });
                } else {
                    consoleROutput(cell, item.data);
                }
            } else if (item.type === "stderr") {
                consoleNotebookOutput(cell, [`Execution Error: ${item.data}`], 'error');
            } else {
                consoleROutput(cell, item.data);
            }
        }
    }

    if (result.images.length > 0) {
        const img = result.images[0];
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.getContext('2d').drawImage(img, 0, 0);
        htmlOutput.appendChild(canvas);
    }

    readDir('/home/web_user/outputDir').then(outputFiles => {
        if (outputFiles.length > 0) {
            saveOutputFiles(modelName, outputFiles);
        }
    });
}

// Initialize WebR
async function initializeWebR(blobFiles) {
    if (!window.webr || window.webr.terminated) {
        window.webr = new WebR();
        await window.webr.init();
        await setupFileSystem()
        await writeInputFiles(blobFiles)
    }
}


// Function to check if a string is HTML
function isHTML(str) {
    const doc = new DOMParser().parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).some(node => node.nodeType === 1); // Checks if any element node exists
}


async function convertResult(display, value) {
    if (display === "html") {
        let div = get_cl_element("div", "rendered_html cell-output-html");
        div.appendChild(new DOMParser().parseFromString(value, "text/html").body.firstChild);
        return div;
    }
    return value;
}

function consoleROutput(cell, line) {
    let outputContainer = cell.querySelector('div.sidebar-inner');
    if (!outputContainer) {
        const outputInner = get_cl_element('computelite-output', null, null, get_cl_element('div', 'sidebar-inner px-4 py-2'))
        cell.querySelector('.cell-bottom').appendChild(outputInner);
        outputContainer = cell.querySelector('div.sidebar-inner');
    }

    if (line) {
        const lineElement = document.createElement('div');
        lineElement.textContent = line;
        lineElement.style.whiteSpace = "pre";
        outputContainer.appendChild(lineElement);
    }

}


function extractRequiredPackages(code) {
    const libraryRegex = /library\(["']?([\w\.]+)["']?\)/g;
    const requireRegex = /require\(["']?([\w\.]+)["']?\)/g;
    const doubleColonRegex = /([\w\.]+)::[\w\.]+/g;

    let packages = new Set();

    // Extract from library()
    let match;
    while ((match = libraryRegex.exec(code)) !== null) {
        packages.add(match[1]);
    }
    // Extract from require()
    while ((match = requireRegex.exec(code)) !== null) {
        packages.add(match[1]);
    }
    // Extract from ::
    while ((match = doubleColonRegex.exec(code)) !== null) {
        packages.add(match[1]);
    }

    return Array.from(packages);
}


async function installMissingPackages(packages) {
    let missingPackages = [];
    for (const pkg of packages) {
        const checkPkgCmd = `if (!requireNamespace("${pkg}", quietly = TRUE)) { cat("${pkg}") }`;
        const shelter = await new window.webr.Shelter();
        const result = await shelter.captureR(checkPkgCmd);
        shelter.purge();

        if (result?.output?.length > 0) {
            missingPackages.push(pkg);
        }
    }

    if (missingPackages.length > 0) {
        console.log("Installing missing packages:", missingPackages);
        const installCmd = `
            webr::shim_install()
            install.packages(c(${missingPackages.map(p => `"${p}"`).join(", ")}))
        `;
        const installShelter = await new window.webr.Shelter();
        await installShelter.captureR(installCmd);
        installShelter.purge();
    }
}



async function loadSQLiteFromOPFS(modelPath,modelName,projectName) {

    let root = await navigator.storage.getDirectory();
    const dataFolder = await root.getDirectoryHandle('data', { create: true });
    const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: false });
    const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`)
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    window.webr.FS.writeFile(modelPath, uint8Array);
}
  
async function saveSQLiteToOPFS(modelName,projectName,file) {
    let root = await navigator.storage.getDirectory();
    const dataFolder = await root.getDirectoryHandle('data', { create: true });
    const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: false });
    const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`,{ create: false })
    const writable = await fileHandle.createWritable();

    await writable.write(file);
    await writable.close();
}
  
async function setupFileSystem() {
    const inpDirPath = '/home/web_user/inputDir';
    const outDirPath = '/home/web_user/outputDir';
    const dataDirPath = '/home/web_user/data';
    await window.webr.evalR('inputDir <- "/home/web_user/inputDir"');
    await window.webr.evalR('outputDir <- "/home/web_user/outputDir"');
    await window.webr.FS.mkdir(inpDirPath);
    await window.webr.FS.mkdir(outDirPath);
    await window.webr.FS.mkdir(dataDirPath);
}

async function writeInputFiles(blobFiles) {
    for (let file of blobFiles) {
    await window.webr.FS.writeFile(`inputDir/${file[0]}`, file[1]);
    }
} 

async function readDir(dirPath) {
    let outputFiles = []
    try{
        const dir = await window.webr.FS.lookupPath(dirPath)
        for (const file in dir.contents){
            const filePath = `${dirPath}/${file}`
            let Path = await window.webr.FS.lookupPath(filePath)            
            if (!Path.isFolder){
                const fileData = await window.webr.FS.readFile(filePath)    
                const blob = await new Blob([fileData]).arrayBuffer();
                const uint8Array = new Uint8Array(blob);
                outputFiles.push([file,uint8Array])  
            }
        }        
    }catch{
        console.error('Some error occured while reading output file')
    }
    return outputFiles;
}

async function saveOutputFiles(modelName,outputFiles){
    const delQuery = `DELETE FROM S_DataFiles WHERE FileType = 'Output'`
    await executeQuery('deleteData',modelName,delQuery)

    outputFiles.forEach(async ([filename, fileBlob]) => {
    let query = `INSERT INTO S_DataFiles (FileName,FileType,FileBlob) 
                            VALUES (?, ?, ?) ON CONFLICT (FileName,FileType) DO UPDATE SET FileBlob = ? `
    await executeQuery('insertData',modelName,query,[filename,'Output',fileBlob,fileBlob])
    });
}