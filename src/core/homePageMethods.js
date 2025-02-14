import { executeQuery,checkTableExists } from "../assets/js/scc"

//  -----------------------  ADD NEW MODEL -------------------------------------------------------------
export async function addNewModel(data){
  const modelName = data.model_name
  const projectName = data.project_name
  const modelTemplate = data.model_template
  if (!localStorage.getItem('Projects')) {
    localStorage.setItem('Projects', JSON.stringify({}))
  }

  const opfsDir = await navigator.storage.getDirectory();
  const dataFolder = await opfsDir.getDirectoryHandle('data', { create: true });  
  const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: true });
  const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`,{create:true});
  

  const Projects = localStorage.getItem('Projects')
  let all_projects = JSON.parse(Projects)

  let scriptName = modelTemplate.toLowerCase().trim().replace(' ','_')
  
  let msg = 'Success'
  try {
      const sqlScript = Sample_DB;
      try {
        await executeQuery('executeQuery',modelName,sqlScript,['script'])
        if (Object.keys(all_projects).includes(projectName)) {
          if (!(modelName in all_projects[projectName]['Models'])){
            all_projects[projectName]['Models'][modelName] = { templateName: modelTemplate , status:'Active' }
          }else{
            return {msg:'Model already exists with same name'}
          }
        } else {
          all_projects[projectName] = {'Models':{ [modelName]: { templateName: modelTemplate , status:'Active' }},status:'Active' }
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
    throw new Error("Model Already Exists with the same name");
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
  return all_models
}

export async function getVersion(data) {
  let query = `select ParamValue from S_ModelParams where ParamName = 'DBVersion'`
  let result = await executeQuery('fetchData',data.model_name,query)
  return result[0][0]
}

export async function upgradeVersion(data){
  let modelName = data.modelName
  let version = data.version

  let msg = 'Success'
  try {
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

  } catch (error) {
      console.error(error);
  }
  return msg
}

const Sample_DB = `
BEGIN TRANSACTION;

CREATE TABLE T_QueryLogs (
	LogTime      VARCHAR DEFAULT (datetime('now', 'localtime') ),
	QuerySQL     VARCHAR,
	QueryMsg     VARCHAR
);

CREATE TABLE T_TaskLogs (
        ID              INTEGER PRIMARY KEY AUTOINCREMENT,
        TaskId          VARCHAR UNIQUE,
        TaskName        VARCHAR NOT NULL,
        ProcessId       VARCHAR,
        TaskStatus      VARCHAR,
        StartDate       VARCHAR DEFAULT (datetime('now', 'localtime') ),
        EndDate         VARCHAR,
        ErrorMsg        VARCHAR,
        Alerted         INTEGER DEFAULT (0),
        TaskDbId        VARCHAR,
        MasterTaskId    VARCHAR
);

CREATE TABLE T_SolverLog (
    LogTime    VARCHAR DEFAULT (datetime('now', 'localtime') ),
    LogMessage VARCHAR
);

CREATE TABLE S_ModelParams (
    ParamName    VARCHAR,
    ParamValue   VARCHAR
);

CREATE TABLE S_TableParameters (
    TableName      VARCHAR,
    ColumnName     VARCHAR,
    ParameterType  VARCHAR,
    ParameterValue VARCHAR,
    UNIQUE(TableName,ColumnName,ParameterType)
);

CREATE TABLE S_TableGroup (
    GroupName        VARCHAR,
    TableName        VARCHAR,
    TableDisplayName VARCHAR,
    TableType        VARCHAR,
    ColumnOrder      VARCHAR,
    Table_Status     VARCHAR,
    Freeze_Col_Num   NUMERIC
);

CREATE TABLE S_TaskMaster (
	TaskId	            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	TaskName	        VARCHAR,
	TaskDisplayName	    VARCHAR,
	TaskParameters	    VARCHAR,
	TaskStatus	        VARCHAR,
	TaskLastRunDate	    VARCHAR,
	TaskOutput	        VARCHAR
);

CREATE TABLE S_ExecutionFiles (
	FileId	            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	FileName	        VARCHAR,
	FileLabel   	    VARCHAR,
    FilePath            VARCHAR UNIQUE,
    FileData            VARCHAR,
	Status	            VARCHAR DEFAULT ('Active')	
);

CREATE TABLE S_DataFiles (
	FileId	            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	FileName	        VARCHAR,
	FileType   	        VARCHAR,
    FileBlob            BLOB NOT NULL,
	Status	            VARCHAR DEFAULT ('Active'),
    UNIQUE(FileName,FileType)	
);

