import * as bootstrap from 'bootstrap';
import Sortable from 'sortablejs';
import { executeQuery, confirmBox, get_cl_element } from '../../../assets/js/scc';
import { populate_querysheet_def, get_query_data, get_refresh_data } from './page_js';

const params = new URLSearchParams(window.location.search);
const modelName = params.get('modelName');
let qr_obj = new Object
const layout_el = ["layoutX", "layoutY", "layoutZ"];
var typingTimer;               
var doneTypingInterval = 300; 
let SelectedLevel = []
let SelectedSeries = []
let SelectedLayouts = {layoutX:  [], layoutY: [], layoutZ:[]}
let SerProperties
let inrText = ""

window.onload = async function () {
    let result = await executeQuery('init');
    if (!result || result.msg !== 'Success') {
        confirmBox('Alert!', 'Some error occurred while initializing SQLite.');
        return;
    }   

    enable_sortable()
    await get_all_tables()
    
    
    document.getElementById("addAllAggregation").onclick = move_elements.bind(null, "availableLevel", "selectedLevel", "addAll");
    document.getElementById("removeAllAggregation").onclick = move_elements.bind(null, "selectedLevel", "availableLevel", "removeAll");
    document.getElementById("searchQuery").onkeyup = findtr
    
    document.getElementById('aggregation-new').addEventListener('shown.bs.tab', async function () {
        const query_name = document.getElementById('queryNm').value;
        const table_name = document.getElementById('tableNm').value;
        if (query_name === '') {
            confirmBox('Alert!', 'Please enter a name for the query.');
            return;
        }

        if (table_name === '') {
            confirmBox('Alert!', 'Please select a table name.');
            return;
        }
        
        // const avl_lvl = document.getElementById("availableLevel").innerHTML
        // const sel_lvl = document.getElementById("selectedLevel").innerHTML

        const isDisabled = document.getElementById("tableNm").disabled

        if(!isDisabled){
            await set_all_agg()
        }
        
    })
    document.getElementById('series-new').addEventListener('shown.bs.tab', async function () {
        const query_name = document.getElementById('queryNm').value;
        const table_name = document.getElementById('tableNm').value;
        if (query_name === '') {
            confirmBox('Alert!', 'Please enter a name for the query.');
            return;
        }

        if (table_name === '') {
            confirmBox('Alert!', 'Please select a table name.');
            return;
        }
        await set_series_data()
    })
    document.getElementById('layout-new').addEventListener('shown.bs.tab', async function () {
        const query_name = document.getElementById('queryNm').value;
        const table_name = document.getElementById('tableNm').value;
        if (query_name === '') {
            confirmBox('Alert!', 'Please enter a name for the query.');
            return;
        }

        if (table_name === '') {
            confirmBox('Alert!', 'Please select a table name.');
            return;
        }
        document.getElementById('layoutY').innerHTML = ""
        for (let lx of SelectedLayouts['layoutY']) {
            let series_el = get_cl_element("li", null, null, get_cl_element("span", "fas fa-columns"))
            series_el.appendChild(document.createTextNode(lx))
            series_el.value = lx
            document.getElementById("layoutY").appendChild(series_el)
        }
    })

    document.getElementById('editQueryBtn').onclick = async function (e) {
        inrText = e.target.innerText.trim().toLowerCase();
    
        if (!sessionStorage.qr_name) {
            confirmBox('Alert!', 'No Selected queries found.');
            return;
        }
        await get_querySheet_def()
        await set_querysheet_def()
        const tabIdMap = {
            "edit": "display-new"
        };
    
        if (tabIdMap[inrText]) {
            const tab = new bootstrap.Tab(document.getElementById(tabIdMap[inrText]));
            tab.show();
        }
        const bs_modal = new bootstrap.Modal(document.getElementById('modal-select-column'));
        bs_modal.show()
    }

    
    if(sessionStorage.qr_name){
        await get_querySheet_def()
    }else{
        confirmBox('Alert!', "First create a new Query Sheet.");
        return;
    }
    await set_querysheet_def()
    await populate_querysheet_def()

    // const zSelect = document.querySelector("#ZLayoutContentDiv select");
    
    // if (zSelect) {
    //     zSelect.addEventListener("change", function () {
    //         const level_name = this.closest(".z_el").getAttribute("level_name");
    //         get_query_data(level_name);
    //     });
    // }
    
}

