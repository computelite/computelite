import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
let sqlite

const log = (...args) => postMessage({type: 'log', payload: args.join(' ')});
const error = (...args) => postMessage({type: 'error', payload: args.join(' ')});

const connector = {}

// Initialize the database
function initDb(projectName,dbName) {
    try{
      const dbPath = `data/${projectName}/${dbName}.sqlite3`;
      let db;
      if ('opfs' in sqlite) {
        db = new sqlite.oo1.OpfsDb(dbPath);
      } else {
        db = new sqlite.oo1.DB(dbPath, 'ct');
      }   
  
      return db
    }catch(err){
      console.error(`Error while connectiong to DB file ${dbPath}`)
    }  
}


async function getCursor(projectName,dbName) {
  if (connector[`${projectName}.${dbName}`]) {
    return connector[`${projectName}.${dbName}`];
  }

  const connection = await initDb(projectName,dbName);
  if (!connector[`${projectName}.${dbName}`]) {
    connector[`${projectName}.${dbName}`] = connection;
  }
  return connection;
}

//  This method handles Sqlite CRUD operations . 

const handleDatabaseOperations = async (action,dbname,projName,query = null,params = null) => {
  if (projName){
    let db = await getCursor(projName,dbname)

    let result;
  
    try{
      if (action === 'fetchData'){
  
        result = readData(db,query,params);
  
      }else if (action === 'updateData'){
  
        result = updateData(db,query,params);
  
      }else if (action === 'insertData'){
        result = insertData(db,query,params);
  
      }else if (action === 'deleteData'){
  
        result = deleteData(db,query,params);
  
      } else if (action === 'executeQuery'){
  
        result = executeQuery(db,query,params)
  
      } else if (action === 'uploadModel'){
  
        result = await uploadModel(params[0],dbname,projName)
  
      }else if (action === 'attachModel'){
  
        result = await attachModel(params[0],dbname,projName)
  
      }else if(action === 'executeMany'){

        result = executeMany(db,query,params)

      }else if(action === 'tableData'){

        result = get_table_data(db)

      }else if (action === 'getData'){  

        result = getData(db,query,params);  

      } else{
  
        throw new Error('Unknown action type');
  
      }
      
      return result
    }catch(err){
      console.log(`Some Error occurred while handle operation ${action} in query ${query} : Error ${err} `)
      return {error:err}

    }  
  }else{
    throw new Error('No Project Available');
  }

};

//------------------------------------------------------------------------------------------------------



// ---------------------------------- Fetch Data from Database ------------------------------------------

const readData = (db,query,params) => {
  const columnnames = []

  // Execute the SQL query using the provided database instance (db)

  let result = db.exec({
      sql: query,  // SQL query to be executed
      bind:params, // Parameters to be bound to the SQL query
      rowMode:'array', // Specifies that each row in the result should be returned as an array or object
      returnValue:'resultRows', // Return the result rows from the query execution
      columnNames:columnnames  // This array will be populated with the column names from the query result
    });
  return result

};

//-------------------------------------------------------------------------------------------------------

const insertData = (db, query,params) => {
  db.exec({
    sql:query,
    bind:params
  })

  let last_insert_rowid = db.exec({
    sql: "SELECT last_insert_rowid()",
    rowMode:'array',
    returnValue:'resultRows'
  })
  return last_insert_rowid[0][0]
};



const updateData = (db,query,params) => {
  let result = db.exec({
      sql: query,
      bind:params,
    });
   
  let affectedRow_count = db.changes()

  return affectedRow_count
};

const executeQuery = (db,query,params) => {
  if (params && params[0] == 'script'){
    db.exec(query);
  }else{
    db.exec({
      sql:query
    })
  }
  let affectedRow_count = db.changes()
  return affectedRow_count?affectedRow_count:true
};

const executeMany = (db,query,params) => {
  let affectedRow_count = 0
  db.exec('BEGIN TRANSACTION;')
  
  try {
    const stmt = db.prepare(query);
    params.forEach((row,idx) => {
      try{
        stmt.bind(row)
        stmt.step();
        stmt.reset();
      }catch (ex){
        return `Invalid Row "${row}" at ${idx+2}th row, error ${ex}`;
      }
    });

    stmt.finalize();

    db.exec("COMMIT;");
    affectedRow_count = db.changes()
    
  } catch (error) {

    db.exec("ROLLBACK;");
    console.error("Error during insert:", error);
  }
  return affectedRow_count
};

const deleteData = (db,query,params) => {
  db.exec({
      sql: query,
      bind:params,
    });
    
  let affectedRow_count = db.changes()

  return affectedRow_count
};

