import CodeMirror from "codemirror";
import 'codemirror/theme/dracula.css';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/python/python.js';
import { confirmBox, executePython,executeQuery, get_cl_element,fetchData,addDefaultModel } from "../../../assets/js/scc"
const params = new URLSearchParams(window.location.search)
import * as bootstrap from 'bootstrap'
import JSZip from "jszip";

let modelName = params.get('modelName');
let projectName = params.get('projectName');
var editor = null
let selected_li_el = null
let selected_folder_el = null
let imgBlob = null

    
window.onload = async function () {  
  const modalElements = document.querySelectorAll('.modal');
  modalElements.forEach(modalElement => {
    if (!bootstrap.Modal.getInstance(modalElement)) {
      new bootstrap.Modal(modalElement);
    }
  });

  editor = CodeMirror.fromTextArea(document.getElementById("editorText"), {
      lineNumbers: true,
      lineWrapping:true,
      mode: "python",
      theme:"dracula",
      autoRefresh:true,
      autofocus:true,   
      tabSize:4,
      indentUnit:4, 
      

  });

  editor.addKeyMap({
    'Backspace': function (cm) {
      const cursor = cm.getCursor(); 
      const line = cm.getLine(cursor.line);
      const indentUnit = cm.getOption('indentUnit');
  
      const leadingSpaces = line.slice(0, cursor.ch);
      if (/^\s*$/.test(leadingSpaces) && cursor.ch > 0) {
        const newCh = Math.max(0, cursor.ch - indentUnit);
        cm.setCursor({ line: cursor.line, ch: newCh });
      } else {
        cm.execCommand('delCharBefore');
      }
    },
  });
  
  let result = await executeQuery('init')
  if (!result || result.msg != 'Success'){
      confirmBox('Alert!','Some error occured while initializing sqlite.')
      return
  }

  if (!modelName) {
    let all_models = await fetchData('home', 'getUserModels')
    const defaultDbExists = all_models.some(subArr => subArr[0] === 'Default_DB');

    if ( !defaultDbExists) {
      let model = await addDefaultModel()
      if (model.length > 0) {
        modelName = model[0]
        projectName = 'Default'
      } else {
        confirmBox('Alert!', 'Model Name not found in the URL.')
        return
      }
    }else{
      modelName = 'Default_DB'
      projectName = 'Default'
    }
  }

  buildFileStructure()

  let query = `SELECT FileName,FileData FROM S_ExecutionFiles WHERE FilePath = ? AND Status = 'Active' `
  const query_res = await executeQuery("fetchData",modelName, query,['requirements.txt'])
  
  const wheelQuery = `SELECT WheelName,WheelBlob FROM S_PackageWheels`
  const wheelFiles = await executeQuery("fetchData",modelName, wheelQuery)
  
  let py_result = await executePython('init','editor','',projectName,modelName,query_res,'',[],wheelFiles)

  let spinnerEl = document.getElementById('packageIndicator')
  displayOutput(py_result.stderr)
  spinnerEl.classList.remove('spinner-loading');
  spinnerEl.classList.add('spinner-complete');

  document.getElementById('downloadZip').onclick = fetchFilesAndDownloadZip
  document.getElementById('downloadOutput').onclick = downloadOutput
  document.getElementById('getText').onclick = runPythonCode
  document.getElementById("uploadZip").onclick = uploadZipFile
  document.getElementById('hideCanvas').onclick = hideCanvas
  document.getElementById("addFile").onclick = createNewFile
  document.getElementById("addFolder").onclick = createNewFolder
  document.getElementById("deleteFile").onclick = deleteFile
  document.getElementById('addToHome').onclick = showFileModal
  document.getElementById('saveFileName').onclick = addFileToHome
}

function set_editor_value(text){
  editor.setValue(text)
  setTimeout(function(){
      editor.refresh();
      editor.focus();
  },200) ;
}