async function get_all_tables() {
    
    let query = `SELECT TableName FROM S_TableGroup WHERE Table_Status = 'Active'`;
    let res = await executeQuery("fetchData", modelName, query);
    const queryOpt = document.getElementById('tableNm');

    for (let tbNm of res) {
        const li_el = get_cl_element('option', null, null, document.createTextNode(tbNm));
        li_el.setAttribute('value', tbNm);
        queryOpt.appendChild(li_el);
    }
}

document.getElementById('modal-select-column').addEventListener('show.bs.modal', function (e) {
    const button = e.relatedTarget // Button that triggered the modal
    if (button) {
        let inner_text
        if (button.classList.contains("navIocn")) {
            inner_text = button.getAttribute("title").trim().toLowerCase()
        } else {
            inner_text = button.innerText.trim().toLowerCase()
        }
        if (inner_text == "display") {
            const tab = new bootstrap.Tab(document.getElementById('display-new'));
            tab.show()
        } else if (inner_text == "series") {
            const tab = new bootstrap.Tab(document.getElementById('series-new'));
            tab.show()
        } else if (inner_text == "aggregation") {
            const tab = new bootstrap.Tab(document.getElementById('aggregation-new'));
            tab.show()
        } else if (inner_text == "layout") {
            const tab = new bootstrap.Tab(document.getElementById('layout-new'));
            tab.show()
        } else if (inner_text == "new") {
            const tab = new bootstrap.Tab(document.getElementById('display-new'));
            tab.show()
            reset_new_wk_def()
        } else if (inner_text == "save as"){
            const tab = new bootstrap.Tab(document.getElementById('display-new'));
            tab.show()
            document.getElementById("queryNm").value = "";
            document.getElementById("queryNm").disabled = false;
            document.getElementById("tableNm").value = "";
        } 

    }
})

function reset_new_wk_def() {
    document.getElementById("queryNm").value = "";
    document.getElementById("queryNm").disabled = false;
    document.getElementById("tableNm").value = "";
    document.getElementById("tableNm").disabled = false;
    document.getElementById("showSummary").checked = true
    document.getElementById("graphTypeNew").value = "TabularData"
    document.getElementById("availableLevel").innerHTML = ""
    document.getElementById("selectedLevel").innerHTML = ""
    const tbody = document.querySelector("#advTable tbody");
    if (tbody) {
        tbody.innerHTML = "";
    }
    SelectedLevel = []
    SelectedSeries = []
    SelectedLayouts = {layoutX:  [], layoutY: [], layoutZ:[]}
    for (let layout_name of layout_el) {
        document.getElementById(layout_name).innerHTML = ""
    }

    let series_el = get_cl_element("li", null, null, get_cl_element("span", "fas fa-columns"))
    series_el.appendChild(document.createTextNode("Series"))
    series_el.value = "series"
    document.getElementById("layoutX").appendChild(series_el)
}

async function get_querySheet_def() {
    let col_names = ["Name", "TableName", "ShowSummary", "HideNullRows", "GraphType",
                "SeriesProperties","Series", "Layout", "Levels"
            ];
    
    let col_nm = ["SeriesProperties","Series", "Layout", "Levels"]

    let selectedQueries = `SELECT ${col_names.join(', ')} FROM S_Queries WHERE Name = ?`;
    let res = await executeQuery("fetchData", modelName, selectedQueries, [sessionStorage.qr_name]);
    
    if (res.length === 0) {
        return;
    }

    col_names.forEach((key, index) => {
            qr_obj[key] = res[0][index]
    });
    col_nm.forEach(key => {
        try {
            qr_obj[key] = JSON.parse(qr_obj[key]);
        } catch (e) {
            console.warn(`Failed to parse ${key}:`, qr_obj[key]);
        }
    });
}

