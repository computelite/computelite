import * as ExcelJS from 'exceljs'
import { executeQuery ,tableInfo,checkTableExists} from "../assets/js/scc"

const PAGE_COUNT = 1000

// Fetches and formats column data for a table from database.

export async function fetchTableFormatter(modelName,tableName){
    let column_format = {}

    let query = `SELECT columnname, lower(parametertype), parametervalue
                    FROM S_TableParameters where lower(tablename) = ?`

    let result = await executeQuery('fetchData',modelName,query,[tableName.toLowerCase()])
    
    for (let row of result){
        if (!(row[1] in column_format)){
            column_format[row[1]] = {[row[0]]: row[2]}
        }else{
            column_format[row[1]][row[0]] = row[2]
        }
    }

    let type_view = await isViewTable(modelName,tableName)

    let freeze_col_num = await getFreezeColNum(modelName,tableName)

    let table_type = await getTableType(modelName,tableName)
   
    return [[column_format,type_view,freeze_col_num],table_type]
}

// ---------------------------------------------------------------------------------

// Checks if the current table is a view in the database.

async function isViewTable(modelName,tableName){
    let query = `SELECT type,sql FROM sqlite_master WHERE name = ?`
    let rw = await executeQuery('fetchData',modelName,query,[tableName])
    
    try{
        if (rw && rw[0][0]=="view"){
            query = String(rw[0][1])
            let qr = query.toUpperCase().replace("\n",' ').split(" AS ",1)
            return query.slice(qr[0].length+4)
        }        
    }catch{
        return false
    }
}

// ----------------------------------------------------------------------------------

// Retrieves the number of freeze columns for the table.
async function getFreezeColNum (modelName,tableName){
    let freeze_col_num = 0
    try{
        let query = `SELECT ifnull(freeze_col_num,0) FROM S_TableGroup WHERE lower(tablename) = ?`
        let rw = await executeQuery('fetchData',modelName,query,[tableName.toLowerCase()])

        if (rw && rw[0]){
            freeze_col_num = rw[0][0]
        }
    }catch{
        freeze_col_num = 0
    }
    return freeze_col_num

}

// --------------------------------------------------------------------------------------------------------------

// Determines if the table is an input table or a view and sets the editability accordingly.

async function getTableType(modelName,tableName) {
    let query = `SELECT 1 FROM sqlite_master WHERE type = 'view' AND  lower(name)=?`
    let rows = await executeQuery('fetchData',modelName,query,[tableName.toLowerCase()])
    if (rows.length > 0){
        return false
    }

    let sql_query = `select tabletype from S_TableGroup where lower(tablename) = ?`
    let rw = await executeQuery('fetchData',modelName,sql_query,[tableName.toLowerCase()])

    try{
        if(rw[0][0].toLowerCase() == 'input'){
            return true
        }
    }catch{
        return false
    }

}

// ----------------------------------------------------------------------------------

// Returns the primary column for the table if it is an input table, otherwise returns an empty array.

async function getPrimaryColumn(modelName,tableName){
    if (await getTableType(modelName,tableName)){   
        return [['rowid', 'PRIMARY', 1, 1]]
    }else{    
        return []
    }
}

// ----------------------------------------------------------------------------------

export async function fetchSort(modelName,tableName) {
    let query = `SELECT columnname,parametervalue FROM S_TableParameters WHERE tablename = ? AND
        parameterType = 'sort'`
    let data = await executeQuery('fetchData',modelName,query,[tableName])

    return data
}

// Retrieves and filters the columns data for a specific table.

export async function fetchColumnsData(modelName,tableName,headers_only = 1 ){
    let all_columns = []
    let allCols = await tableInfo(modelName,tableName)

    for (let col of allCols){
        all_columns.push(col)
    }
    if (headers_only == 0 ){
        return all_columns
    }

    let primary_columns = await getPrimaryColumn(modelName,tableName)

    let query = "select columnorder from S_TableGroup where lower(tablename) = ?"
    let res = await executeQuery('fetchData',modelName,query,[tableName.toLowerCase()])
    
    if (res && res.length > 0 && res[0][0] && JSON.parse(res[0][0])){
        let selected_col = []
        for (let i of JSON.parse(res[0][0])){
            selected_col.push(String(i))
        }

        let available_columns = []
        for (let i of all_columns){
            if (!(selected_col.includes(i[0]))){
                available_columns.push(i[0])
            }
        }

        let all_headers = []
        for (let i of all_columns){
            all_headers.push(i[0])
        }

        let selected_columns = []
        for (let col_name of selected_col){
            if (all_headers.includes(col_name)){
                selected_columns.push((all_columns[all_headers.indexOf(col_name)]))
            }
        }

        return [available_columns, primary_columns.concat(selected_columns)]
    }
    else{

        return [[], primary_columns.concat(all_columns)]
    }
}

