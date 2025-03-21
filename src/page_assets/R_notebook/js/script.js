import { get_cl_element } from '../../../assets/js/scc';
import {createCodeMirrorEditor} from './codemirrorEditor'
import {executeQuery,confirmBox,addDefaultModel,fetchData,fetchSchema} from '../../../assets/js/scc'
import {nanoid} from 'nanoid'

const params = new URLSearchParams(window.location.search)
let modelName = params.get('modelName');
let schema = {}
let blobFiles = []

const container = document.getElementById("cellContainer");
window.onload = async function () {
  schema = await fetchSchema()
  let result = await executeQuery('init')
  if (!result || result.msg != 'Success') {
    confirmBox('Alert!', 'Some error occured while initializing sqlite.')
    return
  } else {
    if (!modelName) {
      let all_models = await fetchData('home', 'getUserModels')
      const defaultDbExists = all_models.some(subArr => subArr[0] === 'Default_DB');
  
      if ( !defaultDbExists) {
        let model = await addDefaultModel(schema)
        if (model.length > 0) {
          modelName = model[0]
        } else {
          confirmBox('Alert!', 'Model Name not found in the URL.')
          return
        }
      }else{
        modelName = 'Default_DB'
      }
    }
  }

  const blobQuery = `SELECT FileName,FileBlob FROM S_DataFiles WHERE FileType = 'Input'`
  blobFiles = await executeQuery("fetchData", modelName, blobQuery)

  await fetchNotebookName()

  let selected_li_el = document.getElementById('jsListDiv').querySelector("li.selectedValue")
  await populateCells(selected_li_el.innerText,blobFiles)
  
}

async function populateCells(notebookName,blobFiles){
  try{
    let query = "SELECT CellId,CellContent,NotebookId FROM S_NotebookContent WHERE Name = ? AND CellType = ?"
    const data = await executeQuery('fetchData', modelName, query, [notebookName,'r'])

    data.forEach(([rowId, content, NotebookId]) => createCodeEditor(rowId, NotebookId,blobFiles, content));
  }catch (error) {
    console.error("Error populating cells:", error);
  }
}



function createCodeEditor(rowId,NotebookId,blobFiles,content = "") {
  const kernelId = nanoid();
  const kernel = get_cl_element('computelite-cell','cell-grid cell-container celltype-r',kernelId);
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
    const res = await executeQuery("deleteData",modelName,query,[rowId,'r',NotebookId])
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

  createCodeMirrorEditor(kernelId,modelName,rowId,content,NotebookId,blobFiles)
}

document.getElementById("addCell").onclick = async function(){
  let selected_li_el = document.getElementById('jsListDiv').querySelector("li.selectedValue")
  let notebookId = selected_li_el.getAttribute('id')

  if (!modelName) {
    confirmBox('Alert!', 'Model Name not found in the URL.');
    return;
  }


  try {
    let query = "INSERT INTO S_NotebookContent (CellContent, Name, NotebookId, CellType) VALUES (?, ?, ?, ?)"
    const rowId = await executeQuery("insertData", modelName, query, ['',selected_li_el.innerText,notebookId,'r']);

    createCodeEditor(rowId,notebookId,blobFiles);

  } catch (error) {
    console.error("Error adding cell:", error);
  }

}

