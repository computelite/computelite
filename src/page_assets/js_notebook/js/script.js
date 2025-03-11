import { get_cl_element } from '../../../assets/js/scc';
import { createCodeMirrorEditor , runAllCell} from "./codeMirrorEditor"
import {executeQuery ,confirmBox,addDefaultModel,fetchData} from '../../../assets/js/scc'
import {nanoid} from 'nanoid'

const params = new URLSearchParams(window.location.search)
let modelName = params.get('modelName');
let runcells = false
const container = document.getElementById("cellContainer");

window.onload = async function () {
  try{

    window.loadCDNScripts = async function (libraries) {
      const loadScript = (url, globalVar) => {
        return new Promise((resolve, reject) => {
            if (globalVar && window[globalVar]) {
                resolve(window[globalVar]);
                return;
            }
  
            const script = document.createElement("script");
            script.src = url;
            script.async = true;
            script.onload = () => resolve(window[globalVar] || true);
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
  
            document.head.appendChild(script);
        });
      };
  
      return Promise.all(libraries.map(lib => loadScript(lib.url, lib.globalVar)));
    }
    
    window.loadCDNStylesheets = async function (stylesheets) {
      return Promise.all(stylesheets.map(({ url }) => {
          return new Promise((resolve, reject) => {
              const link = document.createElement("link");
              link.rel = "stylesheet";
              link.href = url;
              link.onload = () => resolve(url);
              link.onerror = () => reject(`Failed to load CSS: ${url}`);
              document.head.appendChild(link);
          });
      }));
    }
  
  
    let result = await executeQuery('init')
    if (!result || result.msg != 'Success') {
      confirmBox('Alert!', 'Some error occured while initializing sqlite.')
      return
    }
  
    if (!modelName) {
      let all_models = await fetchData('home', 'getUserModels')
      const modelName = all_models.some(subArr => subArr[0] === 'Default_DB') ? 'Default_DB' : (await addDefaultModel())[0] || null;
  
      if (!modelName) {
        confirmBox('Alert!', 'Model Name not found in the URL.');
        return;
      }
    }
    
    window.getData = async (query, params = []) => executeQuery('fetchData', modelName, query, params);
    window.executeQuery = async (query, params = []) => executeQuery('updateData', modelName, query, params);
    await fetchNotebookName()

    let selected_li_el = document.getElementById('jsListDiv').querySelector("li.selectedValue")

    await populateCells(selected_li_el.innerText)   
  }catch(error){
    confirmBox('', `Error during initialization:, ${error}`);
    console.error("Error during initialization:", error);
    return
  }
}

async function populateCells(notebookName){
  document.getElementById("loadingOverlay").classList.remove("hidden");

  try{
    let query = "SELECT CellId,CellContent,NotebookId FROM S_NotebookContent WHERE Name = ? AND CellType = ?"
    const data = await executeQuery('fetchData', modelName, query, [notebookName,'javascript'])
    data.forEach(([rowId, content, NotebookId]) => createCodeEditor(rowId, NotebookId, content));
  }catch (error) {
    console.error("Error populating cells:", error);
  } finally {
    document.getElementById("loadingOverlay").classList.add("hidden");
  }    
}