async function set_querysheet_def() {
    
    if (Object.keys(qr_obj).length == 0) {
        return
    }
    document.getElementById("queryNm").value = qr_obj["Name"]
    document.getElementById("queryNm").disabled = true;
    document.getElementById("tableNm").disabled = true;
    document.getElementById("tableNm").value = qr_obj["TableName"]

    if (qr_obj["ShowSummary"] == 1) {
        document.getElementById("showSummary").checked = true
    } else {
        document.getElementById("showSummary").checked = false
    }

    if (qr_obj["hideNullRows"] == 1) {
        document.getElementById("hideNullRows").checked = true
    } else {
        document.getElementById("hideNullRows").checked = false
    }
    
    document.getElementById("layoutX").innerHTML = ""
    document.getElementById("layoutY").innerHTML = ""
    document.getElementById("layoutZ").innerHTML = ""
    for (let lx of qr_obj["Layout"]["layoutX"]) {
        let series_el = get_cl_element("li", null, null, get_cl_element("span", "fas fa-columns"))
        series_el.appendChild(document.createTextNode(lx))
        series_el.value = lx
        document.getElementById("layoutX").appendChild(series_el)
    }


    for (let lx of qr_obj["Layout"]["layoutY"]) {
        let series_el = get_cl_element("li", null, null, get_cl_element("span", "fas fa-columns"))
        series_el.appendChild(document.createTextNode(lx))
        series_el.value = lx
        document.getElementById("layoutY").appendChild(series_el)
    }

    for (let lx of qr_obj["Layout"]["layoutZ"]) {
        let series_el = get_cl_element("li", null, null, get_cl_element("span", "fas fa-columns"))
        series_el.appendChild(document.createTextNode(lx))
        series_el.value = lx
        document.getElementById("layoutZ").appendChild(series_el)
    }

    document.getElementById("graphTypeNew").value = qr_obj["GraphType"]
    SelectedSeries = qr_obj["Series"]
    SelectedLevel = qr_obj["Levels"]
    SerProperties = qr_obj["SeriesProperties"]
    SelectedLayouts = qr_obj["Layout"]
    await set_all_agg()
    await set_series_data()

}

async function set_all_agg(){
    
    const query_name = document.getElementById('queryNm').value;
    const table_name = document.getElementById('tableNm').value;
    if (query_name === '') {
        confirmBox('Alert!', 'Please enter a name for the query.');
        return;
    }

    if (table_name === '') {
        confirmBox('Alert!', 'Please select a table name.');
        return;
    }
    
    try {
        const col_name_query = `PRAGMA table_info(${table_name});`;
        const all_table = await executeQuery("fetchData", modelName, col_name_query);

        const {numericColumns, stringColumns} = get_agg_value(all_table)

        await get_column_type(numericColumns, stringColumns);
    } catch (err) {
        console.error('Error executing query:', err);
        confirmBox('Error', err);
    }
}

async function set_series_data(){
    const table = document.getElementById("advTable");
    let tbody = table.querySelector("tbody");

    if (!tbody) {
        tbody = get_cl_element("tbody");
        table.appendChild(tbody);
    } else {
        tbody.innerHTML = "";
    }

    const container = document.getElementById("availableLevel");
    
    for (let el of container.childNodes) {
        if(el.childNodes[0].checked){
            if (el.nodeType === Node.ELEMENT_NODE) {
                const seriesNm = el.innerText;
                const val = "0,0.00";
                get_advanced_table(seriesNm, val, tbody);
            }
        }
        
    }
}