// -------------------------------------------------------------------------------------------------

// Fetches data from a table based on various query parameters and pagination settings.

export async function fetchTableData(modelName,tableName,col_names,where_in={},where_not_in={},like_query={},page_num=1,sort_columns=[],limit=true,distinct=false){
    let order_query = ""
    
    if (sort_columns.length > 0){
        order_query = " ORDER BY"
        for (let colname of sort_columns){
            order_query += ` [${colname[0]}] ${colname[1]},`
        }            
        order_query = order_query.slice(0,-1)        
    }    
    
    if (page_num < 1){
        page_num = 1
    }
    
    let all_cols = await fetchColumnsData(modelName,tableName)
    all_cols = all_cols[1].reduce((acc, col) => {
        acc[col[0]] = col[1];
        return acc;
    }, {});
    
    const column_formatter = await fetchTableFormatter(modelName,tableName)
         
    const { params, whereQuery } = await getWhereQuery(modelName,tableName,where_in, where_not_in, like_query)
    
    let offset_query = `LIMIT ${PAGE_COUNT} OFFSET ${(page_num-1) * PAGE_COUNT}`
    
    if (!limit){
        offset_query = ''
    }

    let col_query = '';
    col_names.forEach((colname, idx) => {
        if (all_cols[colname] === 'NUMERIC') {
            if (column_formatter[0][0]?.lov?.[colname] === 'Date') {
                col_query += `DATE(( ${colname} - 25569) * 86400 , 'unixepoch'), `;
            } else if (column_formatter[0][0]?.lov?.[colname] === 'Datetime') {
                col_query += `DATETIME(( ${colname} - 25569) * 86400 , 'unixepoch'), `;
            } else {
                col_query += `[${colname}], `;
            }
        } else {
            col_query += `[${colname}], `;
        }
    });
    col_query = col_query.trim().replace(/,$/, '');

    const query = `
        SELECT ${distinct ? 'DISTINCT' : ''} ${col_query}
        FROM [${tableName.toLowerCase()}]
        WHERE 1 = 1 ${whereQuery} ${order_query}
        ${offset_query}
    `;
    
    let data_rows = await executeQuery('fetchData',modelName,query,params)
    
    let ct = data_rows.length
    if (ct == PAGE_COUNT && !distinct){
        let count_query = `SELECT count(*) FROM [${tableName}] WHERE 1 = 1 ${whereQuery}`
        ct = await executeQuery('fetchData',modelName,count_query,params)
        ct = ct[0]
    }else{
        ct = ((page_num-1) * PAGE_COUNT) + ct
    }    
    
    let table_data = [data_rows, ct]
    
    return table_data
}

// Constructs the WHERE clause and parameters for SQL queries based on provided filters.
export async function getWhereQuery(modelName,tableName,whereIn, whereNotIn, likeQuery) {
    const column_formatter = await fetchTableFormatter(modelName,tableName)
    const cnamesCtypes = {};
    const tbl_info = await tableInfo(modelName,tableName);

    tbl_info.forEach(row => {
        cnamesCtypes[row[0]] = row[1];
    });

    let params = [];
    let whereQuery = "";
    for (let cname in whereIn) {
        let c_name =` [${cname}]`;
        if (column_formatter[0][0]?.lov?.[cname] === 'Date') {
            c_name = `DATE(( [${cname}] - 25569) * 86400 , 'unixepoch')`;                    
        } else if (column_formatter[0][0]?.lov?.[cname] === 'Datetime') {
            c_name = `DATETIME(( [${cname}] - 25569) * 86400 , 'unixepoch')`;
        }

        if (whereIn[cname].length > 0) {
            if (whereIn[cname].includes("null") && whereIn[cname].length === 1) {
                whereQuery += ` AND ${c_name} is null`;
            } else if (whereIn[cname].includes("null")) {
                whereQuery += ` AND (${c_name} is null or ${cname} in (${whereIn[cname].map(() => '?').join(',')}))`;
                params = params.concat(whereIn[cname]);
            } else {
                whereQuery += ` AND ${c_name} in (${whereIn[cname].map(() => '?').join(',')})`;
                params = params.concat(whereIn[cname]);
            }
        }
    }

    for (let cname in whereNotIn) {
        let c_name =` [${cname}]`;
        if (column_formatter[0][0]?.lov?.[cname] === 'Date') {
            c_name = `DATE(( [${cname}] - 25569) * 86400 , 'unixepoch')`;                    
        } else if (column_formatter[0][0]?.lov?.[cname] === 'Datetime') {
            c_name = `DATETIME(( [${cname}] - 25569) * 86400 , 'unixepoch')`;
        }
        if (whereNotIn[cname].length > 0) {
            if (!whereNotIn[cname].includes("null")) {
                whereQuery += ` AND (${c_name} is null or ${c_name} not in (${whereNotIn[cname].map(() => '?').join(',')}))`;
                params = params.concat(whereNotIn[cname]);
            } else {
                whereQuery += ` AND ${c_name} not in (${whereNotIn[cname].map(() => '?').join(',')})`;
                params = params.concat(whereNotIn[cname]);
            }
        }
    }

    for (let cname in likeQuery) {
        let c_name =` [${cname}]`;
        if (column_formatter[0][0]?.lov?.[cname] === 'Date') {
            c_name = `DATE(( [${cname}] - 25569) * 86400 , 'unixepoch')`;                    
        } else if (column_formatter[0][0]?.lov?.[cname] === 'Datetime') {
            c_name = `DATETIME(( [${cname}] - 25569) * 86400 , 'unixepoch')`;
        }
        if (likeQuery[cname].length > 0) {
            if (likeQuery[cname][0] === "=") {
                whereQuery += ` AND lower(${c_name}) = ?`;
                params.push(likeQuery[cname].substring(1));
            } else if (["<", ">", "="].includes(likeQuery[cname][0]) && cnamesCtypes[cname].toLowerCase() === "numeric") {
                if (likeQuery[cname][1] === "=") {
                    whereQuery += ` AND ${c_name} ${likeQuery[cname].substring(0, 2)} ?`;
                    params.push(likeQuery[cname].substring(2));
                } else {
                    whereQuery += ` AND ${c_name} ${likeQuery[cname][0]} ?`;
                    params.push(likeQuery[cname].substring(1));
                }
            } else {
                whereQuery += ` AND lower(${c_name}) LIKE ?`;
                params.push(`%${likeQuery[cname].toLowerCase()}%`);
            }
        }
    }

    return { params, whereQuery };
}