CREATE TABLE S_PackageWheels (
	WheelId	            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	WheelName	        VARCHAR UNIQUE,
    WheelBlob            BLOB NOT NULL,
	Status	            VARCHAR DEFAULT ('Active')	
);

CREATE TABLE S_Notebook (
	CellId	        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	CellContent	    VARCHAR,
	CreationDate	VARCHAR DEFAULT (datetime('now','localtime'))
);

CREATE VIEW V_TEMPV
AS SELECT 1;


INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES ('Log Tables', 'T_TaskLogs', 'Task Logs', 'Task Logs', NULL, 'Active', NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES ('Log Tables', 'T_SolverLog', 'Solver Logs', 'Solver Logs', NULL, 'Active', NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES ('Setups', 'S_TableGroup', 'Table Group', 'Input', NULL, 'Active', NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES ('Setups', 'S_TableParameters', 'Table Parameters', 'Input', NULL, 'Active', NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES ('Setups', 'S_TaskMaster', 'Task Master', 'Input', NULL, 'Active', NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES ('Setups', 'S_ExecutionFiles', 'Code Files', 'Input', NULL, 'Active', NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES ('All Other', 'V_TEMPV', 'Temp View', 'Output', NULL, 'Active', NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES('All Other','S_DataFiles','Data Files','Input','["FileId","FileName","FileType","Status"]','Active',NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES('All Other','S_PackageWheels','PackageWheels','Input','["WheelId","WheelName","Status"]','Active',NULL);
INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES('All Other','S_Notebook','Notebook','Input',null,'Active',NULL);

INSERT INTO S_ModelParams (ParamName, ParamValue) VALUES ('ModelIcon', 'fas fa-cube');
INSERT INTO S_ModelParams (ParamName, ParamValue) VALUES ('ModelName', 'Sample DB');
INSERT INTO S_ModelParams (ParamName, ParamValue) VALUES ('DBVersion', '1.0.4');

INSERT INTO S_TaskMaster(TaskId, TaskName, TaskDisplayName) VALUES(1,'cats.py','Download Cats');
INSERT INTO S_TaskMaster(TaskId, TaskName, TaskDisplayName) VALUES(2,'dogs.py','Show Dog');

INSERT INTO S_ExecutionFiles VALUES(1,'main.py',NULL,'main.py',replace('from foo.bar import main as bar\nfrom foo.foo import main as foo\n\nprint("Hello from main.py")\nbar()\nfoo()','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(2,'bar.py',NULL,'foo/bar.py',replace('def main():\n    print("Hello from bar.py")','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(3,'foo.py',NULL,'foo/foo.py',replace('def main():\n    print("Hello from foo.py")','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(4,'requirements.txt',NULL,'requirements.txt',replace('urllib3\nPillow\npandas\nsqlite3\npulp\nhighspy','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(5,'dogs.py',NULL,'dogs.py',replace('# Sample code to display random dog images \nimport urllib3, json, os,io\nfrom pyodide.ffi import to_js\n\nurl = "https://random.dog/woof.json"\nresponse  = urllib3.request("GET", url)\nimg_url = response.json()[''url'']\n\nextension = ""\n\nwhile extension not in ("JPEG", "PNG", "JPG", "GIF"):\n    response  = urllib3.request("GET", url)\n    img_url = response.json()[''url'']\n    print(img_url)\n    extension = img_url.split(".")[-1].upper()\n\nresponse = urllib3.request("GET", img_url)\n\nbuf = io.BytesIO(response.data)\n\nto_js(buf.getvalue())','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(6,'cats.py',NULL,'cats.py',replace('# Sample code to download random cat images \nimport urllib3, os,io, shutil\nfrom pyodide.ffi import to_js\nfrom PIL import Image\n\n# This is the Output Dir, which is accessible from HomePage\noutput_dir = r''outputDir/''\n\nexpected_size_collage = (900, 900)\nexpected_size_image = (300, 300)\n\ncollage = Image.new("RGBA", expected_size_collage, color=(255,255,255,255))\nurl = "https://cataas.com/cat?type=square"\n\nfor h in range(0, expected_size_collage[1], expected_size_image[1]):\n    for w in range(0, expected_size_collage[0], expected_size_image[0]):\n        image_data  = urllib3.request("GET", url).data\n        image = Image.open(io.BytesIO(image_data)).convert("RGBA")\n\n        # Get the original image width and height\n        image_width = image.size[0]\n        image_height = image.size[1]\n\n        # Get how the width and height should be\n        width_factor = image_width / expected_size_image[0]\n        height_factor = image_height / expected_size_image[1]\n\n        image = image.resize(expected_size_image)\n\n        # Copy image to collage canvas\n        collage.paste(image, (w, h))\n\nout_collage = io.BytesIO()\ncollage.save(out_collage, "PNG")\n\n# Saving to outputDir, so it could be visible from HomePage "Files --> OutputFiles"\ncollage.save(''outputDir/cats.png'')\nout_collage.seek(0)\nto_js(out_collage.getvalue())','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(7,'list_input_files.py',NULL,'list_input_files.py',replace('import os\nprint(os.listdir("inputDir"))','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(8,'pandaas.py',NULL,'pandaas.py',replace('import sqlite3\nimport pandas as pd\n\n# thisDB is a keyword for current SQLite database\nconn = sqlite3.connect(thisDB)\n\ndf = pd.read_sql_query("SELECT * from sqlite_master", conn)\n\nall_tables = list(df[''tbl_name''][df.type == ''table''])\n\nfor table_name in all_tables:\n    query = f"select count(*) from [{table_name}]" \n    res = conn.execute(query).fetchall()\n    count = res[0][0]\n    if count > 0:\n        output_str = f"Table {table_name} has {count} records"\n        print(output_str)\n','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(9,'write_output_file.py',NULL,'write_output_file.py',replace('import os\\012\\012# This is the Output Dir, which is accessible from HomePage\\012output_dir = r''outputDir''\\012\\012input_file_name = f''{output_dir}/output_file.txt''\\012with open(input_file_name, ''w'') as fl:\\012    for i in range(100):\\012  	    fl.write(f''Hello from ComputeLite! count({i+1}) \n'')\\012    fl.close()\\012  \\012z = os.listdir(output_dir)\\012print(z)','\\012',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(10,'update_sqlite_db.py',NULL,'update_sqlite_db.py',replace('import sqlite3\n\nquery = "INSERT INTO T_SolverLog (LogMessage) Values (''Hello from ComputeLite'')"\n\nwith sqlite3.connect(thisDB) as conn:\n    conn.execute(query)\n  \n# Check solver log table: Log Tables > Solver Logs\n','\n',char(10)),'Active');
INSERT INTO S_ExecutionFiles VALUES(11,'blending_problem_with_pulp_highs.py',NULL,'blending_problem_with_pulp_highs.py',replace('# Import PuLP modeler functions\nfrom pulp import *\n\n# Create the ''prob'' variable to contain the problem data\nprob = LpProblem("The Whiskas Problem", LpMinimize)\n# The 2 variables Beef and Chicken are created with a lower limit of zero\nx1 = LpVariable("ChickenPercent", 0, None, LpInteger)\nx2 = LpVariable("BeefPercent", 0)\n\n# The objective function is added to ''prob'' first\nprob += 0.013 * x1 + 0.008 * x2, "Total Cost of Ingredients per can"\n\n# The five constraints are entered\nprob += x1 + x2 == 100, "PercentagesSum"\nprob += 0.100 * x1 + 0.200 * x2 >= 8.0, "ProteinRequirement"\nprob += 0.080 * x1 + 0.100 * x2 >= 6.0, "FatRequirement"\nprob += 0.001 * x1 + 0.005 * x2 <= 2.0, "FibreRequirement"\nprob += 0.002 * x1 + 0.005 * x2 <= 0.4, "SaltRequirement"\n\nsolver = HiGHS() #Define HiGHS solver, include highspy in requirement.txt\nprob.writeLP("outputDir/WhiskasModel.lp")\nprob.solve(solver) #Use HiGHS solver\nprint("Status:", LpStatus[prob.status])\n\nfor v in prob.variables():\n    print(v.name, "=", v.varValue)\n\nprint("Total Cost of Ingredients per can = ", value(prob.objective))','\n',char(10)),'Active');

COMMIT TRANSACTION;
`;

const version104 = `
CREATE TABLE S_Notebook (
	CellId	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	CellContent	VARCHAR,
	CreationDate	VARCHAR DEFAULT (datetime('now','localtime'))
);

INSERT INTO S_TableGroup (GroupName, TableName, TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) VALUES('All Other','S_Notebook','Notebook','Input',null,'Active',NULL);
`;

const versions = {"1.0.4":version104}