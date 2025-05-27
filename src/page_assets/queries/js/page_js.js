import {executeQuery,confirmBox, get_cl_element} from '../../../assets/js/scc'
import {wk_obj} from './scl_wk_obj'

let x_columns = []
let y_columns = []
let z_columns = []
let table_name = ''
let series_list = []
let series_property = {}
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
            // take time to create the temporary table
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
                    
                    z_el.appendChild(get_lov_zdiv(level_name))
                    // if (all_levels.indexOf(level_name) > -1){
                    // } else {
                    //     z_el.appendChild(get_z_div(level_name))
                    // }
                    
                }
                
            }
        }
    }
}

function get_lov_zdiv(level_name){

    const input_tag = get_cl_element("span", "btn btn-sm btn-primary", null, document.createTextNode(level_name))
    const th2 = get_cl_element("div", "pl-2", null,
        get_cl_element("div", "input-group", null, input_tag))


    input_tag.setAttribute("aria-haspopup", "true")
    input_tag.style.cursor = "default"
    input_tag.setAttribute("aria-expanded", "false")

    const span = get_cl_element("button","btn btn-sm btn-primary dropdown-toggle dropdown-toggle-split",null,get_cl_element("span","fas fa-angle-down dropdown-arrow"))
    
    span.addEventListener('show.bs.dropdown', async function () {
        const lov_div = th2.querySelector("div.lov-values")
        let where_in = {}
        where_in[level_name] = []
        lov_div.innerHTML = ""
        let filter_obj = {}
        let selected_mems = []
        if (th2.getAttribute("selected_mem")){
            selected_mems = JSON.parse(th2.getAttribute("selected_mem"))
        }

        for (let new_th of th2.parentNode.childNodes){
            if (new_th.classList.contains("z_el")){
                let cn = new_th.querySelector("select")
                filter_obj[cn.parentNode.getAttribute("level_name")] = [cn.value]
            } else if (new_th.innerText !== level_name){
                if (new_th.getAttribute("selected_mem")){
                    filter_obj[new_th.innerText] = JSON.parse(new_th.getAttribute("selected_mem"))
                }
            }
        }

        const distinct_query = `SELECT DISTINCT [${z_columns.join('], [')}] FROM [${table_name}]`
        const result =  await executeQuery('fetchData', modelName, distinct_query)
        
        
        const total_len = result.length
        for (let col_value of result) {
            let el = get_cl_element("a", "dropdown-item", null,
                get_cl_element("input", "form-check-input", null, null))
            el.firstChild.setAttribute("type", "checkbox")
            if (selected_mems.length > 0) {
                if(col_value !==null){
                    if (selected_mems.indexOf(col_value.toString()) > -1) {
                        el.firstChild.checked = true
                    }
                }else if (selected_mems.indexOf("null") > -1) {
                    el.firstChild.checked = true
                }
            } else {
                el.firstChild.checked = true
            }
            el.appendChild(get_cl_element("label", "form-check-label", null,
                document.createTextNode(col_value)))
            lov_div.appendChild(el)
            // $(el.firstChild).on("change", function (e) {
            el.firstChild.onchange= function (e) {
                if (!el.firstChild.checked && lov_div.parentNode.querySelector("input").checked) {
                    lov_div.parentNode.querySelector("input").checked = false
                } else if (el.firstChild.checked && !lov_div.parentNode.querySelector("input").checked) {
                    const ct = lov_div.querySelectorAll("input:checked").length
                    if (ct == total_len) {
                        lov_div.parentNode.querySelector("input").checked = true
                    }
                }
            }
        }

        const ct = lov_div.querySelectorAll("input:checked").length
        if (ct == total_len) {
            lov_div.parentNode.querySelector("input").checked = true
        }

    })

    span.setAttribute("type", "button")
    span.setAttribute("data-bs-toggle", "dropdown")
    span.setAttribute("aria-haspopup", "true")
    span.setAttribute("aria-expanded", "false")
    th2.querySelector("div.input-group").appendChild(span)

    const dropdown = get_cl_element("div", "multiselect-container dropdown-menu dropdown", null,
        get_cl_element("form", null, null,
            get_cl_element("a", "dropdown-item", null,
                get_cl_element("input", "form-check-input", null, null))))
    dropdown.querySelector("a")
        .appendChild(get_cl_element("label", "form-check-label", null,
            document.createTextNode("Select All")))
    
    dropdown.querySelector("input").setAttribute("type", "checkbox")
    dropdown.firstChild.appendChild(get_cl_element("div", "dropdown-divider"))
    let lov_div = get_cl_element("div", "lov-values")
    lov_div.setAttribute("level_name", level_name)
    dropdown.firstChild.appendChild(lov_div)
    dropdown.firstChild.appendChild(get_cl_element("div", "dropdown-divider"))
    const inp_tag = dropdown.querySelector("input")
    inp_tag.onchange= function (e) {
        if (inp_tag.checked) {
            for (let cn of th2.querySelectorAll("div.lov-values input")) {
                if (!cn.checked) {
                    cn.checked = true
                }
            }
        } else {
            for (let cn of th2.querySelectorAll("div.lov-values input")) {
                if (cn.checked) {
                    cn.checked = false
                }
            }
        }
    }
    const prim_button = get_cl_element("button", "btn btn-sm btn-primary", null,
        document.createTextNode("OK"))
    const ter_button = get_cl_element("button", "btn btn-sm btn-tertiary", null,
        document.createTextNode("CLEAR"))
    dropdown.firstChild.appendChild(get_cl_element("div", "px-2 py-2 d-flex flex-row justify-content-between", 
                                            null,ter_button))


    ter_button.parentNode.appendChild(prim_button)
    ter_button.setAttribute("type", "button")
    prim_button.setAttribute("type", "button")

    prim_button.addEventListener("mousedown", function (e) {
        let ct = th2.querySelectorAll("div.lov-values input:checked").length
        let total_len = th2.querySelectorAll("div.lov-values input").length

        let filter_obj = {}
        if (ct > 0){
            filter_obj[level_name] = []
            for (let cn of th2.querySelectorAll("div.lov-values input:checked")){
                filter_obj[level_name].push(cn.nextElementSibling.innerText)
            }

            for (let new_th of th2.parentNode.querySelectorAll("div.lov-values")){
                let this_level = new_th.getAttribute("level_name")
                if (this_level !== level_name){
                    if (!new_th.parentNode.querySelector("input").checked){
                        filter_obj[this_level] = []
                        for (let cn of new_th.querySelectorAll("input:checked")){
                            filter_obj[this_level].push(cn.nextElementSibling.innerText)
                        }
                    }
                }
            }

            
            if (th2.getAttribute("selected_mem") && ct == total_len){
                delete filter_obj[level_name]
                th2.removeAttribute("selected_mem")
                get_query_data(filter_obj)
            } else if (ct < total_len) {
                th2.setAttribute("selected_mem", JSON.stringify(filter_obj[level_name]))
                get_query_data(filter_obj)
            }
        } 
        else {
            th2.removeAttribute("selected_mem")
        }

        if(ct==total_len){
            if(span.childNodes[1]){
                span.removeChild(span.childNodes[0])
                span.firstChild.style = ""
            }
        }else{         
            if(!ct==0){
                if(!(span.childNodes[1])){
                    span.firstChild.style ="position:relative;top:4px;"
                    span.insertBefore(get_cl_element('span','fas fa-filter'), span.childNodes[0]);
                }
            }
        }
        
    })


    ter_button.addEventListener("mousedown", function (e) {
        let filter_obj = {}
        for (let new_th of th2.parentNode.querySelectorAll("div.lov-values")){
            let this_level = new_th.getAttribute("level_name")
            if (this_level !== level_name){
                if (!new_th.parentNode.querySelector("input").checked){
                    filter_obj[this_level] = []
                    for (let cn of new_th.querySelectorAll("input:checked")){
                        filter_obj[this_level].push(cn.nextElementSibling.innerText)
                    }
                }
            }
        }
        th2.removeAttribute("selected_mem")
        let reload_flag = false
        for (let cn of th2.querySelectorAll("input")) {
            if (!cn.checked) {
                cn.checked = true
                reload_flag = true
            }
        }
        if (reload_flag){
            get_query_data(filter_obj)
            
        }
        if(span.childNodes[1]){
            span.removeChild(span.childNodes[0])
            span.firstChild.style = ""
        }
    })

    th2.querySelector("div.input-group").appendChild(dropdown)

    return th2
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
    const escapeSqlValue = val => String(val).replace(/'/g, "''");
    const transpose = matrix => matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));

    let transpose_flag = false;

    // Clone columns to avoid mutation
    let local_x = [...x_columns];
    let local_y = [...y_columns];

    // Determine if 'Series' is in X or Y
    let series_index = local_x.indexOf('Series');
    if (series_index !== -1) {
        local_x.splice(series_index, 1);
    } else {
        series_index = local_y.indexOf('Series');
        if (series_index !== -1) {
            local_y.splice(series_index, 1);
            transpose_flag = true;
            [local_x, local_y] = [local_y, local_x];  // transpose
        } else {
            console.error('Series not found in x_columns or y_columns');
            return [[], [], []];
        }
    }

    // Build headers
    let column_headers = [];
    if (local_x.length > 0) {
        const placeholders = z_data.map(() => '?').join(', ');
        const where_clause = `WHERE [${z_columns[0]}] IN (${placeholders})`;
        const where_data = [...z_data];

        const distinct_query = `SELECT DISTINCT [${local_x.join('], [')}] FROM [${table_name}] ${where_clause}`;
        const x_column_data = await executeQuery('fetchData', modelName, distinct_query, where_data);

        for (const x_values of x_column_data) {
            for (const series_name of series_list) {
                const this_header = [...x_values, series_name];  // Append series name
                column_headers.push(this_header);
            }
        }
    } else {
        column_headers.push([...series_list]);
    }

    // Create SELECT query
    let select_query = `SELECT [${local_y.join('], [')}]`;
    let x_data = column_headers[0].map((_, colIndex) => column_headers.map(row => row[colIndex]));

    for (const this_header_raw of column_headers) {
        const this_header = [...this_header_raw];
        const series_name = this_header.pop(); // last item is series

        const agg_func = (series_dict[series_name] && series_dict[series_name]['Agg']) || 'sum';
        const header_name = `[${[...this_header, series_name].join(', ')}]`;

        // Build CASE WHEN condition
        let case_condition = `CASE WHEN 1=1`;
        this_header.forEach((x_value, i) => {
            case_condition += ` AND [${local_x[i]}] = '${escapeSqlValue(x_value)}'`;
        });
        case_condition += ` THEN [${series_name}] ELSE 0 END`;

        select_query += `, ${agg_func}(${case_condition}) AS ${header_name}`;
    }

    // Build WHERE clause for z_columns
    let where_clause = '';
    let where_data = [];
    if (z_columns && z_columns.length > 0) {
        const placeholders = z_data.map(() => '?').join(', ');
        where_clause = `WHERE [${z_columns[0]}] IN (${placeholders})`;
        where_data = [...z_data];
    }

    select_query += ` FROM [${table_name}] ${where_clause} GROUP BY [${local_y.join('], [')}]`;

    const query_data = await executeQuery('fetchData', modelName, select_query, where_data);

    // Split output
    const split_index = local_y.length;
    let y_data = query_data.map(row => row.slice(0, split_index));
    let pivot_data = query_data.map(row => row.slice(split_index));

    if (transpose_flag) {
        pivot_data = transpose(pivot_data);
        [y_data, x_data] = [x_data, y_data];
        y_data = transpose(y_data);
        x_data = transpose(x_data);
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
        // await populate_z_data(table_name, z_columns);

        
        await create_temp_wk_table(x_columns, y_columns, z_columns, series_property, table_name, worksheet_name);

        // let sel_z = document.getElementById("ZLayoutContentDiv").querySelector("select").value

        const distinct_query = `SELECT DISTINCT [${z_columns.join('], [')}] FROM [${table_name}]`
        const result =  await executeQuery('fetchData', modelName, distinct_query)
        let z_data = []
        for(let item of result){
            z_data.push(item[0])
        }
        
        // Take time to create the pivot table
        const [x_data, y_data, pivot_data] = await create_scl_pivot(
            table_name, x_columns, y_columns, z_columns, z_data, series_list, series_property
        );
        
        const wk_obj_instance = new wk_obj(
            x_columns, x_data, y_columns, y_data, z_columns, z_data,
            pivot_data, series_property, table_name, worksheet_name
        );

        const tbl = wk_obj_instance.populateTable();
        tb_container.innerHTML = "";
        tb_container.appendChild(tbl);

    } catch (err) {
        console.log("Error","Error loading data.",err)
        confirmBox("Error",err)
    }
}