// ------------------------------------------------------------------------------------------------------------------------------------

// Updates a specific row in a table with new values.
export async function updateRow(modelName,tableName,rowid,updateDict,primaryCol) {

    let params = [];
    let query = `UPDATE [${tableName}] SET `;

    for (let colName in updateDict) {
        query += ` [${colName}] = ?,`;
        if (updateDict[colName] === "") {
            params.push(null);
        } else {
            params.push(updateDict[colName]);
        }
    }

    query = query.slice(0, -1) + ` WHERE ${primaryCol} = ?`;
    params.push(rowid);
    
    const result = await executeQuery('updateData',modelName,query,params);
    let ct = result.rowCount;
    if(result){
        ct = 1  // Change this code accordingly
    }
    
    return ct;
}

//  --------------------------------------------------------------------------------------------------

// Inserts a new row into the specified table in the database.
export async function insertRow(modelName,tableName,data){
    const colNames = [];
    const params = [];

    for (const colName in data) {
        if (data[colName] && data[colName] !== "") {
            colNames.push(colName);
            params.push(data[colName]);
        }
    }

    const query = `INSERT INTO [${tableName.toLowerCase()}] (${colNames.map(col => `[${col}]`).join(',')})
                   VALUES (${colNames.map(() => '?').join(',')})`;
    
    try {
        const last_insert_rowid = await executeQuery('insertData',modelName,query,params)
        return {"Success": last_insert_rowid}
    } catch (ex) {
        return { "Error": ex.toString() };
    }

}

//  --------------------------------------------------------------------------------------------------


export async function runSelectQuery(modelName, query) {
    let resultList = [];
    try {
        let rows = await executeQuery('fetchData',modelName,query)

        rows.forEach(row => {
            if (row[0]) {
                resultList.push(row[0]);
            }
        });

        // Remove duplicates using Set and sort the array
        resultList = Array.from(new Set(resultList)).sort();

        return resultList;
    } catch (ex) {
        return resultList;
    }
}

// Deletes rows from a specified table based on various conditions.

export async function deleteRows(modelName,tableName,where_in,where_not_in,like_query,rowid_list,in_flag,primary_col) {

    let { params, whereQuery } = await getWhereQuery(modelName,tableName,where_in, where_not_in, like_query);
    
    let query = `DELETE FROM [${tableName.toLowerCase()}] WHERE 1 = 1 ${whereQuery}`;
    
    if (rowid_list.length > 0) {
        const placeholders = rowid_list.map(() => '?').join(',');
        query += ` AND ${primary_col} ${in_flag ? 'IN' : 'NOT IN'} (${placeholders})`;
        params = params.concat(rowid_list);
    }   
    
    let rowCount = await executeQuery('deleteData',modelName,query,params)

    return rowCount;
}

//  --------------------------------------------------------------------------------------------------


// Retrieves summary statistics (aggregates) for specified columns in a table.

