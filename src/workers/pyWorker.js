import { loadPyodide } from "pyodide";

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



self.onmessage = async (event) => {  
  
  const { id, action,code,projectName,modelName,files,fileName,blobFiles,wheelFiles = [] } = event.data;
  
  if (action == 'init'){
    // Initialize Pyodide and load necessary packages
    self.pyodide = await loadPyodide({
      indexURL:"https://cdn.jsdelivr.net/pyodide/v0.26.2/full",
      stdout  : pythonConsoleStdOut
    });

    // Load micropip for Python package management
    await self.pyodide.loadPackage(["micropip"]);
    self.micropip = self.pyodide.pyimport("micropip");

    // Prepare wheel packages
    let wheelPackages = []
    for (let wheel of wheelFiles){
      self.pyodide.FS.writeFile(wheel[0],wheel[1])
      wheelPackages.push(`emfs:/home/pyodide/${wheel[0]}`)
    }

    // Load available package wheels
    const res = await loadPackages(self.micropip,wheelPackages,[])
    if (!res.success){
      postMessage({ id, success: true, result:{msg:'Errored'} });
    }

    // Install specific Python wheel files
    await self.micropip.install('/wheels/apsw-3.46.1.0-cp312-cp312-pyodide_2024_0_wasm32.whl')
    await self.micropip.install('/wheels/PuLP-2.9.0-py3-none-any.whl')
    await self.micropip.install('/wheels/highspy-1.8.0-cp312-cp312-pyodide_2024_0_wasm32.whl')
    
    postMessage({ id, success: true, result:{msg:'Success'} });

  }else if (action =='loadDB'){
    self.projectName = projectName
    self.modelName = modelName
    postMessage({ id, success: true, result:{msg:'Success'} });

  }else if (action =='loadPackages'){

    // Load additional Python packages from requirements.txt
    const packages = code.split('\n')
    const res = await loadPackages(self.micropip,[],packages)
    if (!res.success){
      postMessage({ id, success: true, stdout:output,stderr:res.error });
    }else{
      postMessage({ id, success: true, result:{msg:'Success'} });
    }

  }else if (self.pyodide){

    // Setup input, output, and data directories
    const inpDirPath = '/home/pyodide/inputDir'
    const outDirPath = '/home/pyodide/outputDir'
    const dataDirPath = '/home/pyodide/data'    

    self.pyodide.globals.set("inputDir", inpDirPath);
    self.pyodide.globals.set("outputDir", outDirPath);

    self.pyodide.FS.mkdirTree(inpDirPath)
    self.pyodide.FS.mkdirTree(outDirPath)
    self.pyodide.FS.mkdirTree(dataDirPath)

    const fsModelPath = `${dataDirPath}/${modelName}.sqlite3`  
    await loadSQLiteFromOPFS(fsModelPath,modelName,projectName)

    // Write blob files to input directory
    for (let file of blobFiles){
      self.pyodide.FS.writeFile(`inputDir/${file[0]}`,file[1])
    }

    // Write execution files and handle requirements.txt
    let requirementPackages = []
    for (let file of files){
      const pathParts = file[0].split('/');
      pathParts.pop();
      if (file[0] != fileName && file[1]){ 
        if (file[0] === 'requirements.txt'){
          requirementPackages = file[1].split('\n')
        }
        const directoryPath = pathParts.join('/');     
  
        if (directoryPath){
          self.pyodide.FS.mkdirTree(`/home/pyodide/${directoryPath}`);
        }
        self.pyodide.FS.writeFile(file[0],file[1])    

      }
    }

    let wheelPackages = []
    for (let wheel of wheelFiles){
      self.pyodide.FS.writeFile(wheel[0],wheel[1])
      wheelPackages.push(`emfs:/home/pyodide/${wheel[0]}`)
    }

    // Load required packages
    const res = await loadPackages(self.micropip,wheelPackages,requirementPackages)
    if (!res.success){
      postMessage({ id, success: true, stdout:output,stderr:res.error });
    }

    self.pyodide.globals.set("thisDB", fsModelPath);
    
    try {
      // Execute Python code
      output = ''      
      const result = await self.pyodide.runPython(code);
            
      let blob = null

      // Check if the result is a Uint8Array
      if (result instanceof Uint8Array){
        blob = new Blob([result], { type: 'image/png' });
      }
      
      // Fetch output files
      let outputFiles = await readDir('/home/pyodide/outputDir')  
      
      // Save the updated database back to OPFS
      const updatedFile = self.pyodide.FS.readFile(fsModelPath); 
      await saveSQLiteToOPFS(modelName,projectName,updatedFile)
      postMessage({ id, success: true, stdout:output,stderr:'',blob:blob,outputFiles:outputFiles});
    } catch (error) {  
      // Save the updated database back to OPFS
      const updatedFile = self.pyodide.FS.readFile(fsModelPath); 
      await saveSQLiteToOPFS(modelName,projectName,updatedFile)    
      postMessage({ id, success: true, stdout:output,stderr: error.message });
    }

    // Clear global Python variables
    self.pyodide.runPython('globals().clear()');
    await self.pyodide.runPython(`
      import sys
      import os

      project_directory = os.path.abspath(os.getcwd())

      for module_name, module in list(sys.modules.items()):
          if hasattr(module, '__file__') and module.__file__ and module.__file__.startswith(project_directory):
              del sys.modules[module_name]
    `);
    
  }else{
    console.error('Unknown action or python module not initialized');
  }
  
};