async function runPythonCode(){
  imgBlob = null
  document.getElementById("loadingOverlay").classList.remove("hidden");
  document.getElementById('outputTxt').innerHTML = ''
  const canvas = document.getElementById('myCanvas');

  let query = editor.getValue()

  let filesQuery = `SELECT FilePath,FileData FROM S_ExecutionFiles WHERE Filename is NOT NULL AND Status = 'Active' `
  const exec_files = await executeQuery("fetchData",modelName, filesQuery)

  let filepath = ''
  if (selected_li_el){
    filepath = selected_li_el.getAttribute('filepath')
    await saveFileContent()
  }

  const blobQuery = `SELECT FileName,FileBlob FROM S_DataFiles WHERE FileType = 'Input'`
  const blobFiles = await executeQuery("fetchData",modelName, blobQuery)

  const wheelQuery = `SELECT WheelName,WheelBlob FROM S_PackageWheels`
  const wheelFiles = await executeQuery("fetchData",modelName, wheelQuery)
  const task_id = await update_task('Started')
  let res = await executePython('execute','editor',query,projectName,modelName,exec_files,filepath,blobFiles,wheelFiles)
  document.getElementById("loadingOverlay").classList.add("hidden");

  if (res.stderr){
    update_task('Errored',res.stderr,task_id)
  }else{
    update_task('Completed',null,task_id)
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (res.blob){
      imgBlob = res.blob
      const imageBitmap = await createImageBitmap(res.blob);
      // Calculate the scale factor to fit the image within the canvas while maintaining the aspect ratio
      const scale = Math.min(canvas.width / imageBitmap.width, canvas.height / imageBitmap.height);
  
      // Calculate the top-left corner positions to center the image in the canvas
      const x = (canvas.width - imageBitmap.width * scale) / 2;
      const y = (canvas.height - imageBitmap.height * scale) / 2;
  
      ctx.drawImage(imageBitmap, x, y,imageBitmap.width * scale, imageBitmap.height * scale);
      const canvasDiv = document.getElementById("canvasDiv")
    
      if(canvasDiv.style.width != "500px"){
        canvasDiv.style.width = "500px";
        document.getElementById("mainDiv").style.marginRight = "513px"; 
      }
    }
  
    if (res.outputFiles && res.outputFiles.length > 0){
      const delQuery = `DELETE FROM S_DataFiles WHERE FileType = 'Output'`
      await executeQuery('deleteData',modelName,delQuery)
  
      res.outputFiles.forEach(async ([filename, fileBlob]) => {
        let query = `INSERT INTO S_DataFiles (FileName,FileType,FileBlob) 
                              VALUES (?, ?, ?) ON CONFLICT (FileName,FileType) DO UPDATE SET FileBlob = ? `
        await executeQuery('insertData',modelName,query,[filename,'Output',fileBlob,fileBlob])
      });
  
    }
  }
  
  displayOutput(res.stderr)
}

function displayOutput(stderr) {
  const outputContainer = document.getElementById('outputTxt');
  
  if (stderr) {
      const errorElement = document.createElement('div');
      errorElement.textContent = `Error: ${stderr}`;
      errorElement.style.color = 'red';
      outputContainer.appendChild(errorElement);
  }

}

async function saveFileContent(){
  const selected_el = document.getElementById('filesDiv').querySelector("li.selectedValue")
  if (selected_el){
    const filePath = selected_el.getAttribute('filepath')
    const fileName = selected_el.innerText
    const FileData = editor.getValue()

    if (fileName === 'requirements.txt'){
      const res = await executePython('loadPackages','editor',FileData)
      if (res.stderr){
        displayOutput(res.stderr)
      }
    }
  
    let query = `INSERT INTO S_ExecutionFiles (FileName,FilePath,FileData) VALUES (?, ?, ?) ON CONFLICT (FilePath)
                  DO UPDATE SET FileData = ? `
    let result = await executeQuery("insertData",modelName, query, [fileName,filePath,FileData,FileData])
  }
  
}

