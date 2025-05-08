import { loadPyodide } from "pyodide";
import { patchMatplotlib } from "../assets/js/matplotlib";


let output = '';
function pythonConsoleStdOut( text ) {
  output += output ? ';'+text : text
  postMessage({ type: 'stdout', text })
}

async function readDir(dirPath) {
  let outputFiles = []
  const fileData = pyodide.FS.readdir(dirPath);
  const files = fileData.filter(item => item !== '.' && item !== '..' && !pyodide.FS.isDir(`${dirPath}/${item}`));
  for (const fileName of files) {
    const filePath = `${dirPath}/${fileName}`;
    const fileData = pyodide.FS.readFile(filePath);
    
    const blob = await new Blob([fileData]).arrayBuffer();
    const uint8Array = new Uint8Array(blob);
    outputFiles.push([fileName,uint8Array])    
  }  
  return outputFiles;
}

async function loadPackages(micropip,wheelPackages,requirementPackages) {
  let msg = {success:true,error:''}

  if (wheelPackages.length > 0){
    try{
      await micropip.install(wheelPackages)
    }catch (error){
      console.log('loading error',error)
      return {success:false,error:error}
    }
  }

  let initialPackages = []
  for (let packName of requirementPackages){
    if (packName.indexOf('==') > -1){
      packName = packName.split('==')[0].trim()
    }

    if (packName.trim()){
      initialPackages.push(packName.trim())
    }
  }

  if (initialPackages.length > 0){
    try{
      await micropip.install(initialPackages)
    }catch (error){
      console.log('loading error',error)
      return {success:false,error:error}
    }
  }
  return msg
}

async function loadSQLiteFromOPFS(modelPath,modelName,projectName) {
 
  let root = await navigator.storage.getDirectory();
  const dataFolder = await root.getDirectoryHandle('data', { create: true });
  const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: false });
  const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`)
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  self.pyodide.FS.writeFile(modelPath, uint8Array);
}

async function saveSQLiteToOPFS(modelName,projectName,file) {
  let root = await navigator.storage.getDirectory();
  const dataFolder = await root.getDirectoryHandle('data', { create: true });
  const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: false });
  const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`)
  const writable = await fileHandle.createSyncAccessHandle();

  await writable.write(file);
  await writable.close();
}

async function initializePyodide(eventData) {
  const { id,files,blobFiles, wheelFiles, drawCanvas,type } = eventData;

  self.pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.2/full",
    stdout: pythonConsoleStdOut,
  });
  await self.pyodide.loadPackage(["micropip"]);
  self.micropip = self.pyodide.pyimport("micropip");
  self.type = type;

  try{
    await self.micropip.install('https://cdn.jsdelivr.net/gh/computelite/computelite.github.io@main/wheels/highspy-1.9.0-cp312-cp312-pyodide_2024_0_wasm32.whl');
    await self.micropip.install('https://cdn.jsdelivr.net/gh/computelite/computelite.github.io@main/wheels/PuLP-3.0.2-py3-none-any.whl');
  }
  catch {
    console.log("HiGHS package not loaded")
  }

  self.DrawCanvas = new Function(`return (${drawCanvas})`)();
  globalThis.drawPyodideCanvas = (pixels, width, height) => {
    if (pixels && pixels.toJs) pixels = pixels.toJs();
    if (pixels instanceof Uint8ClampedArray || pixels instanceof Uint8Array) pixels = Array.from(pixels);

    self.postMessage({ type: 'canvas', pixels, width, height });
  };
  self.pyodide.registerJsModule("js", globalThis);
  setupFileSystem();
  if (eventData.type === 'notebook') { 
    await writeInputFiles(null, files, blobFiles,wheelFiles);  
  }
  postMessage({ id, success: true, result: { msg: 'Success' } });
}

function setupFileSystem() {
  const inpDirPath = '/home/pyodide/inputDir';
  const outDirPath = '/home/pyodide/outputDir';
  const dataDirPath = '/home/pyodide/data';

  self.pyodide.globals.set("inputDir", inpDirPath);
  self.pyodide.globals.set("outputDir", outDirPath);
  self.pyodide.FS.mkdirTree(inpDirPath);
  self.pyodide.FS.mkdirTree(outDirPath);
  self.pyodide.FS.mkdirTree(dataDirPath);
}

async function writeInputFiles(fileName,files,blobFiles,wheelFiles) {
  for (let file of blobFiles) {
    self.pyodide.FS.writeFile(`inputDir/${file[0]}`, file[1]);
  }
  const requirementPackages = [];
  for (let file of files) {
    const pathParts = file[0].split('/');
    pathParts.pop();

    if (file[0] && file[1]) {
      if (fileName != null && file[0] === fileName) continue;
      if (self.type == 'editor' && file[0] === 'requirements.txt') {
        requirementPackages.push(...file[1].split('\n'));
      }

      const directoryPath = pathParts.join('/');
      if (directoryPath) self.pyodide.FS.mkdirTree(`/home/pyodide/${directoryPath}`);
      self.pyodide.FS.writeFile(file[0], file[1]);
    }
  }

  const wheelPackages = [];
  for (let wheel of wheelFiles) {
    self.pyodide.FS.writeFile(wheel[0], wheel[1]);
    wheelPackages.push(`emfs:/home/pyodide/${wheel[0]}`);
  }
  const res = await loadPackages(self.micropip, wheelPackages, requirementPackages);
  if (!res.success) {
    postMessage({ id, success: true, stdout: output, stderr: res.error });
  }
}

