import {executeQuery,confirmBox, get_cl_element} from '../../../assets/js/scc'
import {wk_obj} from './scl_wk_obj'

// const x_columns = ['LocState', 'Month', 'Series']
// const y_columns = ['Category', 'ItemType']
// const z_columns = ["SUBCATEGORY"]
let x_columns = []
let y_columns = []
let z_columns = []
const table_name = 'temp_v'
const series_list = ['SalesQuantity', 'SalesValue']
const series_property = {'SalesQuantity': {'Agg': 'sum', 'Format': '0,0.00'}, 
        'SalesValue': {'Agg': 'sum', 'Format': '$0,0.00'}}
const worksheet_name =  'another_wk'
const params = new URLSearchParams(window.location.search)
const modelName = params.get('modelName');

const create_temp_wk_table = async (x_columns, y_columns, z_columns, series_dict, table_name,
    worksheet_name) => {
            const new_table_name = `TW_${worksheet_name}`;
            const drop_query = `DROP TABLE IF EXISTS [${new_table_name}]`;
            const all_columns = [...x_columns, ...y_columns, ...z_columns]
            const series_index = all_columns.indexOf('Series');
            if (series_index !== -1) {
            all_columns.splice(series_index, 1);
            }
            var select_query = `CREATE TABLE [${new_table_name}] AS SELECT [${all_columns.join('], [')}] `
            for (let series_name in series_dict){
            let agg_func = series_dict[series_name]['Agg'] || 'sum'
            select_query += `, ${agg_func}([${series_name}]) AS [${series_name}] `
            }
            select_query += ` FROM [${table_name}] GROUP BY [${all_columns.join('], [')}]`
            await executeQuery('executeQuery', modelName, drop_query)
            await executeQuery('executeQuery', modelName, select_query)
};

const populate_z_data = async (table_name, z_columns) => {
    let z_sel = document.getElementById("ZLayoutContentDiv").querySelector('select')
    
    if (z_columns.length > 0) {
        const distinct_query = `SELECT DISTINCT [${z_columns.join('], [')}] FROM [${table_name}]`
        const z_column_data =  await executeQuery('fetchData', modelName, distinct_query)
        for (const z_values of z_column_data){
            for (const z_value of z_values){
                z_sel.appendChild(get_opt_el(z_value,z_value))
            }
            
        }
    }
}

async function reset_z_layout() {
    let z_el = document.getElementById("zContent")
    z_el.style.display = "none"
    if (sessionStorage.qr_name) {
        if (z_columns.length > 0) {
            z_el.style.display = ""
            {
                let z_el = document.getElementById("ZLayoutContentDiv")
                z_el.innerHTML = ""
                let all_levels = [...x_columns, ...y_columns]
                for (let level_name of z_columns) {
                    if (all_levels.indexOf(level_name) === -1) {
                        z_el.appendChild(get_z_div(level_name))
                    }
                    
                }
                
            }
        }
    }
}

function get_z_div(label_name) {
    let select_el = get_cl_element("div", "form-group mb-0 ps-2 z_el", null,
        get_cl_element("select", "form-control form-select py-1 pe-4 moduleForm-feild"))
    select_el.setAttribute("level_name", label_name)
    select_el.style.maxWidth = "240px"
    return select_el
}

function get_opt_el(val,inner_text){
    let opt = get_cl_element("option",null,null,document.createTextNode(inner_text))
    opt.setAttribute("value",val)
    return opt
}