function createCodeEditor(rowId,NotebookId,content = "") {
  const kernelId = nanoid();
  const kernel = get_cl_element('computelite-cell','cell-grid cell-container celltype-python',kernelId);
  kernel.setAttribute('tabindex', '0');

  const cellControls = get_cl_element('div','cell-controls cell-controls-left cell-controls-left-top');

  const runButton = get_cl_element('button','btn cell-controls-button py-1');
  runButton.title = 'Run Cell';

  const runIcon = get_cl_element('span','fa-regular fa-play-circle');
  runIcon.style.fontSize = '16px';

  runButton.appendChild(runIcon);
  cellControls.appendChild(runButton);

  const cellTop = get_cl_element('div','cell-top flush');
  let controlDiv = get_cl_element('div');
  controlDiv.style = "position: relative;width: 100%;height: 0;";

  const textEditorControls = get_cl_element('div','computelite-text-editor-controls',null,get_cl_element('div'));
  textEditorControls.firstChild.appendChild(get_cl_element('button','btn btn-small transparent p-1 px-1 me-1',null,get_cl_element('span','fa-solid fa-trash-alt')));
  textEditorControls.querySelector('button').title = 'Delete Cell';
  textEditorControls.querySelector('span').style = 'color: #00000066;';

  textEditorControls.querySelector('button').onclick = async function(){
    let query = "DELETE FROM S_NotebookContent WHERE CellId = ? AND CellType = ? AND NotebookId = ?"
    const res = await executeQuery("deleteData",modelName,query,[rowId,'javascript',NotebookId])
    if (res){
      kernel.remove()
    }
  }

  // cellTop.appendChild(textEditorControls);
  const textEditorContainer = get_cl_element('computelite-text-editor');
  const editorDiv = get_cl_element('div','computelite-text-editor');

  controlDiv.appendChild(textEditorControls);
  textEditorContainer.appendChild(controlDiv);
  
  textEditorContainer.appendChild(editorDiv);
  cellTop.appendChild(textEditorContainer);

  kernel.appendChild(cellControls);
  kernel.appendChild(cellTop);

  const output_container = get_cl_element('div','cell-bottom');
  
  kernel.appendChild(output_container);

  container.appendChild(kernel);

  createCodeMirrorEditor(kernelId,modelName,rowId,content,NotebookId)
}

document.getElementById("addCell").onclick = async function () {
  let selected_li_el = document.getElementById('jsListDiv').querySelector("li.selectedValue")
  let notebookId = selected_li_el.getAttribute('id')

  if (!modelName) {
      confirmBox('Alert!', 'Model Name not found in the URL.');
      return;
  }
  try {
      let rowId = await executeQuery("insertData", modelName, "INSERT INTO S_NotebookContent (CellContent, Name, NotebookId, CellType) VALUES (?, ?, ?, ?)", ['',selected_li_el.innerText,notebookId,'javascript']);
      createCodeEditor(rowId,notebookId);
  } catch (error) {
      console.error("Error adding cell:", error);
  }
};

document.getElementById("hideCode").onclick = async function () {
  try {
      let selected_li_el = document.getElementById('jsListDiv').querySelector("li.selectedValue")
      if (!runcells) {
        await runAllCell(container, modelName,selected_li_el.innerText);
        this.innerText = "Show Code"
      } else {
        this.innerText = "Hide Code"
        container.innerHTML = "";
        await populateCells(selected_li_el.innerText);
      }
      runcells = !runcells;
  } catch (error) {
      console.error("Error toggling cells:", error);
  }
};

async function fetchNotebookName() {
  try{

    let jsList = document.getElementById('jsListDiv');
    let query = `SELECT Name, NotebookId FROM S_Notebooks WHERE Status = 'Active' AND Type = 'Javascript'`;
    let rw = await executeQuery('fetchData', modelName, query);
    
    let seen = new Set();
    if (rw.length > 0){
      for (let data of rw) { 
        if (data[0] && !seen.has(data[0])) {
          seen.add(data[0]);
  
          let jsData = get_cl_element('li', 'checkBox-label border-bottom py-0 ps-1', data[1], null);
          jsData.innerText = data[0];
          jsList.appendChild(jsData);
          jsData.onclick = async function(e) {
            for (let cn of document.getElementById('jsListDiv').querySelectorAll("li.selectedValue")) {
              cn.classList.remove("selectedValue");
            }
            this.classList.add("selectedValue");
            document.getElementById('hideCode').innerText = "Hide Code"
            runcells = false
            container.innerHTML = "";
            await populateCells(this.innerText);
          }
        }
      }
      jsList.firstElementChild.classList.add('selectedValue')
    }else{
      let insert_query = `INSERT INTO S_Notebooks (Name,Type,Status) VALUES (?, ?, ?) RETURNING NotebookId`;
      let notebookId = await executeQuery("insertData",modelName,insert_query,['Default','Javascript','Active'])

      let query = `INSERT INTO S_NotebookContent (Name,CellContent,CellType,NotebookId) VALUES (?, ?, ?, ?)`;
      await executeQuery("insertData", modelName, query, ['Default','','javascript',notebookId]);

      let jsData = get_cl_element('li', 'checkBox-label py-0 ps-1', notebookId, null);
      jsData.innerText = 'Default';
      jsList.appendChild(jsData);
      jsData.classList.add("selectedValue");
      container.innerHTML = "";
      jsData.onclick = async function(e) {
        for (let cn of jsList.querySelectorAll("li.selectedValue")) {
          cn.classList.remove("selectedValue");
        }
        this.classList.add("selectedValue");
        document.getElementById('hideCode').innerText = "Hide Code"
        runcells = false
        container.innerHTML = "";
        await populateCells(this.innerText);
      }
    }
  }catch(error){
    confirmBox('Alert!', `Error during execution:, ${error}`);
    console.error("Error during execution:", error);
    return
  }
}