async function uploadZipFile() {
  const file = document.getElementById('zipFile').files[0];
  if (file) {
    this.setAttribute("disabled", "")
    this.innerHTML = `<span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>`
    let deleteQuery = "DELETE FROM S_ExecutionFiles";
    await executeQuery('deleteData', modelName, deleteQuery);

    const reader = new FileReader();
    reader.onload = async function(e) {
      const zip = await JSZip.loadAsync(e.target.result);

      const fileProcessingPromises = [];

      zip.forEach(function (relativePath, zipEntry) {
        if (relativePath.includes("__pycache__")) {
          return;
        }
        const filePromise = zipEntry.async("string").then(async function(fileContent) {
          if (fileContent) {
            const filename = relativePath.split('/').slice(-1)[0];
            let query = `INSERT INTO S_ExecutionFiles (FileName,FilePath,FileData) VALUES (?, ?, ?) 
                         ON CONFLICT (FilePath) DO UPDATE SET FileData = ?, FilePath = ?`;

            await executeQuery("insertData", modelName, query, [filename, relativePath, fileContent, fileContent, relativePath]);
          }
        });

        fileProcessingPromises.push(filePromise);
      });

      await Promise.all(fileProcessingPromises);

      const el = document.getElementById("uploadZip")
      el.removeAttribute("disabled")
      el.innerHTML = ''
      el.innerText = 'Upload'
      set_editor_value('')

      buildFileStructure();

      const bs_modal = bootstrap.Modal.getInstance(document.getElementById('modal-file-upload'))
      bs_modal.hide()
      confirmBox('Success', 'File Uploaded Successfully');
    };

    reader.readAsArrayBuffer(file);
  }
};

function get_scc_tree(folderDict,parent_folder = false ,fileName = null,filePath = null,parentPath = '', parent_icon = "fa-solid fa-folder") {
  let tree = get_cl_element("ul", "tree");

  for (let folderName in folderDict) {
    tree.appendChild(document.createElement("li"))
    if (folderDict[folderName] && typeof folderDict[folderName] === 'object') {
      parentPath += parentPath ? `/${folderName}`:folderName

      let parent = get_tree_li_element(folderName, parent_icon);
      parent.setAttribute('folderPath',parentPath)
      parent.onclick = function (e) {
        if (!this.classList.contains("selectedFolder")) {
          for (let cn of document.getElementById('filesDiv').querySelectorAll("li.selectedFolder")) {
            cn.classList.remove("selectedFolder");
          }

          for (let cn of document.getElementById('filesDiv').querySelectorAll("li.selectedValue")) {
            cn.classList.remove("selectedValue");
          }
          this.classList.add("selectedFolder");
          e.preventDefault();
          selected_folder_el = this
          selected_li_el = null
        }
      }

      let childList = get_cl_element("ul", "childList TreeMembers");
      
      childList.appendChild(get_scc_tree(folderDict[folderName], false, fileName, filePath, parentPath));

      tree.appendChild(parent);
      tree.appendChild(childList);
      parentPath = parentPath.replace(/\/[^\/]+$/, '');
    } else {
      if (!folderDict[folderName]) {
        continue
      }
      let fileElement = get_tree_li_element(folderName, 'fa-file-alt', folderDict[folderName], filePath, fileName);

      fileElement.onclick = async function (e) {
        if (!this.classList.contains("selectedValue")) {
          document.getElementById('outputTxt').innerHTML = ''
          document.getElementById("loadingOverlay").classList.remove("hidden");
          await saveFileContent()
          document.getElementById("loadingOverlay").classList.add("hidden");
          const buttonsDiv = document.getElementById('bottomButtons')
          buttonsDiv.style.display = ""


          for (let cn of document.getElementById('filesDiv').querySelectorAll("li.selectedValue")) {
            cn.classList.remove("selectedValue");
          }

          for (let cn of document.getElementById('filesDiv').querySelectorAll("li.selectedFolder")) {
            cn.classList.remove("selectedFolder");
          }
          this.classList.add("selectedValue");
          e.preventDefault();
          selected_folder_el = null
          selected_li_el = this
          const filepath = this.getAttribute('filepath')

          const lastFourChars = filepath.slice(-4)
          if (lastFourChars === '.txt'){
            buttonsDiv.style.display = "none"
          }

          let query = `SELECT FileName,ifnull(FileData,'') FROM S_ExecutionFiles WHERE FilePath = ? AND Status = 'Active' `
          const query_res = await executeQuery("fetchData", modelName, query, [filepath])
          if (query_res && query_res[0]) {
            set_editor_value(query_res[0][1])
          }
        }
      };

      tree.appendChild(fileElement);
    }

  }
  
  if (parent_folder){
    return get_cl_element("div", "card-body scc-box", null, tree);
  }else{
    return get_cl_element("div", null, null, tree);
  }
}