export async function getSummary(modelName, tableName, colNames, whereIn, whereNotIn, likeQuery) {
    let aggregateDict = {};

    colNames.forEach(colName => {
        aggregateDict[colName] = 'SUM';
    });

    
    let query = `SELECT lower(ifnull(parametervalue, 'SUM')) 
                FROM S_TableParameters 
                WHERE lower(tablename) = ? AND lower(columnname) = ? 
                AND lower(parametertype) = lower('aggregate')`;

    for (const colName of colNames) {
        const result = await executeQuery('fetchData',modelName,query,[tableName.toLowerCase(),colName.toLowerCase()])
        
        if (result && ['sum', 'count', 'min', 'max', 'avg'].includes(result[0])) {
            aggregateDict[colName] = result[0];
        }
    }
    const { params, whereQuery } = await getWhereQuery(modelName,tableName,whereIn, whereNotIn, likeQuery);

    query = `SELECT ${colNames.map(colName => `${aggregateDict[colName]}([${colName}])`).join(', ')} 
             FROM [${tableName}] 
             WHERE 1=1 ${whereQuery}`;

    
    let summary = await executeQuery('fetchData',modelName,query,params);

    return summary[0];
}

//  --------------------------------------------------------------------------------------------------

// Updates the column order of a specified table in the database.

export async function updateColumnOrders(modelName,tableName,col_list){
    let query = `UPDATE S_TableGroup set columnorder = ? where lower(tablename) = ?`;    
    let result = await executeQuery('fetchData',modelName,query,[JSON.stringify(col_list),tableName.toLowerCase()]);
    return true
}

//  --------------------------------------------------------------------------------------------------

// Adds a new column to a specified table and updates the column order.

export async function addNewColumn(modelName,tableName,col_name, col_type){
    let column_type = 'VARCHAR'
    if (col_type == 2){
        column_type = 'NUMERIC'
    }
   
    let query = `Alter table [${tableName}] Add [${col_name}] ${column_type} null`
    await executeQuery('updateData',modelName,query)


    query = "select columnorder from S_TableGroup where lower(tablename) = ?"
    const res = await executeQuery('fetchData',modelName,query,[tableName.toLowerCase()])
    if (res[0] && res[0][0]){
        let col_list = JSON.parse(res[0])
        col_list.push(col_name)
        query = `UPDATE S_TableGroup set columnorder = ? where lower(tablename) = ?`
        await executeQuery('updateData',modelName,query,[JSON.stringify(col_list),tableName.toLowerCase()])
    }
    return {'message':'Success'}
}

//  --------------------------------------------------------------------------------------------------

// Deletes a column from a specified table.

export async function deleteColumn(modelName,tableName,col_name){
    const query = `ALTER TABLE ${tableName} DROP COLUMN [${col_name}]`;
    let msg = "Success"
    try {
        await executeQuery('updateData',modelName,query);
    } catch (error) {
        if (error instanceof ReadOnlyError) {
            msg = 'Sorry! You have Read Only access.'
        } else {
            msg = "Sorry, this column is used in a View."
        }
    }

    return {'message':msg}
}

//  --------------------------------------------------------------------------------------------------

// Sets formatting parameters for a specific table and column.

export async function setTableFormatter(modelName,tableName,colName,parameterDict){
    if (! checkTableExists(modelName,tableName)){
        let col_names = ['TableName','ColumnName','ParameterType','ParameterValue']
        let col_types = ['VARCHAR','VARCHAR','VARCHAR','VARCHAR']
        await createTable(modelName,'S_TableParameters', col_names, col_types)
    }

    let param_cond = '=='
    if ('LOV' in parameterDict){
        param_cond = '!='
    }

    let query = `DELETE FROM S_TableParameters WHERE tablename = ? and columnName = ?
                        and lower(parameterType) ${param_cond} 'lov' `
    await executeQuery('deleteData',modelName,query, [tableName, colName])

    for (const pname in parameterDict) {
        let query = `INSERT INTO S_TableParameters (tableName, columnName, parameterType, parameterValue)
                VALUES (?, ?, ?, ?) 
                ON CONFLICT (tableName,columnName,parameterType)
                DO UPDATE SET parameterValue = ?`
        const last_insert_rowid = await executeQuery('insertData',modelName,query,[tableName,colName,pname,parameterDict[pname],parameterDict[pname]])

    }
    return true
}

//  --------------------------------------------------------------------------------------------------

// Updates a specific column in a table based on various conditions.

export async function updateCol(modelName,tableName,whereIn,whereNotIn,likeQuery,rowIdList,inFlag,primaryCol,colName,colVal){
    if (String(colVal) == ""){
        colVal = null
    }
    
    const { params, whereQuery } = await getWhereQuery(modelName,tableName,whereIn, whereNotIn, likeQuery)
    let query = `UPDATE [${tableName}] SET [${colName}] = ? WHERE 1 = 1 ${whereQuery}`;
    let params_new = [colVal].concat(params);

    if (rowIdList.length > 0) {
        query += ` AND ${primaryCol} ${inFlag ? "IN" : "NOT IN"} (${rowIdList.map(() => '?').join(',')})`;
        params_new = params_new.concat(rowIdList);
    }
    
    const result = await executeQuery('updateData',modelName,query,params_new);
    
    return result
}