export async function get_query_data(filter_obj = {}){
    const tb_container = document.getElementById('table_container');
    tb_container.innerHTML = "";
    tb_container.appendChild(loader_div());

    try{
        if(Object.keys(filter_obj).length <= 0){
            const distinct_query = `SELECT DISTINCT [${z_columns.join('], [')}] FROM [${table_name}]`
            const result =  await executeQuery('fetchData', modelName, distinct_query)
            filter_obj[z_columns] = []
            for (let item of result){
                filter_obj[z_columns].push(item[0])
            }
        }
        
        let z_col = Object.keys(filter_obj)
        let z_data = []
        for (let item of Object.values(filter_obj)[0]){
            z_data.push(item)
        }
        
        const [x_data, y_data, pivot_data] = await create_scl_pivot(
            table_name, x_columns, y_columns, z_col, z_data, series_list, series_property
        );
        
        
        const wk_obj_instance = new wk_obj(
            x_columns, x_data, y_columns, y_data, z_col, z_data,
            pivot_data, series_property, table_name, worksheet_name
        );
    
        const tbl = wk_obj_instance.populateTable();
        tb_container.innerHTML = "";
        tb_container.appendChild(tbl);
    }catch(err){
        console.log("Error","Error loading data.",err)
        confirmBox("Error",err)
    }
    
}