function get_agg_value(res){
    const columnTypeInfo = res.map(row => {
        const [cid, name, type] = row;
        return { column: name, type: type.toUpperCase() };
    });

    const numericTypes = ['INTEGER', 'REAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'DECIMAL'];
    const stringTypes = ['TEXT', 'VARCHAR', 'CHAR', 'BLOB'];

    const numericColumns = columnTypeInfo
        .filter(col => numericTypes.includes(col.type))
        .map(col => col.column);
    const stringColumns = columnTypeInfo
        .filter(col => stringTypes.includes(col.type))
        .map(col => col.column);
    
    return {numericColumns, stringColumns}
}

async function get_column_type(numeric, string) {
    
    const num_ul = document.getElementById('availableLevel');
    const str_ul = document.getElementById('selectedLevel');
    num_ul.innerHTML = "";
    str_ul.innerHTML = "";
    
    const selectedSeriesSet = new Set(SelectedSeries || []);
    const selectedLevelSet = new Set(SelectedLevel || []);
    const stringSet = new Set(string);
    const numericSet = new Set(numeric);
    
    let numericItems = [
        ...numeric.filter(el => !stringSet.has(el)),
        ...[...selectedSeriesSet].filter(el => !numericSet.has(el) && !stringSet.has(el)),
        ...[...selectedSeriesSet].filter(el => stringSet.has(el) && !numericSet.has(el))
    ];

    let stringItems = [
        ...string.filter(el => !numericSet.has(el)),
        ...[...selectedLevelSet].filter(el => !stringSet.has(el) && !numericSet.has(el)),
        ...[...selectedLevelSet].filter(el => numericSet.has(el) && !stringSet.has(el))
    ];
    
    stringItems = stringItems.filter(item => !numericItems.includes(item));
    numericItems = numericItems.filter(item => !stringItems.includes(item));
    
    for (let el of numericItems) {
        let li = get_tree_li_element(el, 'fas fa-file-alt');
        if (selectedSeriesSet.has(el)) li.firstChild.checked = true;
        num_ul.appendChild(li);

        li.onclick = function (e) {
            if (e.target.tagName.toLowerCase() !== "input") {
                const checkbox = this.querySelector("input[type='checkbox']");
                checkbox.checked = !checkbox.checked;
                const value = this.innerText;
                if (checkbox.checked) {
                    if (!SelectedSeries.includes(value)) {
                        SelectedSeries.push(value);
                    }
                } else {
                    const index = SelectedSeries.indexOf(value);
                    if (index !== -1) {
                        SelectedSeries.splice(index, 1);
                    }
                }
            }
            e.preventDefault();
        }

        li.ondblclick = function (e) {
            let new_col_name = this.parentNode.getAttribute("dest");
            const targetUl = document.getElementById(new_col_name);
            this.classList.remove("selectedValue");
            targetUl.appendChild(this);
            if (e.target.tagName.toLowerCase() !== "input") {
                const checkbox = this.querySelector("input[type='checkbox']");
                checkbox.checked = false;
            }

            // Reassign new click and double-click handlers
            if (new_col_name === 'selectedLevel') {
                this.onclick = stringClickHandler;
                this.ondblclick = dblClickHandler;
            } else if (new_col_name === 'availableLevel') {
                this.onclick = numericClickHandler;
                this.ondblclick = dblClickHandler;
            }
        }
    }

    for (let el of stringItems) {
        let li = get_tree_li_element(el, 'fas fa-file-alt');
        if (selectedLevelSet.has(el)) li.firstChild.checked = true;
        str_ul.appendChild(li);

        li.onclick = function (e) {
            if (e.target.tagName.toLowerCase() !== "input") {
                const checkbox = this.querySelector("input[type='checkbox']");
                checkbox.checked = !checkbox.checked;
                const value = this.innerText;
                if (checkbox.checked) {
                    if (!SelectedLevel.includes(value)) {
                        SelectedLevel.push(value);
                    }
                    if (!SelectedLayouts['layoutY'].includes(value)) {
                        SelectedLayouts['layoutY'].push(value);
                    }
                } else {
                    const index = SelectedLevel.indexOf(value);
                    const sel_y = SelectedLayouts['layoutY'].indexOf(value);
                    if (index !== -1) {
                        SelectedLevel.splice(index, 1);
                    }
                    if (sel_y !== -1) {
                        SelectedLayouts['layoutY'].splice(sel_y, 1);
                    }
                    
                }
            }
            e.preventDefault();
        }

        li.ondblclick = function (e) {
            let new_col_name = this.parentNode.getAttribute("dest");
            const targetUl = document.getElementById(new_col_name);
            this.classList.remove("selectedValue");
            targetUl.appendChild(this);
            if (e.target.tagName.toLowerCase() !== "input") {
                const checkbox = this.querySelector("input[type='checkbox']");
                checkbox.checked = false;
            }

            // Reassign new click and double-click handlers
            if (new_col_name === 'selectedLevel') {
                this.onclick = stringClickHandler;
                this.ondblclick = dblClickHandler;
            } else if (new_col_name === 'availableLevel') {
                this.onclick = numericClickHandler;
                this.ondblclick = dblClickHandler;
            }
        };
    }
}

function stringClickHandler(e) {
    if (e.target.tagName.toLowerCase() !== "input") {
        const checkbox = this.querySelector("input[type='checkbox']");
        checkbox.checked = !checkbox.checked;
        const value = this.innerText.trim();

        if (checkbox.checked) {
            if (!SelectedLevel.includes(value)) {
                SelectedLevel.push(value);
            }
            if (!SelectedLayouts['layoutY'].includes(value)) {
                SelectedLayouts['layoutY'].push(value);
            }
        } else {
            const index = SelectedLevel.indexOf(value);
            const layoutIndex = SelectedLayouts['layoutY'].indexOf(value);
            if (index !== -1) SelectedLevel.splice(index, 1);
            if (layoutIndex !== -1) SelectedLayouts['layoutY'].splice(layoutIndex, 1);
        }
    }
    e.preventDefault();
}

function numericClickHandler(e) {
    if (e.target.tagName.toLowerCase() !== "input") {
        const checkbox = this.querySelector("input[type='checkbox']");
        checkbox.checked = !checkbox.checked;
        const value = this.innerText.trim();

        if (checkbox.checked) {
            if (!SelectedSeries.includes(value)) {
                SelectedSeries.push(value);
            }
        } else {
            const index = SelectedSeries.indexOf(value);
            if (index !== -1) SelectedSeries.splice(index, 1);
        }
    }
    e.preventDefault();
}

function dblClickHandler(e) {
    let new_col_name = this.parentNode.getAttribute("dest");
    const targetUl = document.getElementById(new_col_name);
    if (!targetUl) return;

    this.classList.remove("selectedValue");
    targetUl.appendChild(this);

    // Uncheck if click is not on input
    if (e.target.tagName.toLowerCase() !== "input") {
        const checkbox = this.querySelector("input[type='checkbox']");
        if (checkbox) checkbox.checked = false;
    }

    // Reassign click and double-click handlers
    if (new_col_name === 'selectedLevel') {
        this.onclick = stringClickHandler;
    } else if (new_col_name === 'availableLevel') {
        this.onclick = numericClickHandler;
    }
    this.ondblclick = dblClickHandler;

    e.preventDefault();
}

function get_advanced_table(seriesNm, val, tbody) {
    
    const row = get_cl_element("tr");

    const td1 = get_cl_element("td", "td-size");
    td1.innerText = seriesNm;
    row.appendChild(td1);

    const td2 = get_cl_element("td");
    const select = get_cl_element("select", "form-control form-select py-1 moduleForm-feild");
    ["sum", "min", "max", "avg", "count", "group_concat"].forEach(opt => {
        const option = get_cl_element("option");
        option.setAttribute("value", opt)
        option.innerText = opt;
        select.appendChild(option);
    });
    td2.appendChild(select);
    row.appendChild(td2);

    const td3 = get_cl_element("td");
    const input = get_cl_element("input", "form-control form-control-sm");
    input.type = "text";
    input.value = val;
    td3.appendChild(input);
    row.appendChild(td3);

    tbody.appendChild(row);
}



function enable_sortable() {
    Sortable.create(document.getElementById("layoutY"), {
        group: "words",
        animation: 150,
        onSort: updateLayouts
        , onAdd: function (evt) {
            var ct = 0;
            for (let html_el of evt.target.childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    if (ct == 0) {
                        ct = 1;
                    }
                    else {
                        html_el.remove();
                        break;
                    }
                }
            }

            for (let html_el of document.getElementById("layoutX").childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    html_el.remove();
                    break;
                }
            }
        }
    });
    Sortable.create(document.getElementById("layoutZ"), {
        group: "words",
        animation: 150,
        onSort: updateLayouts
        , onAdd: function (evt) {
            if (evt.originalEvent.ctrlKey) {
                const clone = evt.item.cloneNode(true);
                evt.from.insertBefore(clone, evt.from.children[evt.oldIndex]);
            }
            var ct = 0;
            for (let html_el of evt.target.childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    if (ct == 0) {
                        ct = 1;
                    }
                    else {
                        html_el.remove();
                        break;
                    }
                }
            }

        }
    });
    Sortable.create(document.getElementById("layoutX"), {
        group: "words",
        animation: 150,
        onSort: updateLayouts
        , onAdd: function (evt) {
            var ct = 0;
            for (let html_el of evt.target.childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    if (ct == 0) {
                        ct = 1;
                    }
                    else {
                        html_el.remove();
                        break;
                    }
                }
            }

            for (let html_el of document.getElementById("layoutY").childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    html_el.remove();
                    break;
                }
            }
        }
    });
    Sortable.create(document.getElementById("selectedLevel"), {
        group: "words",
        animation: 150
        , onAdd: function (evt) {
            var ct = 0;
            for (let html_el of evt.target.childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    if (ct == 0) {
                        ct = 1;
                    }
                    else {
                        html_el.remove();
                        break;
                    }
                }
            }
            
            for (let html_el of document.getElementById("availableLevel").childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    html_el.remove();
                    break;
                }
            }
        }
    });
    Sortable.create(document.getElementById("availableLevel"), {
        group: "words",
        animation: 150
        , onAdd: function (evt) {
            var ct = 0;
            for (let html_el of evt.target.childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    if (ct == 0) {
                        ct = 1;
                    }
                    else {
                        html_el.remove();
                        break;
                    }
                }
            }
            
            for (let html_el of document.getElementById("selectedLevel").childNodes) {
                if (html_el.innerText == evt.item.innerText) {
                    const checkbox = html_el.querySelector("input[type='checkbox']");
                    if(checkbox.checked){
                        checkbox.checked = false
                    }
                    html_el.remove();
                    break;
                }
            }
        }
    });
}

