import { executeQuery,checkTableExists } from "../assets/js/scc"

//  -----------------------  ADD NEW MODEL -------------------------------------------------------------
export async function addNewModel(data){
  const modelName = data.model_name
  const projectName = data.project_name
  const modelTemplate = data.model_template
  const schema = data.schemas
  
  if (!(Object.keys(schema).includes(modelTemplate))){
    return {msg:"Invalid Model Template Selected"}
  }

  if (!localStorage.getItem('Projects')) {
    localStorage.setItem('Projects', JSON.stringify({}))
  }

  const opfsDir = await navigator.storage.getDirectory();
  const dataFolder = await opfsDir.getDirectoryHandle('data', { create: true });  
  const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: true });
  const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`,{create:true});
  

  const Projects = localStorage.getItem('Projects')
  let all_projects = JSON.parse(Projects)
  
  let msg = 'Success'
  try {
      
      const sqlScript = schema[modelTemplate];
      
      try {
        await executeQuery('executeQuery',modelName,sqlScript,['script'])
        if (Object.keys(all_projects).includes(projectName)) {
          if (!(modelName in all_projects[projectName]['Models'])){
            all_projects[projectName]['Models'][modelName] = { templateName: modelTemplate , status:'Active',modelId:null }
          }else{
            return {msg:'Model already exists with same name'}
          }
        } else {
          all_projects[projectName] = {'Models':{ [modelName]: { templateName: modelTemplate , status:'Active',modelId:null }},status:'Active' }
        }
        localStorage.setItem('Projects', JSON.stringify(all_projects))

      } catch (error) {
          console.error('Error executing SQL script:', error);
          msg = error
      }

  } catch (error) {
      console.error(error);
  }

  
  return {msg:msg}
}
  
//------------------------------------------------------------------------------------------------------

// Fetches table groups from the database

export async function fetchTableGroups(data) {
  let query = `select groupname, tablename, ifnull(tabledisplayname,tablename),table_status
               from S_TableGroup`
  let result = await executeQuery('fetchData',data.model_name,query)
  let table_dict = {}

  for (let row of result){
      if (row[0] in table_dict && row[3]=="Active"){
          table_dict[row[0]].push([row[1], row[2]])
      }else{
          if (row[3]=="Active"){
              table_dict[row[0]] = [[row[1], row[2]]] 
          }else{
              continue  
          }
      }
  }

  return table_dict
}

//------------------------------------------------------------------------------------------------------
  
//  -----------------------  Download MODEL -------------------------------------------------------------

export async function downloadModel(data){
  const modelName = data.model_name
  const projectName = data.project_name
  try {
    let filename = `${modelName}.sqlite3`

    // Access the OPFS directory
    const opfsDir = await navigator.storage.getDirectory();
    const dataFolder = await opfsDir.getDirectoryHandle('data', { create: false });
    const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: false });
    const fileHandle = await projectFolder.getFileHandle(filename);
    
    // Read the file from OPFS
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    
    // Create a Blob from the file contents
    const newBlob = new Blob([arrayBuffer], { type: "application/octet-stream" });
    
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

  } catch (error) {
    console.error("Error downloading database:", error);
  }
}

//------------------------------------------------------------------------------------------------------

//  -----------------------  Delete MODEL -------------------------------------------------------------

export async function deleteModel(data){
  const projectsDict = data.projects_dict
  const delOpt = data.del_opt
  const Projects = localStorage.getItem('Projects')
  let all_projects = JSON.parse(Projects)

  for (let key in projectsDict){

    for (let model of projectsDict[key]){
            
      if (Object.keys(all_projects[key]['Models']).includes(model)){
        if (delOpt){
          let filename = `${model}.sqlite3`
          try {
            
            // Check if the file exists
            try {
              const opfsDir = await navigator.storage.getDirectory();
              const dataFolder = await opfsDir.getDirectoryHandle('data', { create: false });
              const projectFolder = await dataFolder.getDirectoryHandle(`${key}`, { create: false });              
              const fileHandle = await projectFolder.getFileHandle(filename, { create: false });
              
              // Delete the database file
              await projectFolder.removeEntry(filename);
              
              delete all_projects[key]['Models'][model]
            } catch (error) {
              if (error.name === "NotFoundError") {
                console.error("Database file does not exist.");
              } else {
                throw error;
              }
            }
          } catch (error) {
            console.error("Error deleting database:", error);
          }
        }else{
          all_projects[key]['Models'][model]['status'] = 'Inactive'
        }
      }
    }
  }
  localStorage.setItem('Projects', JSON.stringify(all_projects))
}

//------------------------------------------------------------------------------------------------------

// Retrieves a list of inactive models

export async function getExistingModels(){
    const Projects = localStorage.getItem('Projects')
    let openProject = null
    let all_projects = null
    if (Projects){
      all_projects = JSON.parse(Projects)
      if (Object.keys(all_projects).length > 0){
        const projName = Object.keys(all_projects).filter(key => all_projects[key]['status'] === "Active");
        openProject =  projName[0]
    
      }
    }
  
  let hide_models = []
  if (openProject) {
    for (let model_name in  all_projects[openProject]['Models']){
        if (all_projects[openProject]['Models'][model_name]['status'] == 'Inactive'){
            hide_models.push([model_name,openProject,all_projects[openProject]['Models'][model_name]["templateName"],"SQLITE"])
        }
    }    
  }
  return hide_models
}

//------------------------------------------------------------------------------------------------------

// Activates inactive model stored in local storage

export async function addExistingModels(data){
  const modelList = data.model_list
    const Projects = localStorage.getItem('Projects')
    let openProject = null
    let all_projects = null
    if (Projects){
      all_projects = JSON.parse(Projects)
      if (Object.keys(all_projects).length > 0){
        const projName = Object.keys(all_projects).filter(key => all_projects[key]['status'] === "Active");
        openProject =  projName[0]
    
      }
    }
  
    for (let model of modelList){   
        if (Object.keys(all_projects[openProject]['Models']).includes(model)){          
            all_projects[openProject]['Models'][model]['status'] = 'Active'          
        }
    }
      
    localStorage.setItem('Projects', JSON.stringify(all_projects))
  
}

//------------------------------------------------------------------------------------------------------

// Saves a copy of an existing SQLite model under a new name and project.

export async function saveAsModel(data) {
  const model = data.model_name 
  const newModel = data.new_model_name
  const newProject = data.project_name
  const templateName = data.new_model_template
  // Validate the new model name 
  if (!stringValid(newModel)) {
    throw new Error("Invalid model name given");
  }

  const Projects = localStorage.getItem('Projects')
  let all_projects = JSON.parse(Projects)

  let dbPath = `/data/${newProject}/${newModel}.sqlite3`;
  if (newProject in all_projects && Object.keys(all_projects[newProject]['Models']).includes(newModel)){
    throw new Error("Model Already active with the same name");
  }else {

    all_projects[newProject]['Models'][newModel] = {templateName:templateName,status:'Active'}
    let query = `VACUUM INTO '${dbPath}'`
    const x = await executeQuery('executeQuery',model,query)
    if (x){
      localStorage.setItem('Projects', JSON.stringify(all_projects))
    }

  }
  
  return {'message':'Success'};
}

//------------------------------------------------------------------------------------------------------

function stringValid(string) {
  const pattern = /^[a-zA-Z0-9_]+$/;
  return pattern.test(string);
}

// Creates or updates a view in the SQLite database.

export async function checkOrCreateView(data){
  const modelName = data.model_name
  const viewName = data.view_name
  const viewQuery = data.view_query
  const isExist = data.isExist
  const createQuery = `CREATE VIEW [${viewName}] AS ${viewQuery}`;
  const tablegroupQuery = `INSERT INTO S_tablegroup (GroupName, TableName, TableDisplayName, TABLE_STATUS) VALUES (?, ?, ?, ?)`;

  try {
    await executeQuery('executeQuery',modelName,viewQuery);
  } catch (error) {
    throw new Error("Invalid query");
  }

  const rw = await checkTableExists(modelName,viewName); 
  if (rw) {
      if (isExist) {
          const dropQuery = `DROP VIEW [${viewName}]`;
          await executeQuery('executeQuery',modelName,dropQuery);
          await executeQuery('executeQuery',modelName,createQuery);
      } else {
          throw new Error("View already exists with this name. Please try with another name");
      }
  } else {
    await executeQuery('executeQuery',modelName,createQuery);
    await executeQuery('insertData',modelName,tablegroupQuery,['Views', viewName, viewName, 'Active']);
  }
}

//------------------------------------------------------------------------------------------------------


export async function getUserModels() {
  const Projects = localStorage.getItem('Projects')
  let all_models = []
  let all_projects;
  if (Projects) {
      all_projects = JSON.parse(Projects)
      if (all_projects) {
          for (let prj_name in all_projects) {
              if (all_projects[prj_name]['status'] == 'Active'){
                  for (let model_name in all_projects[prj_name]['Models']){
                      if (all_projects[prj_name]['Models'][model_name]['status'] == 'Active')
                      all_models.push([model_name,all_projects[prj_name]['Models'][model_name]["templateName"],prj_name,"SQLITE"])
                  }
              }
          }
      }
  }
  console.log('all models',all_models)
  return all_models
}

export async function getVersion(data) {
  let query = `select ParamValue from S_ModelParams where ParamName = 'DBVersion'`
  let result = await executeQuery('fetchData',data.model_name,query)
  return result[0][0]
}

export async function upgradeVersion(data){
  let modelName = data.modelName
  let current_version = data.current_version
  let db_version = data.db_version

  let msg = 'Success'
  try {
    for (let version in versions){
      if (isUpdateNeeded(current_version, db_version)){
        const sqlScript = versions[version]; // Retrieve the text content of the SQL script
        console.log('version script',sqlScript)
        try {
            await executeQuery('executeQuery',modelName,sqlScript,['script'])
  
            let query = `UPDATE S_ModelParams SET ParamValue = ? WHERE ParamName = ?`
            await executeQuery('updateData',modelName,query,[version,'DBVersion'])
        } catch (error) {
            console.error('Error executing SQL script:', error);
            msg = error
        }
      }
    }

  } catch (error) {
      console.error(error);
  }
  return msg
}

function isUpdateNeeded(currentVersion, requestedVersion) {
  const currentParts = currentVersion.split('.').map(Number);
  const requestedParts = requestedVersion.split('.').map(Number);	
  for (let i = 0; i < currentParts.length; i++) {
      if (requestedParts[i] < currentParts[i]) {
          return true; // Request version is lower, update is needed
      } else if (requestedParts[i] > currentParts[i]) {
          return false; // Request version is higher or equal, no update needed
      }
  }
  return false; // Versions are the same
}

const versions = {}