const create_scl_pivot = async (table_name, x_columns, y_columns, series_list, series_dict) => {
    let transpose_flag = false;
    let series_index = x_columns.indexOf('Series');
    if (series_index !== -1) {
        x_columns.splice(series_index, 1);
    } else {
        series_index = y_columns.indexOf('Series')
        if (series_index !== -1) {
      		y_columns.splice(series_index, 1);
            transpose_flag = true
            [x_columns, y_columns] = [y_columns, x_columns]
    	} else{
            console.log('Series not part of x_columns or y_columns')
        }
    }
    let column_headers = []
    if (x_columns.length > 0) {
       const distinct_query = `SELECT DISTINCT [${x_columns.join('], [')}] FROM [${table_name}]`
       const x_column_data =  await executeQuery('fetchData', modelName, distinct_query)
       for (const x_values of x_column_data){
           for (const series_name of series_list){
               let this_header = [...x_values]
               this_header.splice(series_index, 0, series_name)
               column_headers.push(this_header)
           }
       }
    } else {
        column_headers.push([...series_list])
    } 
    var select_query = `SELECT [${y_columns.join('], [')}] `
 	let x_data = column_headers[0].map((_, colIndex) => column_headers.map(row => row[colIndex]));
    for (const this_header of column_headers){
        const series_name = this_header[series_index]
        const agg_func = series_dict[series_name]['Agg'] || 'sum'
        const format_func = series_dict[series_name]['Format'] || '0,0.00'
        select_query += ` ,${agg_func}([${series_name}]) FILTER (WHERE 1 = 1 `
        const header_name = `[${this_header.join(', ')}]`
        this_header.splice(series_index, 1);
        this_header.forEach((x_value, i) => {
            select_query += `AND [${x_columns[i]}] = '${x_value}' `   
        })
        select_query += `) AS ${header_name} `
    }
    select_query += `FROM [${table_name}]  group by [${y_columns.join('], [')}]`
    const query_data =  await executeQuery('fetchData', modelName, select_query)
    const split_index = y_columns.length
    let y_data = query_data.map(query_data => query_data.slice(0, split_index));
    let pivot_data = query_data.map(query_data => query_data.slice(split_index));  
    if (transpose_flag) {
        pivot_data = pivot_data[0].map((_, colIndex) => pivot_data.map(row => row[colIndex]));
        [y_data, x_data] = [x_data, y_data]
        y_data = y_data[0].map((_, colIndex) => y_data.map(row => row[colIndex]));
        x_data = x_data[0].map((_, colIndex) => x_data.map(row => row[colIndex]));
    }
    return [x_data, y_data, pivot_data]
}

const getLayoutFromTable = async () => {
    const query = `SELECT Layout FROM S_Queries WHERE Name = ?`
    const result = await executeQuery('fetchData', modelName, query,[sessionStorage.qr_name])
    if (result.length > 0) {
        const layoutJSON = JSON.parse(result[0][0])
        x_columns = layoutJSON.layoutX || []
        y_columns = layoutJSON.layoutY || []
        z_columns = layoutJSON.layoutZ || []
    }
}

window.onload = async function () {
    const result = await executeQuery('init')
    if (!result || result.msg != 'Success') {
        confirmBox('Alert!', 'Some error occured while initializing sqlite.')
        return
    }
    let tb_container = document.getElementById('table_container')
    tb_container.appendChild(loader_div())
    await getLayoutFromTable()
    await reset_z_layout()
    await populate_z_data(table_name, z_columns)
    
    
    await create_temp_wk_table(x_columns, y_columns, z_columns, series_property, table_name, 
          worksheet_name)
    const [x_data, y_data, pivot_data] = await create_scl_pivot(table_name, x_columns, y_columns, 
          series_list, series_property)
    const wk_obj_instance = new wk_obj(x_columns, x_data, y_columns, y_data, z_columns, [], pivot_data,
        series_property, table_name, worksheet_name)
    const tbl = wk_obj_instance.populateTable()
    tb_container.innerHTML = ""
    tb_container.appendChild(tbl)
    
}

const loader_div = function () {
    let div = get_cl_element("div", "h-100 w-100 d-flex justify-content-center align-items-center")
    let img = `<button class="btn btn-primary h-25 btn-lg" type="button" disabled>
                    <span class="spinner-grow spinner-grow-lg" role="status" aria-hidden="true"></span>
                    Loading...
                </button>`
    div.innerHTML = img
    return div
}