function updateLayouts() {
    if(SelectedLayouts){
        SelectedLayouts.layoutX = getItemsFromLayout("layoutX");
        SelectedLayouts.layoutY = getItemsFromLayout("layoutY");
        SelectedLayouts.layoutZ = getItemsFromLayout("layoutZ");
    }
}

function getItemsFromLayout(id) {
    const ul = document.getElementById(id);
    return Array.from(ul.children).map(el => el.innerText.trim());
}


function move_elements(src_id, dest_id, bt_type) {
    if (bt_type !== "addAll" && bt_type !== "removeAll") return;

    const srcUl = document.getElementById(src_id);
    const destUl = document.getElementById(dest_id);
    if (!srcUl || !destUl) return;

    for (let trd of srcUl.querySelectorAll("li")) {
        destUl.appendChild(trd);
        trd.classList.remove("selectedValue");

        const checkbox = trd.querySelector("input[type='checkbox']");
        if (checkbox) checkbox.checked = false;

        trd.onclick = (dest_id === "selectedLevel") ? stringClickHandler : numericClickHandler;
        trd.ondblclick = dblClickHandler;
    }
}

document.getElementById('deleteQueryBtn').onclick = async function () {
    const qr_name = sessionStorage.qr_name
    let sel_query = `SELECT Name FROM S_Queries WHERE Name = ?`;
    let res = await executeQuery("fetchData",modelName,sel_query,[qr_name]);

    if (res.length === 0) {
        confirmBox('Alert!', 'No query found with the given name.');
        return;
    }

    confirmBox('Alert!',`Are you sure you want to delete ${qr_name}?`,async function(){
        let delete_query = `DELETE FROM S_Queries WHERE Name = ?`;
        await executeQuery("deleteData", modelName, delete_query, [sessionStorage.qr_name]);
        confirmBox('Success', 'Query Sheet deleted successfully!');
        for (let tr of document.getElementById("selectQueries-table").childNodes) {
            if (tr.innerText == qr_name) {
                tr.remove()
                break;
            }
        }
        const tb_container = document.getElementById('table_container');
        tb_container.innerHTML = "";
        sessionStorage.removeItem('qr_name')
        document.getElementById("zContent").style.display = "none"
        qr_obj = {}
        reset_new_wk_def()
    }, 1, 'Yes', 'No')


}