function get_tree_li_element(level_name, icon_class,FilePath = null,newFilePath = null,fileName = null) {
  let el = get_cl_element("li", null, null);
  if (newFilePath && fileName && FilePath){
    if (level_name == fileName && FilePath == newFilePath){
      el.classList.add('selectedValue')
    }
  }
  el.setAttribute('title',level_name)
  if (FilePath){
    el.setAttribute('filepath',FilePath)
  }
  
  let label = get_cl_element("label", "checkBox-label", null, 
      get_cl_element("span", `fas ${icon_class}`), null);
  
  label.appendChild(document.createTextNode(level_name));
  
  el.appendChild(label);

  
  return el;
}

async function buildFileStructure(fileName = null,filePath = null) {
  let query = `SELECT FilePath FROM S_ExecutionFiles`
  const files = await executeQuery('fetchData',modelName,query)
  
  const root = {};

  files.forEach(FilePath => {
    const parts = FilePath[0].split('/');
    let current = root;

    parts.forEach((part, index) => {
      if (part){
        if (index === parts.length - 1) {
          let isFilename = /^[^\s]+\.(py|txt)$/.test(part);
          if (isFilename){
            current[part] = FilePath[0];
          }else{
            current[part] = {}
          }

        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      }
    });
  });

  const sortedRoot = sortDirectoriesFirst(root);
  
  document.getElementById('filesDiv').innerHTML = ''
  document.getElementById('filesDiv').appendChild(get_scc_tree(sortedRoot,true,fileName,filePath))
}

function sortDirectoriesFirst(obj) {
  const sortedObj = {};
  const directories = Object.keys(obj).filter(key => typeof obj[key] === 'object');
  const files = Object.keys(obj).filter(key => typeof obj[key] !== 'object');

  directories.sort().forEach(dir => {
    sortedObj[dir] = sortDirectoriesFirst(obj[dir]);
  });
  files.sort().forEach(file => {
    sortedObj[file] = obj[file];
  });

  if (sortedObj['requirements.txt']) {
    const requirementsTxt = sortedObj['requirements.txt'];
    delete sortedObj['requirements.txt'];
    sortedObj['requirements.txt'] = requirementsTxt; // Add it back to the end
  }

  return sortedObj;
}

function hideCanvas(){
  const canvasDiv = document.getElementById("canvasDiv")
  if(canvasDiv.style.width == "500px"){
    canvasDiv.style.width = "0";
    document.getElementById("mainDiv").style.marginRight = "0px"; 
  }
}

function create_add_file_input() {
  let inputGroup = get_cl_element("div","input-group mb-2");

  let fileInput = get_cl_element("input","form-control small-input");
  fileInput.type = "text";

  fileInput.addEventListener("keydown", async function (e) {
    if (e.keyCode == "13") {      
      const inp_val = e.target.value      
      e.preventDefault()
      let isValidFilename = /^[^\s]+\.(py|txt)$/.test(inp_val);
      if (isValidFilename){
        let filePath = inp_val
        if (selected_li_el){
          let elPath = selected_li_el.getAttribute('filepath')
          filePath = elPath.replace(selected_li_el.innerText,inp_val)
        }else if (selected_folder_el){
          let elPath = selected_folder_el.getAttribute('folderpath')
          filePath = elPath+`/${inp_val}`
        }
        let fetch_query = 'Select FileName FROM S_ExecutionFiles WHERE FileName = ? AND FilePath = ? '
        const res = await executeQuery('fetchData',modelName,fetch_query,[inp_val,filePath])
        if (res.length > 0){
          confirmBox('Alert!','Filename Already Exists')
          return
        }
        let query = `INSERT INTO S_ExecutionFiles (FileName,FilePath) VALUES (?, ?) `;
        await executeQuery("insertData", modelName, query, [inp_val, filePath]);

        removeFileInput();
        await buildFileStructure(inp_val,filePath);
        const fileEL = document.getElementById('filesDiv').querySelector("li.selectedValue")
        if (fileEL){
          selected_li_el = fileEL
          const filepath = fileEL.getAttribute('filepath')

          let query = `SELECT FileName,ifnull(FileData,'') FROM S_ExecutionFiles WHERE FilePath = ? AND Status = 'Active' `
          const query_res = await executeQuery("fetchData",modelName, query,[filepath])
          if (query_res && query_res[0]){
            set_editor_value(query_res[0][1])
          }
        }

      }else{
        confirmBox('Alert!','Invalid Filename')
      }
    }
  })

  inputGroup.appendChild(fileInput);
  
  return inputGroup;
}

function createNewFile (){
  removeFileInput();  

  let parentEl = document.querySelector('.tree')
  if (selected_li_el){
    parentEl = selected_li_el.parentNode
  }else if (selected_folder_el){
    parentEl = selected_folder_el.nextElementSibling.querySelector('.tree')
  }
  
  let inputGroup = create_add_file_input();
  parentEl.insertBefore(inputGroup, parentEl.firstChild);
  inputGroup.querySelector('input').focus()

}

function removeFileInput(){
  const inputGroup_el = document.querySelector('div.scc-box').querySelector('.input-group')
  if (inputGroup_el){
    inputGroup_el.parentNode.removeChild(inputGroup_el);
  }
}

function create_add_folder_input() {
  let inputGroup = get_cl_element("div","input-group mb-2");

  let fileInput = get_cl_element("input","form-control small-input");
  fileInput.type = "text";

  fileInput.addEventListener("keydown", async function (e) {
    if (e.keyCode == "13") {      
      const inp_val = e.target.value      
      e.preventDefault()
      let isValidFilename = /^[^\s]+$/.test(inp_val);
      if (isValidFilename){
        let filePath = inp_val
        if (selected_li_el){
          let elPath = selected_li_el.getAttribute('filepath')
          filePath = elPath.replace(selected_li_el.innerText,inp_val)
        }else if (selected_folder_el){
          let elPath = selected_folder_el.getAttribute('folderpath')
          filePath = elPath+`/${inp_val}`
        }
        let fetch_query = 'Select FilePath FROM S_ExecutionFiles WHERE FileName IS NULL AND FilePath = ? '
        const res = await executeQuery('fetchData',modelName,fetch_query,[filePath])
        if (res.length > 0){
          confirmBox('Alert!','Folder with same name already exists')
          return
        }
        let query = `INSERT INTO S_ExecutionFiles (FilePath) VALUES (?) `;
        await executeQuery("insertData", modelName, query, [filePath]);

        removeFileInput();
        await buildFileStructure(inp_val,filePath);
        
      }else{
        confirmBox('Alert!','Invalid Folder name')
      }
    }
  })

  inputGroup.appendChild(fileInput);
  
  return inputGroup;
}

function createNewFolder (){
  removeFileInput();
  let parentEl = document.querySelector('.tree')
  if (selected_li_el){
    parentEl = selected_li_el.parentNode
  }else if (selected_folder_el){
    parentEl = selected_folder_el.nextElementSibling.querySelector('.tree')
  }
  
  let inputGroup = create_add_folder_input();
  parentEl.insertBefore(inputGroup, parentEl.firstChild);
  inputGroup.querySelector('input').focus()
}

async function deleteFile(){
  if (!selected_li_el && !selected_folder_el){
    confirmBox('Alert!', 'No File Or Folder Selected to delete')
    return
  }

  let filePath = null
  if (selected_li_el){
    filePath = selected_li_el.getAttribute('filepath')
    confirmBox('Alert',`Are you sure want to delete '${selected_li_el.innerText}'`,deleteFileOrFolder.bind(null,filePath),1)
    return
  }else if(selected_folder_el){
    filePath = selected_folder_el.getAttribute('folderpath')
    confirmBox('Alert',`Are you sure you want to permanently delete the '${selected_folder_el.innerText}' folder and all of its contents, including subfolders and files?`,deleteFileOrFolder.bind(null,filePath),1)
    return
  } 
  
}

async function deleteFileOrFolder(path){
  let query = `DELETE FROM S_ExecutionFiles WHERE FilePath Like ? OR FilePath = ?`
  await executeQuery('deleteData',modelName,query,[`%${path}%`,path])
  set_editor_value('')
  selected_li_el = null
  selected_folder_el = null
  await buildFileStructure()
}

async function fetchFilesAndDownloadZip() {
  try {
    let query = `SELECT FilePath,FileData FROM S_ExecutionFiles`
    const files = await executeQuery('fetchData',modelName,query)
  
    if (!files || files.length === 0) {
      return;
    }

    const zip = new JSZip();

    files.forEach(file => {
      zip.file(file[0], file[1], { binary: true });
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });

    const downloadLink = document.createElement("a");
    downloadLink.href = window.URL.createObjectURL(zipBlob);
    downloadLink.download = "files.zip";
    downloadLink.click();

    setTimeout(function () {
      // For Firefox it is necessary to delay revoking the ObjectURL
      window.URL.revokeObjectURL(downloadLink.href);
  }, 1000);

  } catch (error) {
    console.error("Error creating zip file for download:", error);
  }
}

async function showFileModal(){
  document.getElementById('fileName').value = ''
  if (!selected_li_el){
    confirmBox('Alert!','No file selected')
    return
  }
  const bs_modal = new bootstrap.Modal(document.getElementById('modal-fileDisplayName'))
  bs_modal.show()
}

async function addFileToHome(){
  const filePath = selected_li_el.getAttribute('filepath')
  const taskName = document.getElementById('fileName').value

  if (taskName.trim() == ''){
    confirmBox('Alert','Please enter File Display Name')
    return
  }

  let query = `INSERT INTO S_TaskMaster (TaskName,TaskDisplayName) VALUES (?, ?)`
  try{
    const result = await executeQuery('insertData',modelName,query,[filePath,taskName])
    const bs_modal = bootstrap.Modal.getInstance(document.getElementById('modal-fileDisplayName'))
    bs_modal.hide()

    confirmBox('Success','File added to Home Page Successfully')
  }catch{
    confirmBox('Alert!','This File Name is already exists')
  } 

}

async function downloadOutput() {
  const downloadLink = document.createElement("a");
  downloadLink.href = window.URL.createObjectURL(imgBlob);
  downloadLink.download = "output.jpg";
  downloadLink.click();

  setTimeout(function () {
    window.URL.revokeObjectURL(downloadLink.href);
  }, 1000);  
}

async function update_task(taskStatus,msg = null,task_id = null){
  if (selected_li_el){
    const taskName = selected_li_el.innerText.trim()
    
    if (!task_id){
        let query = `INSERT INTO T_TaskLogs (TaskName,TaskStatus,EndDate) VALUES (?, ?, datetime('now', 'localtime'))`
        const res = await executeQuery('insertData',modelName,query,[taskName,taskStatus])
        return res
    }else{
        let query = `UPDATE T_TaskLogs SET TaskStatus = ?,ErrorMsg = ?, EndDate = datetime('now', 'localtime')
                     WHERE TaskName = ? AND Id = ? `
        const result = await executeQuery('updateData',modelName,query,[taskStatus,msg,taskName,task_id])
    }
  }
}