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
    
    await populateCells()     
  }catch(error){
    confirmBox('', `Error during initialization:, ${error}`);
    console.error("Error during initialization:", error);
    return
  }
}

async function populateCells(){
  document.getElementById("loadingOverlay").classList.remove("hidden");

  try{
    let query = "SELECT CellId,CellContent FROM S_JsNotebook"
    const data = await executeQuery('fetchData', modelName, query)
    data.forEach(([rowId, content]) => createCodeEditor(rowId, content));
  }catch (error) {
    console.error("Error populating cells:", error);
  } finally {
    document.getElementById("loadingOverlay").classList.add("hidden");
  }    
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
    let query = "DELETE FROM S_JsNotebook WHERE CellId = ?"
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

document.getElementById("addCell").onclick = async function () {
  if (!modelName) {
      confirmBox('Alert!', 'Model Name not found in the URL.');
      return;
  }
  try {
      let rowId = await executeQuery("insertData", modelName, "INSERT INTO S_JsNotebook (CellContent) VALUES (?)", ['']);
      createCodeEditor(rowId);
  } catch (error) {
      console.error("Error adding cell:", error);
  }
};

document.getElementById("hideCode").onclick = async function () {
  try {
      if (!runcells) {
        await runAllCell(container, modelName);
        this.innerText = "Show Code"
      } else {
        this.innerText = "Hide Code"
        container.innerHTML = "";
        await populateCells();
      }
      runcells = !runcells;
  } catch (error) {
      console.error("Error toggling cells:", error);
  }
};