document.getElementById('openModalBtn').onclick = async function (e) {
    // inrText = e.target.innerText.trim().toLowerCase();
    let sel_body = document.getElementById('selectQueries-table')
    sel_body.innerHTML = ""
    document.getElementById('searchQuery').value = "";
    document.getElementById('searchQuery').style.display = 'none';
    let sel_query = `SELECT QueryId, Name FROM S_Queries`;
    let res = await executeQuery("fetchData",modelName,sel_query);
    
    if (res.length === 0) {
        confirmBox('Alert!', 'No queries found.');
        return;
    }

    for (let quNm of res){
        sel_body.appendChild(get_tr_element(quNm[1], quNm[0])  )
    }

    if (sel_body.firstChild) {
        sel_body.firstChild.click()
    }
    
    const bs_modal = new bootstrap.Modal(document.getElementById('select-querySheet'));
    bs_modal.show()
}

document.getElementById('selectQuery-ok').onclick = async function () {
    let selected_query = document.getElementById('selectQueries-table').querySelector('tr.selectedValue').innerText
    
    const bs_modal = bootstrap.Modal.getInstance(document.getElementById('select-querySheet'))
    bs_modal.hide()

    if(selected_query !== sessionStorage.qr_name){
        sessionStorage.qr_name = selected_query
        await get_querySheet_def()
        await set_querysheet_def()
        await populate_querysheet_def()
    }

    // const zSelect = document.querySelector("#ZLayoutContentDiv select");
    
    // if (zSelect) {
    //     zSelect.addEventListener("change", function () {
    //         const level_name = this.closest(".z_el").getAttribute("level_name");
    //         get_query_data(level_name);
    //     });
    // }
}