//  --------------------------------------------------------------------------------------------------

// Saves the sort order for columns in a specified table.

export async function saveSortColumns(modelName,tableName,sortColumns){
    let query = `DELETE FROM S_TableParameters WHERE tablename = ? AND ParameterType = 'sort'`
    let rowCount = await executeQuery('deleteData',modelName,query,[tableName])

    const insertQuery = `INSERT INTO S_TableParameters (tableName, columnname, parameterType, parametervalue) VALUES (?, ?, ?, ?)`;

    sortColumns.forEach(async col => {
        await executeQuery('insertData',modelName,insertQuery,[tableName, col[0], 'sort', col[1]])
    });

}

//  --------------------------------------------------------------------------------------------------

// Updates the number of frozen columns for a specified table.

export async function freezeColNum(modelName,tableName,colNum){
    let query = "UPDATE S_TableGroup SET freeze_col_num = ? WHERE tablename = ? "
    await executeQuery('updateData',modelName,query,[colNum,tableName]);
}

//  --------------------------------------------------------------------------------------------------

// Generates and downloads an Excel file with data from specified tables, applying formatting based on
//  table parameters.

export async function downloadExcel(modelName, tableNames = [], tableGroups = [""], empty_check = false) {
    const maxRowAllow = 1048575;

    // Get tables from the given groups
    const placeholders = tableGroups.map(() => '?').join(',');
    const query = `SELECT tablename, LOWER(table_status) as table_status 
                   FROM S_TableGroup WHERE groupname IN (${placeholders})`;

    const rows = await executeQuery('fetchData', modelName, query, tableGroups);

    // Add valid tables to tableNames (even if empty)
    for (const row of rows) {
        const [tableName, status] = row;
        if (status === 'active' && await checkTableExists(modelName, tableName)) {
            tableNames.push(tableName);
        }
    }

    // Remove duplicates
    tableNames = [...new Set(tableNames)];

    const workbook = new ExcelJS.Workbook();
    const numFormats = {
        'EUR': '[$€-1809]0',
        'INR': '[$₹-4009]0',
        'USD': '[$$-409]0',
        'JPY': '[$￥-411]0',
        'GBP': '[$£-809]0',
        'CNY': '[$￥-804]0',
        'ZAR': '[$R-1C09]0',
        'CHF': '[$CHF-100C]0'
    };

    const boldFont = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F3' } },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    for (const tableName of tableNames) {
        const dataQuery = `SELECT * FROM [${tableName}] LIMIT ${maxRowAllow}`;
        const rows = await executeQuery('fetchData', modelName, dataQuery);

        if (!empty_check && rows.length === 0) continue;

        const formatQuery = `SELECT columnname, parametertype, parametervalue 
                             FROM S_TableParameters 
                             WHERE tablename = '${tableName}' 
                             AND LOWER(parametertype) IN ('currency', 'decimals', 'comma', 'lov')`;
        const formatSettings = await executeQuery('fetchData', modelName, formatQuery);

        const newColNames = new Set();
        const colFormat = {}, decimals = {}, comma = [], percent = [];
        const dateCols = [], datetimeCols = [];

        formatSettings.forEach(([col, type, val]) => {
            const lowerType = type.toLowerCase();
            if (lowerType === 'currency' && val !== '0') {
                colFormat[col] = val;
                newColNames.add(col);
            } else if (lowerType === 'decimals') {
                decimals[col] = val;
                newColNames.add(col);
            } else if (lowerType === 'comma') {
                if (val === '2') percent.push(col);
                comma.push(col);
                newColNames.add(col);
            } else if (lowerType === 'lov') {
                if (val.toLowerCase() === 'date') dateCols.push(col);
                else if (val.toLowerCase() === 'datetime') datetimeCols.push(col);
                newColNames.add(col);
            }
        });

        const worksheet = workbook.addWorksheet(tableName);
        const table_info = await tableInfo(modelName, tableName);

        let worksheetCols = [];
        const colNames = {};
        const colIndex = [], numFormatsList = [];

        // Set headers and styles
        table_info.forEach(([colName], j) => {
            const width = Math.ceil(colName.length * 1.3);
            worksheetCols.push({ header: colName, key: colName, width });
            worksheet.getRow(1).getCell(j + 1).style = boldFont;
            if (newColNames.has(colName)) colNames[colName] = j;
        });

        worksheet.columns = worksheetCols;

        // Set number/date formats
        Object.keys(colNames).forEach(colName => {
            let fmt = "";
            if (comma.includes(colName)) {
                if (percent.includes(colName)) fmt += "%";
                else if (colFormat[colName]) fmt += numFormats[colFormat[colName]];
                fmt = fmt ? fmt.slice(0, -1) + "#,##" : "#,##";
            }
            if (decimals[colName]) {
                const zeros = "0".repeat(parseInt(decimals[colName], 10));
                fmt += `0.${zeros}`;
                if (percent.includes(colName)) fmt += "%";
            }
            if (dateCols.includes(colName)) fmt = 'yyyy-mm-dd';
            else if (datetimeCols.includes(colName)) fmt = 'yyyy-mm-dd HH:mm:ss';

            numFormatsList.push(fmt);
            colIndex.push(colNames[colName]);
        });

        // Populate data rows
        if (rows.length > 0) {
            rows.forEach((row, i) => {
                Object.values(row).forEach((value, j) => {
                    const cell = worksheet.getRow(i + 2).getCell(j + 1);
                    cell.value = value;
                    if (colIndex.includes(j)) {
                        cell.numFmt = numFormatsList[colIndex.indexOf(j)];
                    }
                });
            });
        }
    }

    // Finalize download
    const fileName = tableNames.length > 1 ? `${modelName}.xlsx` : `${tableNames[0]}.xlsx`;
    // Write the workbook to a buffer and create a Blob
    const buffer = await workbook.xlsx.writeBuffer();
    const newBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // IE doesn't allow using a blob object directly as link href
    // instead it is necessary to use msSaveOrOpenBlob
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(newBlob);
        return;
    }

    // For other browsers: 
    // Create a link pointing to the ObjectURL containing the blob.
    const data = window.URL.createObjectURL(newBlob);
    const link = document.createElement('a');
    link.href = data;
    link.download = fileName;
    link.click();
    setTimeout(() => window.URL.revokeObjectURL(data), 1000);
}