document.getElementById("addNotebook").onclick = async function () {
  document.getElementById("inputDiv").classList.remove("d-none");
  document.getElementById("notebookName").focus();
}


document.getElementById("notebookName").onkeydown = async function (e) { 
  try { 
    if (e.key === 'Enter') {
      e.preventDefault();

      const inp_val = e.target.value.trim();  
      e.target.value = ""
      if (inp_val === '') {
        confirmBox('Alert!', 'Please enter Notebook Name.');
        return;
      }

      let isValidFilename = /^[^\s]+$/.test(inp_val);
      if (!isValidFilename) {
        confirmBox('Alert!', 'Please enter a valid Notebook Name.');
        return;
      }

      let js_query = `SELECT name FROM S_Notebooks WHERE name = ? AND Type = 'Javascript'`
      let rw = await executeQuery('fetchData',modelName,js_query,[inp_val])
      
      if (rw.length > 0){
        confirmBox('Alert!','Notebook Name Already Exists')
        return
      }
      let insert_query = `INSERT INTO S_Notebooks (Name,Type,Status) VALUES (?, ?, ?) RETURNING NotebookId`;
      let notebookId = await executeQuery("insertData",modelName,insert_query,[inp_val,'Javascript','Active'])

      let query = `INSERT INTO S_NotebookContent (CellContent, Name, NotebookId, CellType) VALUES (?, ?, ?, ?)`;
      await executeQuery("insertData", modelName, query, ['',inp_val,notebookId,'javascript']);
      
      document.getElementById("inputDiv").classList.add("d-none");

      let jsList = document.getElementById('jsListDiv');
      let jsData = get_cl_element('li', 'checkBox-label py-0 ps-1', notebookId, null);
      jsData.innerText = inp_val;
      jsList.appendChild(jsData);
      for (let cn of jsList.querySelectorAll("li.selectedValue")) {
        cn.classList.remove("selectedValue");
      }
      jsData.classList.add('selectedValue');
      container.innerHTML = "";
      await populateCells(inp_val);
      jsData.onclick = async function(e) {
        for (let cn of jsList.querySelectorAll("li.selectedValue")) {
          cn.classList.remove("selectedValue");
        }
        this.classList.add("selectedValue");
        document.getElementById('hideCode').innerText = "Hide Code"
        runcells = false
        container.innerHTML = "";
        await populateCells(this.innerText);
      }
    }
  } catch (error) {
    console.error("Error adding notebook:", error);
  }
}

document.getElementById('deleteNotebook').onclick = function () {
  let selected_li_el = document.getElementById('jsListDiv').querySelector("li.selectedValue")
  
  if(selected_li_el){
    confirmBox("",`Are You Sure Want to Delete ${selected_li_el.innerText}`,deleteNoteBookLi.bind(null,selected_li_el),1)
  }else{
    confirmBox('Alert!', 'No Notebook Selected to delete')
  }
  
}

async function deleteNoteBookLi(selected_li){
  let el_id = selected_li.getAttribute('id')
  
  let del_query = `DELETE FROM S_Notebooks WHERE NotebookId = ? `
  await executeQuery("deleteData",modelName,del_query,[el_id])

  let del_cell_query = `DELETE FROM S_NotebookContent WHERE NotebookId = ? AND CellType = 'javascript'`
  const res = await executeQuery("deleteData",modelName,del_cell_query,[el_id])

  for (let kernel of document.querySelectorAll('computelite-cell')){
    if (res){
      kernel.remove()
    }
  }

  document.getElementById('jsListDiv').innerHTML = ''
  await fetchNotebookName();
  let selected_notebook = document.getElementById('jsListDiv').querySelector("li.selectedValue")
  await populateCells(selected_notebook.innerText)
}