function get_tr_element(member_name, colname = "xx") {
    let tr = document.createElement("tr")
    tr.setAttribute("colname", colname)
    tr.appendChild(document.createElement("td"))
    tr.firstChild.classList.add("border-remove")
    tr.style.userSelect = "none";
    tr.style.borderBottom = "thin solid #89CFF0"
    tr.firstChild.innerText = member_name
    if(member_name == sessionStorage.qr_name){
        tr.classList.add("selectedValue")
    }
    tr.onclick = function (e) {
        if (!e.ctrlKey) {
            for (let cn of this.parentNode.querySelectorAll("tr.selectedValue")) {
                cn.classList.remove("selectedValue")
            }
        }
        this.classList.add("selectedValue")
        e.preventDefault();
    }

    // tr.ondblclick = function () {
    //     let new_col_name = this.parentNode.getAttribute("destination-table")
    //     document.getElementById(new_col_name).appendChild(get_tr_element(member_name, colname))
    //     this.remove()
    // }
    return tr
}

document.getElementById('search_qr').onclick = function () {
    let search_inp = document.getElementById('searchQuery')
    if (search_inp.style.display == "none") {
        search_inp.style.display = '';
        search_inp.focus()
    } else {
        search_inp.style.display = 'none';
    }
}

const findtr = function (e, recurring = null) {
    if (recurring === null){
        clearTimeout(typingTimer);
        typingTimer = setTimeout(function(){findtr(e, 'zz')}, doneTypingInterval);
        return
    }
    let el = e.target
    let colname = el.getAttribute("colname")
    let tbody_id = "selectQueries-table"
    let str_val = el.value
    
    if (colname) {
        for (let trd of document.getElementById(tbody_id).querySelectorAll(`tr[colname="${colname}"]`)) {
            if (trd.firstChild.innerText.toLowerCase().indexOf(str_val.toLowerCase()) > -1) {
                trd.style.display = "";
            } else {
                trd.style.display = "none";
            }
        }
    } else {
        let flag = 0
        for (let trd of document.getElementById(tbody_id).childNodes) {
            if (trd.firstChild.innerText.toLowerCase().indexOf(str_val.toLowerCase()) > -1) {
                if (flag == 0) {
                    flag = 1
                    trd.click()
                }
                trd.style.display = "";
            } else {
                trd.style.display = "none";
            }
        }
    }
}