//  --------------------------------------------------------------------------------------------------

// Uploads data from an Excel file

export async function uploadExcel(modelName, tableNames, file, excelInfo = {}) {
    const msgList = {};
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);

    for (const newSheetName of workbook.worksheets) {
        const sheetName = newSheetName.name.trim();

        if (Object.keys(excelInfo).length > 0 && excelInfo[sheetName] === 'ignore') {
            continue;
        }

        const sheet = newSheetName;

        const sheetHeaders = [];
        sheet.getRow(1).eachCell((cell, colNumber) => {
            const header = cell.value?.toString().trim();
            if (header) sheetHeaders.push(header);
        });

        if (sheetHeaders.length === 0) {
            msgList[sheetName] = "No valid headers found";
            continue;
        }

        if (Object.keys(excelInfo).length > 0 && excelInfo[sheetName] === 'createAndUpload') {
            msgList[sheetName] = await createAndImportTable(modelName, sheetName, sheet, sheetHeaders);
            continue;
        }
        
        const tableHeaders = await fetchColumnsData(modelName,sheetName,0);
        const columnFormatter = await fetchTableFormatter(modelName,sheetName);

        let colList = []
        for (let colName of tableHeaders){
            if (sheetHeaders.includes(colName[0])){
                colList.push(['['+colName[0]+']', colName[1], colName[2],
                    sheetHeaders.indexOf(colName[0]), colName[0]]) 
            }
        }
        
        if (colList.length == 0){
            msgList[sheetName] = 'No column matches with existing table'
            continue
        }
        let dateColumns = []
        let col_formatter = columnFormatter[0][0]

        for (let [idx,col] of colList.entries()){

            if (col_formatter['lov'] && col_formatter['lov'][col[4]] && col_formatter['lov'][col[4]].toLowerCase()==='date'){
                dateColumns.push(idx)
            }
        }
        
        const deleteQuery = `DELETE FROM [${sheetName}]`;
        await executeQuery('deleteData', modelName, deleteQuery);

        let values = []

        for (let j = 2; j <= sheet.rowCount; j++) {
            const newRow = sheet.getRow(j);
            const newTpl = colList.map(i => {
                const cell = newRow.getCell(i[3] + 1)
                const cellValue = cell.value;
                if (!cellValue && cellValue !== '0') return null;    
                if (i[1] === 'VARCHAR' && typeof cellValue === 'number') return getVarcharVal(cellValue);
                if (i[1] === 'NUMERIC' && cell.model.type === 4) return getNumericVal(cellValue);
                return cellValue;
            });

            const dataRow = newTpl.map((val, idx) => {
                if (checkValue(val)) {
                    if (typeof val === 'object'){
                        try{
                            const date = new Date(val)
                            return convertDate(date)
                        }catch{
                            return val
                        }
                    }else{
                        return val
                    }
                }
                return null
            })

            let breakLoop = false;
            for (let idx = 0; idx < colList.length; idx++) {
                const colName = colList[idx];
                
                if (colName[1].toLowerCase() === 'numeric' && getDataType(newTpl[idx]) === 0) {
                    msgList[sheetName] = `Invalid Value "${newTpl[idx]}" at location (${j},${idx + 1}) for sheet ${sheetName}, expecting numeric value`;
                    breakLoop = true;
                    break;
                } else if (colName[1].toLowerCase() === 'integer' && getIntDataType(newTpl[idx]) === 0) {
                    msgList[sheetName] = `Invalid Value "${newTpl[idx]}" at location (${j},${idx + 1}) for sheet ${sheetName}, expecting integer value`;
                    breakLoop = true;
                    break;
                }
            }

            if (breakLoop) {
                break;
            }

            values.push(dataRow)
        }

        // If no data rows, insert one row with all nulls to preserve the header
        if (values.length === 0) {
            values.push(colList.map(() => null));
        }

        const header = colList.map(col => col[0]);
        const insertQuery = `INSERT INTO [${sheetName}](${header.join(',')}) VALUES(${header.map(() => '?').join(',')})`;

        try {
            await executeQuery('executeMany', modelName, insertQuery, values);
        } catch (ex) {
            msgList[sheetName] = `Error inserting rows in sheet ${sheetName}: ${ex}`;
            continue;
        }

        if (!msgList[sheetName]) {
            msgList[sheetName] = values.length === 1 && sheet.rowCount === 1
                ? "Only header inserted"
                : sheet.rowCount - 1;
        }
    }

    return msgList;
}