const get_table_data = (db) =>{
  let columnNames = []
  let result = db.exec({
    sql: 'SELECT ROWID as id, * FROM D_ForecastOrderItem;',
    rowMode:'object',
    returnValue:'resultRows',
    columnNames:columnNames  
  });
  return result
}

const getData = (db,query,params) => {
  const columnnames = []

  // Execute the SQL query using the provided database instance (db)
  let result = db.exec({
      sql: query,  // SQL query to be executed
      bind:params, // Parameters to be bound to the SQL query
      rowMode:'array', // Specifies that each row in the result should be returned as an array or object
      returnValue:'resultRows', // Return the result rows from the query execution
      columnNames:columnnames  // This array will be populated with the column names from the query result
    });
  return [columnnames,...result]

};

// Function to replace the in-memory database with the uploaded file
const uploadModel = async (file, dbname,projectName) => {
  return new Promise(async (resolve, reject) => {
    
    const reader = new FileReader();

    reader.onload = async (event) => {
      const fileBuffer = new Uint8Array(event.target.result);

      try {        
        const dbPath = `/data/${projectName}/${dbname}.sqlite3`;
        sqlite.oo1.OpfsDb.importDb(dbPath, fileBuffer);
        
        
        try {
            let db = new sqlite.oo1.OpfsDb(dbPath);

            let allTableQuery = `SELECT name FROM sqlite_master WHERE type in ('table','view')` 
            let AllDBTables = readData(db,allTableQuery).map(arr => arr[0])

            let availableQuery = `SELECT TABLENAME FROM S_TableGroup`
            let availableTables = readData(db,availableQuery).map(arr => arr[0])

            for (let tblName of AllDBTables){
              if (!availableTables.includes(tblName)){
                let groupname = 'All Others'
                if (['S_TableGroup','S_TableParameters'].includes(tblName)){
                  groupname = 'Setups'
                }
                
                let insertQuery = `INSERT INTO S_TableGroup (GroupName, TableName, 
                TableDisplayName, TableType, ColumnOrder, Table_Status, Freeze_Col_Num) 
                VALUES ('${groupname}', '${tblName}', '${tblName}', 'Input', NULL, 'Active', NULL);`
                
                insertData(db,insertQuery)
              }
            }
        } catch (error) {
            console.error('Error executing SQL script:', error);
        }
      

        resolve(true);
      } catch (error) {
        console.error('Error replacing the database:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      console.error('File read error:', reader.error);
      reject(reader.error);
    };

    // Start reading the uploaded file
    reader.readAsArrayBuffer(file);
  });

};

// Function to replace the in-memory database with the uploaded file
const attachModel = async (file, dbname,projectName) => {
  return new Promise(async (resolve, reject) => {
    
    const reader = new FileReader();


    reader.onload = async (event) => {
      const fileBuffer = new Uint8Array(await file.arrayBuffer());


      try {        
        const dbPath = `/data/${projectName}/${dbname}.sqlite3`;   
        console.log('dbpath',dbPath)       
        console.log('filebuffer',fileBuffer)
        try {
          let db = new sqlite.oo1.OpfsDb(dbPath);
          sqlite.oo1.OpfsDb.importDb(dbPath, fileBuffer);        
  
        } catch (error) {
            console.error(error);
        }


        resolve(true);
      } catch (error) {
        console.error('Error replacing the database:', error);
        reject(error);
      }
    };


    reader.onerror = () => {
      console.error('File read error:', reader.error);
      reject(reader.error);
    };


    // Start reading the uploaded file
    reader.readAsArrayBuffer(file);
  });


};


onmessage = async(e) => {
  const { id, action, dbname, projectName,query, params } = e.data;
  if (action === 'init') {
    // Initialize the SQLite3 module with logging functions
    await sqlite3InitModule({
      print: log,
      printErr: error,
    }).then(async (module) => {
      sqlite = module; // Save the initialized module for later use

      // Send a success message back to the main thread
      postMessage({ id, success: true, result:{msg:'Success'} });
    }).catch((err) => {
      console.error('Failed to initialize SQLite3 in worker:', err);
    });
  }else if (sqlite){
    try {
      let result = await handleDatabaseOperations(action,dbname,projectName,query,params);
      if (result.error){
        postMessage({ id, success: false, error: result.error });
      }else{
        postMessage({ id, success: true, result });
      }
    } catch (error) {
      postMessage({ id, success: false, error: error.message });
    }
  }else{
    console.error('Unknown message type or SQLite3 module not initialized');
  }

};