async function fetchNotebookName() {
  try{
    let jsList = document.getElementById('jsListDiv');

    let query = `SELECT Name, NotebookId FROM S_Notebooks WHERE Status = 'Active' AND Type = 'R'`;
    let rw = await executeQuery('fetchData', modelName, query);

    let seen = new Set();
    if (rw.length > 0){
      for (let data of rw) { 
        if (data[0] && !seen.has(data[0])) {
          seen.add(data[0]);

          let jsData = get_cl_element('li', 'py-0 ps-1', data[1], null);
          let label = get_cl_element("label", "checkBox-label", null, 
            get_cl_element("span", "fas fa-file-alt" ), null);

          label.appendChild(document.createTextNode(data[0]));
          jsData.appendChild(label);
          jsList.appendChild(jsData);

          jsData.onclick = async function(e) {

            for (let cn of document.getElementById('jsListDiv').querySelectorAll("li.selectedValue")) {
              cn.classList.remove("selectedValue");
            }

            this.classList.add("selectedValue");
            container.innerHTML = "";
            await populateCells(this.innerText);
          }
        }
      }

      jsList.firstElementChild.classList.add('selectedValue')
    }else{
      let insert_query = `INSERT INTO S_Notebooks (Name,Type,Status) VALUES (?, ?, ?) RETURNING NotebookId`;
      let notebookId = await executeQuery("insertData",modelName,insert_query,['Default','R','Active'])

      let query = `INSERT INTO S_NotebookContent (Name,CellContent,CellType,NotebookId) VALUES (?, ?, ?, ?)`;
      await executeQuery("insertData", modelName, query, ['Default','','r',notebookId]);

      let jsData = get_cl_element('li', 'py-0 ps-1', notebookId, null);
      let label = get_cl_element("label", "checkBox-label", null, 
        get_cl_element("span", "fas fa-file-alt" ), null);

      label.appendChild(document.createTextNode('Default'));
      jsData.appendChild(label);
      jsList.appendChild(jsData);
      jsData.classList.add("selectedValue");
      container.innerHTML = "";

      jsData.onclick = async function(e) {
        for (let cn of jsList.querySelectorAll("li.selectedValue")) {
          cn.classList.remove("selectedValue");
        }

        this.classList.add("selectedValue");
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

      if (inp_val === '') {
        confirmBox('Alert!', 'Please enter Notebook Name.');
        return;
      }

      let isValidFilename = /^[^\s]+$/.test(inp_val);
      if (!isValidFilename) {
        confirmBox('Alert!', 'Please enter a valid Notebook Name.');
        return;
      }

      let js_query = `SELECT name FROM S_Notebooks WHERE name = ? AND Type = 'R'`
      let rw = await executeQuery('fetchData',modelName,js_query,[inp_val])

      if (rw.length > 0){
        confirmBox('Alert!','Notebook Name Already Exists')
        return
      }

      let insert_query = `INSERT INTO S_Notebooks (Name,Type,Status) VALUES (?, ?, ?) RETURNING NotebookId`;
      let notebookId = await executeQuery("insertData",modelName,insert_query,[inp_val,'R','Active'])

      let query = `INSERT INTO S_NotebookContent (CellContent, Name, NotebookId, CellType) VALUES (?, ?, ?, ?)`;
      await executeQuery("insertData", modelName, query, ['',inp_val,notebookId,'r']);

      document.getElementById("inputDiv").classList.add("d-none");
      let jsList = document.getElementById('jsListDiv');

      let jsData = get_cl_element('li', 'py-0 ps-1', notebookId, null);
      let label = get_cl_element("label", "checkBox-label", null, 
        get_cl_element("span", "fas fa-file-alt" ), null);

      label.appendChild(document.createTextNode(inp_val));
      jsData.appendChild(label);
      jsList.appendChild(jsData);

      for (let cn of jsList.querySelectorAll("li.selectedValue")) {
        cn.classList.remove("selectedValue");
      }

      jsData.classList.add('selectedValue');
      container.innerHTML = "";

      await populateCells(inp_val);
      e.target.value = ""

      jsData.onclick = async function(e) {
        for (let cn of jsList.querySelectorAll("li.selectedValue")) {
          cn.classList.remove("selectedValue");
        }

        this.classList.add("selectedValue");
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

  let del_query = `DELETE FROM S_Notebooks WHERE NotebookId = ? AND Type = 'R'`
  await executeQuery("deleteData",modelName,del_query,[el_id])

  let del_cell_query = `DELETE FROM S_NotebookContent WHERE NotebookId = ? AND CellType = 'r'`
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

document.getElementById('toggleSidebar').onclick = function () {
  let sidebar = document.getElementById('sidebarMenu');
  sidebar.classList.toggle("contracted");
  container.classList.toggle("cell-position")
  document.getElementById("inputDiv").classList.add("d-none");
};


