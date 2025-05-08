import * as bootstrap from 'bootstrap';
import Sortable from 'sortablejs';
import { executeQuery, confirmBox, get_cl_element } from '../../../assets/js/scc';
// import * as dfd from "danfojs";

const params = new URLSearchParams(window.location.search);
const modelName = params.get('modelName');
let pragmaResult = {};
let currTable = '';
const layout_el = ["layoutX", "layoutY", "layoutZ"];
var typingTimer;               
var doneTypingInterval = 300; 
let inrText = ""
let SelectedLevel
let SelectedSeries
let SelectedLayouts
let seriesProperties
let layoutInitialized = false;
let wk_obj = new Object

document.addEventListener('DOMContentLoaded', async function () {
    // Set button handlers
    document.getElementById("addAllAggregation").onclick = move_elements.bind(null, "availableLevel", "selectedLevel", "addAll");
    document.getElementById("removeAllAggregation").onclick = move_elements.bind(null, "selectedLevel", "availableLevel", "removeAll");
    document.getElementById("searchQuery").onkeyup = findtr

    let result = await executeQuery('init');
    if (!result || result.msg !== 'Success') {
        confirmBox('Alert!', 'Some error occurred while initializing SQLite.');
        return;
    }
    
    await get_all_tables();
    enable_sortable();
    
    const links = document.querySelectorAll('#queryUl li a.nav-link');
    links.forEach(link => {
        link.addEventListener('click', async function (e) {
            const fileName = link.firstElementChild.innerText;
            if (fileName !== 'Display') {
                e.preventDefault();
                const query_name = document.getElementById('queryNm').value;
                const query_val = document.getElementById('queryInp').value;

                if (query_name === '') {
                    confirmBox('Alert!', 'Please enter a name for the query.');
                    return;
                }

                if (query_val === '') {
                    confirmBox('Alert!', 'Please select a table name.');
                    return;
                }

                if (query_val !== '') {
                    if (Object.keys(pragmaResult).length <= 0 || currTable !== query_val) {
                        currTable = query_val;
                        const col_name_query = `PRAGMA table_info(${query_val});`;
                        try {
                            pragmaResult = await executeQuery("fetchData", modelName, col_name_query);

                            const {numericColumns, stringColumns} = get_all_agg(pragmaResult)

                            get_column_type(numericColumns, stringColumns);
                        } catch (err) {
                            console.error('Error executing query:', err);
                            confirmBox('Error', err);
                        }
                    }
                }
            }
        });
    });

    // Modal select event
    document.getElementById('modal-select-column').addEventListener('show.bs.modal', function (e) {
        const button = e.relatedTarget;
        
        if (button) {
            let inner_text = button.classList.contains("navIocn") ?
                button.getAttribute("title").trim().toLowerCase() :
                button.innerText.trim().toLowerCase();
            
            const query_name = document.getElementById('queryNm').value;
            const query_val = document.getElementById('queryInp').value;

            if (inner_text !== "display" && (inner_text === "aggregation" || inner_text === "layout" || inner_text === "series")) {
                if (query_name === '' && query_val !== '') {
                    confirmBox('Alert!', 'Please enter a name for the query.');
                    return;
                }
            }
            
            const tabIdMap = {
                "display": "display-new",
                "series": "series-new",
                "aggregation": "aggregation-new",
                "layout": "layout-new",
                "new": "display-new",
                "save as": "display-new"
            };

            if (tabIdMap[inner_text]) {
                const tab = new bootstrap.Tab(document.getElementById(tabIdMap[inner_text]));
                tab.show();

                if (inner_text === "new") reset_new_wk_def();
                if (inner_text === "save as") {
                    document.getElementById("queryNm").value = "";
                    document.getElementById("queryNm").disabled = false;
                    document.getElementById("queryInp").value = "";
                }
            }
            
        }
    });

    document.getElementById('layout-new').addEventListener('shown.bs.tab', function () {
    
        document.getElementById("layoutY").innerHTML = "";
    
        const container = document.getElementById("selectedLevel");
        for (let el of container.children) {
            const checkbox = el.querySelector("input[type='checkbox']");
            if (checkbox && checkbox.checked) {
                set_layout_li('layoutY', el.cloneNode(true));
            }
        }
        
        if (layoutInitialized) return;
        layoutInitialized = true;
        if (SelectedLayouts) {
            for (let layoutId of ["layoutX", "layoutZ"]) {
                const items = SelectedLayouts[layoutId];
                if (Array.isArray(items)) {
                    for (let name of items) {
                        set_layout_li(layoutId, get_tree_li_element(name, 'fas fa-file-alt'));
                    }
                }
            }
        }
    });

    document.getElementById('series-new').addEventListener('shown.bs.tab', function () {
        const table = document.getElementById("advTable");
        let tbody = table.querySelector("tbody");
    
        if (!tbody) {
            tbody = get_cl_element("tbody");
            table.appendChild(tbody);
        } else {
            tbody.innerHTML = "";  // Clear previous content
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
    });

});

document.getElementById('modal-select-column').addEventListener('hide.bs.modal', function (e) {
    populate_worksheet_def()
});

function get_all_agg(res){
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

async function get_all_tables() {
    let query = `SELECT TableName FROM S_TableGroup WHERE Table_Status = 'Active'`;
    let res = await executeQuery("fetchData", modelName, query);
    const queryOpt = document.getElementById('queryInp');

    for (let tbNm of res) {
        const li_el = get_cl_element('option', null, null, document.createTextNode(tbNm));
        li_el.setAttribute('value', tbNm);
        queryOpt.appendChild(li_el);
    }
}

function get_column_type(numeric, string) {
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
        }
    }
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

function reset_new_wk_def() {
    document.getElementById("queryNm").value = "";
    document.getElementById("queryNm").disabled = false;
    document.getElementById("queryInp").value = "";
    document.getElementById("queryInp").disabled = false;
    document.getElementById("showSummary").checked = true;
    document.getElementById("availableLevel").innerHTML = ""
    document.getElementById("selectedLevel").innerHTML = ""
    document.getElementById("graphTypeNew").value = "TabularData"
    SelectedLevel = null
    SelectedSeries = null
    SelectedLayouts = null
    for (let layout_name of layout_el) {
        document.getElementById(layout_name).innerHTML = ""
    }

    let series_el = get_cl_element("li", null, null, get_cl_element("span", "fas fa-columns"))
    series_el.appendChild(document.createTextNode("Series"))
    series_el.value = "series"
    document.getElementById("layoutX").appendChild(series_el)
}

function set_layout_li(layoutId, li) {
    
    let ul = document.getElementById(layoutId);
    let liText = li.innerText;
    
    const el = get_cl_element("li", null, null,
        get_cl_element("span", "fas fa-columns", null, null)
    );
    
    el.appendChild(document.createTextNode(liText));
    ul.appendChild(el);
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
    if (bt_type == "addAll") {
        for (let trd of document.getElementById(src_id).querySelectorAll("li")) {
            document.getElementById(dest_id).appendChild(trd)
            trd.classList.remove("selectedValue")
            const checkbox = trd.querySelector("input[type='checkbox']");
            if(checkbox.checked){
                checkbox.checked = false
            }
        }
        
    } else if (bt_type == "removeAll") {
        for (let trd of document.getElementById(src_id).querySelectorAll("li")) {
            document.getElementById(dest_id).appendChild(trd)
            trd.classList.remove("selectedValue")
            const checkbox = trd.querySelector("input[type='checkbox']");
            if(checkbox.checked){
                checkbox.checked = false
            }
        }
    }
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

document.getElementById('save_qr').onclick = async function () {
    let new_query = {}
    new_query["Name"] = document.getElementById("queryNm").value
    new_query["tableName"] = document.getElementById("queryInp").value
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
    const lastUpdateDate = getFormattedDateTime()

    let insert_query = `INSERT INTO S_Queries (Name, TableName, ShowSummary, HideNullRows, Levels, Series, SeriesProperties, Layout, GraphType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(Name) DO UPDATE SET Name = ?, TableName = ?, ShowSummary = ?, HideNullRows = ?, Levels = ?, Series = ?, SeriesProperties = ?, Layout = ?, GraphType = ?, LastUpdateDate = ?`; 
    await executeQuery("insertData",modelName,insert_query,[new_query["Name"], new_query["tableName"], new_query["ShowSummary"], new_query["hide_nullRows"], 
        JSON.stringify(new_query["SelectedLevels"]), JSON.stringify(new_query["AvailableLevels"]), JSON.stringify(new_query["SeriesProperties"]),JSON.stringify(new_query["Layout"]), new_query["GraphType"]
        ,new_query["Name"], new_query["tableName"], new_query["ShowSummary"], new_query["hide_nullRows"], JSON.stringify(new_query["SelectedLevels"]), JSON.stringify(new_query["AvailableLevels"]), 
        JSON.stringify(new_query["SeriesProperties"]),JSON.stringify(new_query["Layout"]), new_query["GraphType"], lastUpdateDate]
    );

    document.getElementById('queryNm').value = '';
    document.getElementById('queryInp').value = '';
    document.getElementById('showSummary').checked = true;
    document.getElementById('hideNullRows').checked = false;
    sessionStorage.qr_name = new_query["Name"]

    const bs_modal = bootstrap.Modal.getInstance(document.getElementById('modal-select-column'));
    bs_modal.hide()
    confirmBox('Success', 'Query saved successfully!');
}

document.getElementById('deleteQueryBtn').onclick = async function () {
    let sel_query = `SELECT Name FROM S_Queries WHERE Name = ?`;
    let res = await executeQuery("fetchData",modelName,sel_query,[sessionStorage.qr_name]);
    
    if (res.length === 0) {
        confirmBox('Alert!', 'No query found with the given name.');
        return;
    }

    confirmBox('Alert!',`Are you sure you want to delete ${sessionStorage.qr_name}?`,async function(){
        let delete_query = `DELETE FROM S_Queries WHERE Name = ?`;
        await executeQuery("deleteData", modelName, delete_query, [sessionStorage.qr_name]);
        sessionStorage.removeItem("qr_name")
        confirmBox('Success', 'Query deleted successfully!');
    }, 1, 'Yes', 'No')

}

document.getElementById('openModalBtn').onclick = async function (e) {
    inrText = e.target.innerText.trim().toLowerCase();
    let sel_body = document.getElementById('selectQueries-table')
    sel_body.innerHTML = ""
    document.getElementById('searchQuery').value = "";
    document.getElementById('searchQuery').style.display = 'none';
    let sel_query = `SELECT Q_id, Name FROM S_Queries`;
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

document.getElementById('editQueryBtn').onclick = async function (e) {
    inrText = e.target.innerText.trim().toLowerCase();

    if (!sessionStorage.qr_name) {
        confirmBox('Alert!', 'No Selected queries found.');
        return;
    }

    if(inrText == "edit"){
        let selectedQueries = "SELECT * FROM S_Queries WHERE Name = ?"
        let res = await executeQuery("fetchData",modelName,selectedQueries,[sessionStorage.qr_name])

        if (res.length === 0) {
            confirmBox('Alert!', 'No details found for the selected query.');
            return;
        }
        
        for(let item of res){
            document.getElementById("queryNm").value = item[1]
            document.getElementById("queryNm").disabled = true;
            document.getElementById("queryInp").value = item[2]
            document.getElementById("queryInp").disabled = true;
            document.getElementById("showSummary").checked = item[3] == 1 ? true : false
            document.getElementById("hideNullRows").checked = item[4] == 1 ? true : false
            document.getElementById("graphTypeNew").value = item[9]
            SelectedLevel = JSON.parse(item[5])
            SelectedSeries = JSON.parse(item[6])
            seriesProperties = JSON.parse(item[7])
            SelectedLayouts = JSON.parse(item[8]);

            const table = document.getElementById("advTable");
            let tbody = table.querySelector("tbody");
            if (!tbody) {
                tbody = get_cl_element("tbody");
                table.appendChild(tbody);
            } else {
                tbody.innerHTML = "";  // Clear previous content
            }
            
            for (const [seriesName, properties] of Object.entries(seriesProperties)) {
                get_advanced_table(seriesName, properties.Format, tbody);
                const select = tbody.querySelector(`tr:last-child td:nth-child(2) select`);
                select.value = properties.Agg;
            }
        }

        const col_name = `PRAGMA table_info(${document.getElementById("queryInp").value});`;

        let res_out = await executeQuery("fetchData", modelName, col_name);

        const {numericColumns, stringColumns} = get_all_agg(res_out)

        get_column_type(numericColumns, stringColumns);

    }
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

document.getElementById('selectQuery-ok').onclick = async function () {
    sessionStorage.qr_name = document.getElementById('selectQueries-table').querySelector('tr.selectedValue').innerText
    
    const bs_modal = bootstrap.Modal.getInstance(document.getElementById('select-querySheet'))
    bs_modal.hide()
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

function populate_worksheet_def() {

    if (Object.keys(wk_obj).length == 0) {
        return
    }
    
    document.getElementById("wkName").value = wk_obj["Name"]
    document.getElementById("openedWorksheetTitle").innerText = `Worksheet Designer: ${wk_obj["Name"]}`
    document.getElementById("wkDisplay").innerText = wk_obj["Name"]
    document.getElementById("wkName").disabled = true;
    document.getElementById("wkDescription").value = wk_obj["Description"]
    if (wk_obj["ShowSummary"] == 1) {
        document.getElementById("showSummary").checked = true
    } else {
        document.getElementById("showSummary").checked = false
    }

    if (wk_obj["hide_nullRows"] == 1) {
        document.getElementById("hideNullRows").checked = true
    } else {
        document.getElementById("hideNullRows").checked = false
    }

    document.getElementById("range_type").value = wk_obj["date_range_type"]
    if (wk_obj["date_range_type"] == "absolute"){
        document.getElementById("fromDate").value = wk_obj["from_date"]
        document.getElementById("toDate").value = wk_obj["to_date"]
        new Datepicker(document.getElementById("fromDate"), {format: 'yyyy-mm-dd',autohide: true,beforeShowDay:DisableDates})
        new Datepicker(document.getElementById("toDate"), {format: 'yyyy-mm-dd',autohide: true,beforeShowDay:DisableDates})
    } else {
        document.getElementById("fromPeriod").value = wk_obj["from_date"]
        document.getElementById("toPeriod").value = wk_obj["to_date"]
        document.getElementById("date_aggregation").value = wk_obj["time_bucket"]
    }
    var event = new Event('change');
    document.getElementById("range_type").dispatchEvent(event);

    remove_series("all")
    for (let series_id of wk_obj["SelectedSeries"]) {
        document.getElementById("available-series").
            querySelector(`li[series-id="${series_id}"]`).classList.add("selectedValue")
    }
    select_series("one")

    let selected_el = document.getElementById("selected-series")
    for (let series_id of wk_obj["SelectedSeries"]) {
        let el = selected_el.querySelector(`li[series-id="${series_id}"]`)
        selected_el.appendChild(el)
    }

    document.getElementById("removeAllAggregation").click()
    for (let el of document.getElementById("availableLevel")
        .querySelectorAll("input.inputcheckbox")) {
        if (wk_obj["SelectedLevels"].indexOf(el.parentNode.innerText) > -1) {
            select_aggregation_level(el.parentNode)
        }
    }

    populate_filters()

    document.getElementById("exception-row").innerHTML = ""
    for (let rw of wk_obj["ExceptionClause"]) {
        document.getElementById("addException").click()
        let el = document.getElementById("exception-row").lastChild
        el.querySelector(".exception-series select").value = rw[0]
        el.querySelector(".sign-lov select").value = rw[1]
        el.querySelector(".exception-value input").value = rw[2]
        el.querySelector(".exception-condition select").value = rw[3]
    }

    let all_layout = document.createElement("div")
    let layout_text = []
    for (let cn of document.getElementById("LayoutNewC").querySelectorAll("ul li")) {
        layout_text.push(cn.innerText)
        all_layout.appendChild(cn)
    }

    for (let lx of wk_obj["LayoutX"]) {
        let layout_node = all_layout.childNodes[layout_text.indexOf(lx)].cloneNode(true)
        document.getElementById("layoutX").appendChild(layout_node)
    }

    for (let lx of wk_obj["LayoutY"]) {
        let layout_node = all_layout.childNodes[layout_text.indexOf(lx)].cloneNode(true)
        document.getElementById("layoutY").appendChild(layout_node)
    }

    for (let lx of wk_obj["LayoutZ"]) {
        let layout_node = all_layout.childNodes[layout_text.indexOf(lx)].cloneNode(true)
        document.getElementById("layoutZ").appendChild(layout_node)
    }


    document.getElementById("graphTypeNew").value = wk_obj["GraphType"]

    document.getElementById("dp_removeall").click()
    for (let tr of document.getElementById("available-dependent").querySelectorAll("tr")) {
        if (tr.innerText == wk_obj["Name"]) {
            tr.style.display = "none"
        } else {
            tr.style.display = ""
        }

        if (wk_obj["DependentWorksheets"].indexOf(tr.innerText) > -1) {
            document.getElementById("selected-dependent").appendChild(tr)
        }
        if (tr.classList.contains("selectedValue")) {
            tr.classList.remove("selectedValue")
        }
    }

    document.getElementById("idp_removeall").click()
    for (let tr of document.getElementById("available-independent").querySelectorAll("tr")) {
        if (tr.innerText == wk_obj["Name"]) {
            tr.style.display = "none"
        } else {
            tr.style.display = ""
        }

        if (wk_obj["IndependentWorksheets"].indexOf(tr.innerText) > -1) {
            document.getElementById("selected-independent").appendChild(tr)
        }
        if (tr.classList.contains("selectedValue")) {
            tr.classList.remove("selectedValue")
        }
    }
    // document.getElementById("save_as_wk").style.display = ""
    if (wk_obj["Overwrite"] == 0) {
        // document.getElementById("save_wk").style.display = "none"
        document.getElementById("deleteWorksheetBtn").style.display = "none"
    } else {
        // document.getElementById("save_wk").style.display = ""
        document.getElementById("deleteWorksheetBtn").style.display = ""
    }

    let fav_el = document.getElementById("addFavourite").querySelector("span.sidebar-text-contracted")
    let fav_txt = document.getElementById("addFavourite").querySelector("span.sidebar-text")
    if(wk_obj["Favourites"] == 1){
        fav_el.classList.remove("fas")
        fav_el.classList.add("far")
        fav_txt.innerText = "Remove From Fav."
    }else{
        fav_el.classList.remove("far")
        fav_el.classList.add("fas")
        fav_txt.innerText = "Add To Favourites"
    }
}