export async function get_refresh_data(level_name){
    const tb_container = document.getElementById('table_container');
    tb_container.innerHTML = "";
    tb_container.appendChild(loader_div());
    
    try{
        await getLayoutFromTable();
        await reset_z_layout(x_columns, y_columns, z_columns);
        // await populate_z_data(table_name, z_columns);
        await create_temp_wk_table(x_columns, y_columns, z_columns, series_property, table_name, worksheet_name);

        const distinct_query = `SELECT DISTINCT [${z_columns.join('], [')}] FROM [${table_name}]`
        const result =  await executeQuery('fetchData', modelName, distinct_query)
        let z_data = []
        for(let item of result){
            z_data.push(item[0])
        }

        const [x_data, y_data, pivot_data] = await create_scl_pivot(
            table_name, x_columns, y_columns, [level_name], z_data, series_list, series_property
        );

        
        const wk_obj_instance = new wk_obj(
            x_columns, x_data, y_columns, y_data, [level_name], z_data,
            pivot_data, series_property, table_name, worksheet_name
        );

        const tbl = wk_obj_instance.populateTable();
        tb_container.innerHTML = "";
        tb_container.appendChild(tbl);
    }catch(err){
        console.log("Error","Error loading data.",err)
        confirmBox("Error",err)
    }
}