import {executeQuery,confirmBox, get_cl_element} from '../../../assets/js/scc'
import {wk_obj} from './scl_wk_obj'

// const x_columns = ['LocState', 'Month', 'Series']
// const y_columns = ['Category', 'ItemType']
// const z_columns = []
let x_columns = []
let y_columns = []
let z_columns = []
let table_name = ''
let series_list = []
let series_property = {}
// let table_name = 'temp_v'
// let series_list = ['SalesQuantity', 'SalesValue']
// const series_property = {'SalesQuantity': {'Agg': 'sum', 'Format': '0,0.00'}, 
//         'SalesValue': {'Agg': 'sum', 'Format': '$0,0.00'}}
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

async function reset_z_layout(x_columns, y_columns, z_columns) {
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

const create_scl_pivot = async (table_name, x_columns, y_columns, z_columns, z_data, series_list, series_dict) => {
    let transpose_flag = false;

    // Clone columns to avoid mutating global values
    let local_x = [...x_columns];
    let local_y = [...y_columns];
    let series_index = local_x.indexOf('Series');

    if (series_index !== -1) {
        local_x.splice(series_index, 1);
    } else {
        series_index = local_y.indexOf('Series');
        if (series_index !== -1) {
            local_y.splice(series_index, 1);
            transpose_flag = true;
            [local_x, local_y] = [local_y, local_x];  // transpose columns
        } else {
            console.error('Series not part of x_columns or y_columns');
            return [[], [], []];  // gracefully exit with empty data
        }
    }

    let column_headers = [];
    if (local_x.length > 0) {
        const distinct_query = `SELECT DISTINCT [${local_x.join('], [')}] FROM [${table_name}]`;
        const x_column_data = await executeQuery('fetchData', modelName, distinct_query);

        for (const x_values of x_column_data) {
            for (const series_name of series_list) {
                const this_header = [...x_values];
                this_header.splice(series_index, 0, series_name);
                column_headers.push(this_header);
            }
        }
    } else {
        column_headers.push([...series_list]);
    }

    let select_query = `SELECT [${local_y.join('], [')}]`;
    let x_data = column_headers[0].map((_, colIndex) => column_headers.map(row => row[colIndex]));

    for (const this_header_raw of column_headers) {
        const this_header = [...this_header_raw];  // clone to avoid mutation
        const series_name = this_header[series_index];

        const agg_func = (series_dict[series_name] && series_dict[series_name]['Agg']) || 'sum';
        const header_name = `[${this_header.join(', ')}]`;

        this_header.splice(series_index, 1);
        select_query += `, ${agg_func}([${series_name}]) FILTER (WHERE 1=1`;

        this_header.forEach((x_value, i) => {
            select_query += ` AND [${local_x[i]}] = '${x_value}'`;
        });

        select_query += `) AS ${header_name}`;
    }
    
    let where_clause = '';
    let where_data = []
    if (z_columns && z_columns.length > 0) {
        const conditions = z_columns.map((col, i) => `[${col}] = ?`).join(' AND ');
        where_clause = `WHERE ${conditions}`;
        if(z_data){
            where_data.push(z_data)
        }
    }
    
    select_query += ` FROM [${table_name}] ${where_clause} GROUP BY [${local_y.join('], [')}]`;
    const query_data = await executeQuery('fetchData', modelName, select_query,where_data);

    const split_index = local_y.length;
    let y_data = query_data.map(row => row.slice(0, split_index));
    let pivot_data = query_data.map(row => row.slice(split_index));

    if (transpose_flag) {
        pivot_data = pivot_data[0].map((_, colIndex) => pivot_data.map(row => row[colIndex]));
        [y_data, x_data] = [x_data, y_data];
        y_data = y_data[0].map((_, colIndex) => y_data.map(row => row[colIndex]));
        x_data = x_data[0].map((_, colIndex) => x_data.map(row => row[colIndex]));
    }

    return [x_data, y_data, pivot_data];
};


const getLayoutFromTable = async () => {

    const query = `SELECT TableName, Layout, Series, SeriesProperties FROM S_Queries WHERE Name = ?`
    const result = await executeQuery('fetchData', modelName, query,[sessionStorage.qr_name])
    if (result.length === 0) {
        confirmBox("Alert!","No data found.");
        return
    }
    
    const [tableName, layoutStr, seriesStr, seriesPropsStr] = result[0];
    const layout = JSON.parse(layoutStr);
    const layoutX = layout.layoutX || [];
    const layoutY = layout.layoutY || [];
    const layoutZ = layout.layoutZ || [];

    table_name = tableName;
    x_columns = layoutX;
    y_columns = layoutY;
    z_columns = layoutZ;
    series_list = JSON.parse(seriesStr);
    series_property = JSON.parse(seriesPropsStr);
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

export async function populate_querysheet_def(){
    const tb_container = document.getElementById('table_container');
    tb_container.innerHTML = "";
    tb_container.appendChild(loader_div());

    try {
        await getLayoutFromTable();
        await reset_z_layout(x_columns, y_columns, z_columns);
        await populate_z_data(table_name, z_columns);
        await create_temp_wk_table(x_columns, y_columns, z_columns, series_property, table_name, worksheet_name);
        let sel_z = document.getElementById("ZLayoutContentDiv").querySelector("select").value

        const [x_data, y_data, pivot_data] = await create_scl_pivot(
            table_name, x_columns, y_columns, z_columns, sel_z, series_list, series_property
        );
        
        const wk_obj_instance = new wk_obj(
            x_columns, x_data, y_columns, y_data, z_columns, [],
            pivot_data, series_property, table_name, worksheet_name
        );

        const tbl = wk_obj_instance.populateTable();
        tb_container.innerHTML = "";
        tb_container.appendChild(tbl);

    } catch (err) {
        console.log("Error","Error loading data.",err)
    }
}

export async function get_query_data(level_name){
    const tb_container = document.getElementById('table_container');
    tb_container.innerHTML = "";
    tb_container.appendChild(loader_div());
    let sel_z = document.getElementById("ZLayoutContentDiv").querySelector("select").value

    const [x_data, y_data, pivot_data] = await create_scl_pivot(
        table_name, x_columns, y_columns, [level_name], sel_z, series_list, series_property
    );

    
    const wk_obj_instance = new wk_obj(
        x_columns, x_data, y_columns, y_data, [level_name], [],
        pivot_data, series_property, table_name, worksheet_name
    );

    const tbl = wk_obj_instance.populateTable();
    tb_container.innerHTML = "";
    tb_container.appendChild(tbl);
}

export async function get_refresh_data(level_name){
    const tb_container = document.getElementById('table_container');
    tb_container.innerHTML = "";
    tb_container.appendChild(loader_div());
    let sel_z = document.getElementById("ZLayoutContentDiv").querySelector("select").value

    await getLayoutFromTable();
    await reset_z_layout(x_columns, y_columns, z_columns);
    await populate_z_data(table_name, z_columns);

    const [x_data, y_data, pivot_data] = await create_scl_pivot(
        table_name, x_columns, y_columns, [level_name], sel_z, series_list, series_property
    );

    
    const wk_obj_instance = new wk_obj(
        x_columns, x_data, y_columns, y_data, [level_name], [],
        pivot_data, series_property, table_name, worksheet_name
    );

    const tbl = wk_obj_instance.populateTable();
    tb_container.innerHTML = "";
    tb_container.appendChild(tbl);
}