document.getElementById('save_qr').onclick = async function () {
    let new_query = {}
    new_query["Name"] = document.getElementById("queryNm").value
    new_query["tableName"] = document.getElementById("tableNm").value
    new_query["GraphType"] = document.getElementById("graphTypeNew").value
    
    if(new_query["Name"].trim() === ''){
        confirmBox('Alert','Please enter query name')
        return
    }
    if(new_query["tableName"] === ''){
        confirmBox('Alert','Please select a table name')
        return
    }

    if (document.getElementById("showSummary").checked) {
        new_query["ShowSummary"] = 1
    } else {
        new_query["ShowSummary"] = 0
    }
    if (document.getElementById("hideNullRows").checked) {
        new_query["hide_nullRows"] = 1
    } else {
        new_query["hide_nullRows"] = 0
    }

    new_query["SelectedLevels"] = []
    for (let cn of document.getElementById("selectedLevel").childNodes) {
        let level_val = cn.firstChild.checked
        
        if (level_val) {
            new_query["SelectedLevels"].push(cn.innerText)
        }
    }
    
    if (new_query["SelectedLevels"].length == 0) {
        confirmBox("Alert!", "Please select atleast one level")
        return
    }

    new_query["AvailableLevels"] = []
    for (let cn of document.getElementById("availableLevel").childNodes) {
        let level_val = cn.firstChild.checked
        
        if (level_val) {
            new_query["AvailableLevels"].push(cn.innerText)
        }
    }
    
    if (new_query["AvailableLevels"].length == 0) {
        confirmBox("Alert!", "Please select atleast one series")
        return
    }

    new_query["layoutX"] = []
    new_query["layoutY"] = []
    new_query["layoutZ"] = []

    for (let cn of document.getElementById("layoutX").childNodes) {
        if(cn.textContent.trim() === ""){
            continue
        }
        new_query["layoutX"].push(cn.textContent.trim());
    }

    if (new_query["layoutX"].length == 0) {
        confirmBox("Alert!", "Please select atleast one level in layout X")
        return
    }


    for (let cn of document.getElementById("layoutY").childNodes) {
        if(cn.textContent.trim() === ""){
            continue
        }
        new_query["layoutY"].push(cn.textContent.trim());

    }

    if (new_query["layoutY"].length == 0) {
        confirmBox("Alert!", "Please select atleast one level in layout Y")
        return
    }

    
    for (let cn of document.getElementById("layoutZ").childNodes) {
        if(cn.textContent.trim() === ""){
            continue
        }
        new_query["layoutZ"].push(cn.textContent.trim());

    }
    
    new_query["Layout"] = {"layoutX": new_query["layoutX"], "layoutY": new_query["layoutY"], "layoutZ": new_query["layoutZ"]}
    
    const table = document.getElementById("advTable");
    const result = {};
    for (let row of table.querySelectorAll("tbody tr")) {
        const cells = row.querySelectorAll("td");
        const seriesName = cells[0].textContent.trim();
        const aggValue = cells[1].querySelector("select").value;
        const formatValue = cells[2].querySelector("input").value.trim();
      
        if (seriesName) {
          result[seriesName] = {
            Agg: aggValue,
            Format: formatValue
          };
        }
    }

    new_query["SeriesProperties"] = result;
    
    if (inrText !== "edit") {
        let sel_query = `SELECT Name FROM S_Queries WHERE Name = ? AND TableName = ?`;
        let res = await executeQuery("fetchData",modelName,sel_query,[new_query["Name"],new_query["tableName"]]);
        
        if (res.length > 0) {
            confirmBox('Alert!', 'Query name already exists! Please choose a different name.');
            return;
        }
    }
    inrText = ""
    const lastUpdateDate = getFormattedDateTime()

    let insert_query = `INSERT INTO S_Queries (Name, TableName, ShowSummary, HideNullRows, Levels, Series, SeriesProperties, Layout, GraphType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(Name) DO UPDATE SET Name = ?, TableName = ?, ShowSummary = ?, HideNullRows = ?, Levels = ?, Series = ?, SeriesProperties = ?, Layout = ?, GraphType = ?, LastUpdateDate = ?`; 
    await executeQuery("insertData",modelName,insert_query,[new_query["Name"], new_query["tableName"], new_query["ShowSummary"], new_query["hide_nullRows"], 
        JSON.stringify(new_query["SelectedLevels"]), JSON.stringify(new_query["AvailableLevels"]), JSON.stringify(new_query["SeriesProperties"]),JSON.stringify(new_query["Layout"]), new_query["GraphType"]
        ,new_query["Name"], new_query["tableName"], new_query["ShowSummary"], new_query["hide_nullRows"], JSON.stringify(new_query["SelectedLevels"]), JSON.stringify(new_query["AvailableLevels"]), 
        JSON.stringify(new_query["SeriesProperties"]),JSON.stringify(new_query["Layout"]), new_query["GraphType"], lastUpdateDate]
    );

    document.getElementById('queryNm').value = '';
    document.getElementById('tableNm').value = '';
    document.getElementById('showSummary').checked = true;
    document.getElementById('hideNullRows').checked = false;
    sessionStorage.qr_name = new_query["Name"]

    const bs_modal = bootstrap.Modal.getInstance(document.getElementById('modal-select-column'));
    bs_modal.hide()
    confirmBox('Success', 'Query saved successfully!');
    await get_querySheet_def()
    await set_querysheet_def()
    await populate_querysheet_def()

    // const zSelect = document.querySelector("#ZLayoutContentDiv select");
    
    // if (zSelect) {
    //     zSelect.addEventListener("change", function () {
    //         const level_name = this.closest(".z_el").getAttribute("level_name");
    //         get_query_data(level_name);
    //     });
    // }
}

function getFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function get_tree_li_element(level_name, icon_class) {
    const checkbox = get_cl_element("input", "inputcheckbox");
    checkbox.setAttribute("type", "checkbox");

    const icon = get_cl_element("span", icon_class);
    const label = get_cl_element("label", "checkBox-label", null, icon);
    const lv_name = get_cl_element("span",'aggrigation-point',null,document.createTextNode(level_name));
    label.appendChild(lv_name)
    const li = get_cl_element("li", null, null, checkbox);
    li.appendChild(label);
    return li;
}

document.getElementById('refresh_wk').onclick = async function() {
    const level_name = document.querySelector("#ZLayoutContentDiv span").innerText.trim();
    get_refresh_data(level_name);
}