export async function get_uploadExcel_info(modelName,tableNames,file){
    const newTables = {}
    if (tableNames.length === 0) {
        const dbTableNames = {}
        const query = `SELECT sm.name, t2.tabletype
                        FROM sqlite_master sm
                        LEFT JOIN S_TableGroup t2 ON sm.name = t2.TableName
                        WHERE sm.type = 'table';`;
        const rows = await executeQuery('fetchData',modelName,query);
        rows.forEach(row => dbTableNames[row[0]] = row[1]);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file);
    
        
        for (const newSheetName of workbook.worksheets) {
            const sheetName = newSheetName.name.trim();
            if (sheetName in dbTableNames){
                newTables[sheetName] = ['Exist',dbTableNames[sheetName]]
            }else{
                newTables[sheetName] = ['New',dbTableNames[sheetName]]
            }
        }
    }

    return newTables

}

//  --------------------------------------------------------------------------------------------------

// Converts a numeric value to a VARCHAR representation by removing trailing decimal places if they 
// are zero.

function getVarcharVal(val) {
    const [intPart, decimalPart] = val.toString().split('.');
    if (decimalPart === '0') return intPart;
    return val.toString();
}

//  --------------------------------------------------------------------------------------------------

// Checks if a value is valid.

function checkValue(value) {
    return value !== null && value !== undefined;
}

//  --------------------------------------------------------------------------------------------------

// Creates or update a table in the database and imports data from an Excel sheet into it.