async function importPackages(code) {
  let wasAlreadyLoaded = undefined;
  let msgBuffer = [];
  await self.pyodide.loadPackagesFromImports(code, {
    messageCallback: (msg) => {
      console.log('msg',msg);

      if (/Loaded.*\smatplotlib/.test(msg) || /^matplotlib.*loaded/.test(msg)) {
        patchMatplotlib(self.pyodide);
      }
      if (wasAlreadyLoaded === true) return;
  
      if (wasAlreadyLoaded === false) {
        if (/already loaded from default channel$/.test(msg)) {
          return; 
        }
        console.debug(msg);
      }
  
      if (wasAlreadyLoaded === undefined) {
        if (/already loaded from default channel$/.test(msg)) {
          wasAlreadyLoaded = true;
          return;
        }
        if (/^Loading [a-z\-, ]*/.test(msg)) {
          wasAlreadyLoaded = false;
          msgBuffer.forEach((m) => console.debug(m));
          console.debug(msg);
        }
      }
    }
  });
}

function extractMissingPackage(errorMessage) {
  const match = errorMessage.match(/ModuleNotFoundError: No module named '([^']+)'/);
  return match ? match[1] : null;
}

async function executePythonCode(eventData) {
  const { id, code, projectName, modelName, files, fileName, blobFiles,wheelFiles } = eventData;
  const fsModelPath = `/home/pyodide/data/${modelName}.sqlite3`;

  await loadSQLiteFromOPFS(fsModelPath, modelName, projectName);

  if (eventData.type === 'editor') { 
    await writeInputFiles(fileName, files, blobFiles,wheelFiles);  
  }else{
    await importPackages(code);
  }
  self.pyodide.globals.set("thisDB", fsModelPath);

  try {
    const { result, displayType, blob } = await runPythonCode(code, fsModelPath);
    const outputFiles = await readDir('/home/pyodide/outputDir');

    const updatedFile = self.pyodide.FS.readFile(fsModelPath);
    await saveSQLiteToOPFS(modelName, projectName, updatedFile);
    await deleteFileSystem(files);
    
    postMessage({ id, success: true, result:{display:displayType,value:result},stdout:output,stderr:'',blob, outputFiles });
    
  } catch (error) {
    if (extractMissingPackage(error.message)) {
      try{
        await self.micropip.install(extractMissingPackage(error.message));
        await executePythonCode(eventData);
        return;
      }catch (error){
        // console.log('weee',error)
      }
      
    }
    const updatedFile = self.pyodide.FS.readFile(fsModelPath);
    await saveSQLiteToOPFS(modelName, projectName, updatedFile);

    postMessage({ id, success: true, stdout: output, stderr: error.message });
  }
}

async function runPythonCode(code) {
  output = '';

  const result = await self.pyodide.runPythonAsync(code);
  let displayType = '';
  let blob = null;

  if (result instanceof self.pyodide.ffi.PyProxy) {
    if (result._repr_html_ !== undefined) {
      displayType = 'html';
      return { result: result._repr_html_(), displayType, blob };
    } else if (result._repr_latex_ !== undefined) {
      displayType = 'latex';
      return { result: result._repr_latex_(), displayType, blob };
    } else {
      displayType = 'default';
      return { result: result.__str__(), displayType, blob };
    }
  }

  if (result instanceof Uint8Array) {
    blob = new Blob([result], { type: 'image/png' });
  }

  return { result, displayType, blob };
}

self.onmessage = async (event) => {
  const { action } = event.data;
  switch (action) {
    case 'init':
      await initializePyodide(event.data);
      break;
    case 'loadDB':
      postMessage({ id: event.data.id, success: true, result: { msg: 'Success' } });
      break;
    case 'loadPackages':
      const res = await loadPackages(self.micropip, [], event.data.code.split('\n'));
      postMessage({
        id: event.data.id,
        success: res.success,
        stdout: output,
        stderr: res.error,
      });
      break;
    default:
      if (self.pyodide) await executePythonCode(event.data);
      else console.error('Unknown action or Pyodide not initialized');
      break;
  }
};

async function deleteFileSystem(files) {
  try {
    for (let file of files) {
      const noExt = file[0].replace(/\.py$/, "").replace(/\//g, ".");
      const safeModuleName = JSON.stringify(noExt);

      await pyodide.runPythonAsync(`
        import sys
        module_name = ${safeModuleName}
        if module_name in sys.modules:
          del sys.modules[module_name]
        `);
    }
  } catch (error) {
    console.error('Error deleting module:', error);
  }
}
