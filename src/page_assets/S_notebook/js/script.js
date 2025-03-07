import { get_cl_element } from '../../../assets/js/scc';
import {createCodeMirrorEditor} from './codemirrorEditor'
import {executePython,executeQuery,confirmBox,addDefaultModel,fetchData} from '../../../assets/js/scc'
import {nanoid} from 'nanoid'

const params = new URLSearchParams(window.location.search)
let modelName = params.get('modelName');

const container = document.getElementById("cellContainer");
window.onload = async function () {

  let result = await executeQuery('init')
  if (!result || result.msg != 'Success') {
    confirmBox('Alert!', 'Some error occured while initializing sqlite.')
    return
  } else {
    if (!modelName) {
      let all_models = await fetchData('home', 'getUserModels')
      const defaultDbExists = all_models.some(subArr => subArr[0] === 'Default_DB');
  
      if ( !defaultDbExists) {
        let model = await addDefaultModel()
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
  let query = "SELECT CellId,CellContent FROM S_PyNotebook"
  const data = await executeQuery('fetchData', modelName, query)
  for (let row of data) {
    createCodeEditor(row[0], row[1])
  }

  let filesQuery = `SELECT FilePath,FileData FROM S_ExecutionFiles WHERE Filename is NOT NULL AND Status = 'Active' `
  const exec_files = await executeQuery("fetchData", modelName, filesQuery)


  const blobQuery = `SELECT FileName,FileBlob FROM S_DataFiles WHERE FileType = 'Input'`
  const blobFiles = await executeQuery("fetchData", modelName, blobQuery)

  const wheelQuery = `SELECT WheelName,WheelBlob FROM S_PackageWheels`
  const wheelFiles = await executeQuery("fetchData", modelName, wheelQuery)

  document.getElementById("loadingOverlay").classList.remove("hidden");
  let py_result = await executePython('init', 'notebook', '', 'Default', modelName, exec_files, '', blobFiles, wheelFiles)
  document.getElementById("loadingOverlay").classList.add("hidden");   
}



function createCodeEditor(rowId,content = "") {
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
    let query = "DELETE FROM S_PyNotebook WHERE CellId = ?"
    const res = await executeQuery("deleteData",modelName,query,[rowId])
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
  
  createCodeMirrorEditor(kernelId,modelName,rowId,content)
}

document.getElementById("addCell").onclick = async function(){
  if (!modelName){
    confirmBox('Alert!','Model Name not found in the URL.')
    return
  }
  let query = "INSERT INTO S_PyNotebook (CellContent) VALUES (?)"
  const rowId = await executeQuery("insertData",modelName,query,[''])
  createCodeEditor(rowId)
  
}