async function createAndImportTable(modelName, tableName, sheet, sheetHeaders) {
    const colTypes = [];
    const colNames = [];
    const dateColumns = []

    try {
        if (sheetHeaders.length === 0) {
            throw new Error("First row is empty");
        }

        // Determine column types based on sample data
        sheetHeaders.forEach(async (header, idx) => {
            const tempTpl = [];
            let isDateColumn = false;
            for (let j = 2; j < Math.min(sheet.rowCount, 500); j++) {
                if (sheet.getRow(j).getCell(idx + 1).model.type === 4){
                    isDateColumn = true
                    break
                }
                tempTpl.push(sheet.getRow(j).getCell(idx + 1).value);
            }
            
            if (isDateColumn){
                dateColumns.push(header)
                colTypes.push('NUMERIC')
            }else{
                colTypes.push(getColumnType(tempTpl));
            }
            colNames.push(`[${header.trim()}]`);
        });

        let query3 = `INSERT INTO [${tableName}](${colNames.join(',')}) VALUES (${colNames.map(() => '?').join(',')})`;
        
        // Create the table 
        await createTable(modelName,tableName, colNames, colTypes)
1
        const ncol = colTypes.length;
        let values = []
    
        for (let j = 2; j <= sheet.rowCount; j++) {
            const newTpl = Array.from({ length: ncol }, (_, i) => {
                const cell = sheet.getRow(j).getCell(i + 1)
                const cellValue = cell.value;
                if (!cellValue && cellValue != 0) return null;
                if (colTypes[i] === 'VARCHAR' && typeof cellValue === 'number') return getVarcharVal(cellValue);
                if (colTypes[i] === 'NUMERIC' && cell.model.type == 4) return getNumericVal(cellValue)
                return cellValue;
            });
          
            values.push(newTpl)  
        }

        const last_insert_rowid = await executeQuery('executeMany',modelName,query3,values);

        if (dateColumns.length > 0){
            let lovQuery = `INSERT INTO S_TableParameters (TableName, ColumnName, ParameterType, ParameterValue) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING;`
            const lovValues = []
            for (let colName of dateColumns){
                lovValues.push([tableName,colName,'LOV','Date'])
            }    
            await executeQuery('executeMany',modelName,lovQuery,lovValues);
        }

        try{
            const insertQuery = `INSERT INTO S_TableGroup 
                                 (GroupName, TableName, TableDisplayName, TableType, Table_status)
                                 VALUES (?, ?, ?, ?, ?)`;

            const last_insert_rowid = await executeQuery('insertData',modelName,insertQuery,["Input Tables", tableName, tableName.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "), "Input", "Active"]);
        }catch (ex){
            // Do Nothing
            console.log(ex)
        }

    } catch (ex) {

        return `${ex.message}`;
    }

    return sheet.rowCount - 1;
}

//  --------------------------------------------------------------------------------------------------

// Determines the column type based on the list of values provided.

function getColumnType(listValues) {
    let ct = 0;
    for (const val of listValues) {
        if (getDataType(val) === 0) {
            return "VARCHAR";
        } else if (val === "" || val === null || val === undefined) {
            ct += 1;
        }
    }
    return ct === listValues.length ? "VARCHAR" : "NUMERIC";
}

//  --------------------------------------------------------------------------------------------------

// Determines the data type of a given value.

function getDataType(val) {
    if (!val) {
        return 1;
    }

    try {
        const numVal = parseFloat(val);

        if (Math.abs(numVal) >= 0 && Math.abs(numVal) < 1) {
            return 1;
        } else if (Math.abs(numVal) >= 1) {
            if (val.toString().length > 1 && val.toString().charAt(0) === '0') {
                return 0;
            }
            return 1;
        } else {
            return 0;
        }
    } catch (ex) {
        return 0;
    }
}

//  --------------------------------------------------------------------------------------------------

// Determines if a given value can be considered an integer.

function getIntDataType(val) {
    if (!val) {
        return 1;
    }

    try {
        const intVal = parseInt(val, 10);

        if (Math.abs(intVal) >= 0) {
            return 1;
        } else {
            return 0;
        }
    } catch (ex) {
        return 0;
    }
}

//  --------------------------------------------------------------------------------------------------

function getNumericVal(val) {
    const startDate = new Date(1899, 11, 30); // Excel's base date
    const serialNumber = (val - startDate) / (24 * 60 * 60 * 1000);
    return parseInt(serialNumber)
}

//  --------------------------------------------------------------------------------------------------

// Run Editor Query

export async function runEditorQuery(viewName,editorQuery,modelName) {
    const query = `SELECT sql FROM sqlite_master WHERE name = ? AND type = 'view'`;
    const createQuery = `CREATE VIEW [${viewName}] AS ${editorQuery}`;
    const dropQuery = `DROP VIEW [${viewName}]`;

    let msg = "";
    let dbMsg = null;
    let count;
    let vQuery = null;

    try {
        const x = await executeQuery('executeQuery',modelName,editorQuery,['script'])
        count = x;
    } catch (error) {
        return error.toString();
    }

    try {
        const vQueryResult = await executeQuery('fetchData',modelName,query,[viewName]);
        vQuery = vQueryResult[0][0];
        await executeQuery('executeQuery',modelName,dropQuery,['script'])
        await executeQuery('executeQuery',modelName,createQuery,['script'])
        msg += "Result: query executed successfully, rows returned.";
    } catch {
        await executeQuery('executeQuery',modelName,vQuery,['script']);
        msg += `Result: query executed successfully. ${count} rows affected.`;
        dbMsg = `${count} rows affected`;
    }

    const logQuery = `INSERT INTO T_QueryLogs (QuerySQL, QueryMsg) VALUES (?, ?)`;
    const last_insert_rowid = await executeQuery('insertData',modelName,logQuery,[editorQuery, dbMsg])

    return msg;
}

export async function createTable(modelName,tablename, colNames, colTypes) {
    const dropQuery = `DROP TABLE IF EXISTS ${tablename}`
    await executeQuery('executeQuery',modelName,dropQuery,['script'])
  
    const query = colNames.map((colName, index) => `${colName} ${colTypes[index]}`).join(', ');
    await executeQuery('executeQuery',modelName,`CREATE TABLE ${tablename} (${query})`,['script'])
    return true
}

function convertDate(dateObj) {
    if (!(dateObj instanceof Date)) {
        return date
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const date = String(dateObj.getDate()).padStart(2, '0');
    

    return `${year}-${month}-${date}`;

}