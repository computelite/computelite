import * as bootstrap from 'bootstrap'
import { executeQuery, confirmBox, get_cl_element } from '../../../assets/js/scc'
import * as dfd from "danfojs";

const params = new URLSearchParams(window.location.search)
const modelName = params.get('modelName')
let pragmaResult = {}
let currTable = ''

document.addEventListener('DOMContentLoaded', async function () {
    let result = await executeQuery('init')
    if (!result || result.msg !== 'Success') {
        confirmBox('Alert!', 'Some error occurred while initializing SQLite.')
        return
    }
    await get_all_tables()
    
    const links = document.querySelectorAll('#queryUl li a.nav-link')
    links.forEach(link => {
        link.addEventListener('click', async function (e) {
            const fileName = link.firstElementChild.innerText
            if(fileName !== 'Display'){
                e.preventDefault()

                const query_val = document.getElementById('queryInp').value

                let col_name_query = `PRAGMA table_info(${query_val});`
                try {
                    if(query_val !== ''){

                        if(Object.keys(pragmaResult).length <= 0 || currTable != query_val){
                            
                            currTable = query_val
                            pragmaResult = await executeQuery("fetchData", modelName, col_name_query);
                            
                            const columnTypeInfo = pragmaResult.map(row => {
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
                            
                            // const df = new dfd.DataFrame(pragmaResult);
                            // const dtypes = df.dtypes;

                            // const numericColumns = [];
                            // const stringColumns = [];
                            

                            // dtypes.forEach((type, index) => {
                            //     const colName = df.columns[index];
                            //     if (type === "int32" || type === "float32") {
                            //         numericColumns.push(colName);
                            //     } else if (type === "string") {
                            //         stringColumns.push(colName);
                            //     }
                            // });
            
                            get_column_type(numericColumns,stringColumns)
                        }
                    }
    
                } catch (err) {
                    console.error('Error executing query:', err)
                    confirmBox('Error', err)
                }
            }
        })
    })
})


async function get_all_tables(){
    let query = `SELECT TableName FROM S_TableGroup WHERE Table_Status = 'Active'`
    let res = await executeQuery("fetchData", modelName, query);
    let queryOpt = document.getElementById('queryInp')

    for(let tbNm of res){
        const li_el  = get_cl_element('option',null,null,document.createTextNode(tbNm))
        li_el.setAttribute('value',tbNm)
        queryOpt.appendChild(li_el)
    }
    
}


function get_column_type(numeric,string){
    const num_ul = document.getElementById('availableLevel')
    const str_ul = document.getElementById('selectedLevel')
    num_ul.innerHTML = ""
    str_ul.innerHTML = ""

    for(let el of numeric){
        let jsData = get_cl_element('li', 'py-0 ps-1', null, null);
        let label = get_cl_element("label", "checkBox-label", null, 
            get_cl_element("span", "fas fa-file-alt" ), null);
        
        label.appendChild(document.createTextNode(el));
        jsData.appendChild(label);
        num_ul.appendChild(jsData);
    }

    for(let el of string){
        let jsData = get_cl_element('li', 'py-0 ps-1', null, null);
        let label = get_cl_element("label", "checkBox-label", null, 
            get_cl_element("span", "fas fa-file-alt" ), null);
        
        label.appendChild(document.createTextNode(el));
        jsData.appendChild(label);
        str_ul.appendChild(jsData);
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

        } else if (inner_text == "filters") {
            const tab = new bootstrap.Tab(document.getElementById('filters-new'));
            tab.show()

        } else if (inner_text == "exceptions") {
            const tab = new bootstrap.Tab(document.getElementById('exceptions-new'));
            tab.show()

        } else if (inner_text == "layout") {
            const tab = new bootstrap.Tab(document.getElementById('layout-new'));
            tab.show()

        } else if (inner_text == "new") {
            const tab = new bootstrap.Tab(document.getElementById('display-new'));
            tab.show()

            reset_new_wk_def()
        } else if (inner_text == "time") {
            const tab = new bootstrap.Tab(document.getElementById('time-new'));
            tab.show()
        } else if (inner_text == "embedded") {
            const tab = new bootstrap.Tab(document.getElementById('advanced-new'));
            tab.show()
        } else if (inner_text == "save as"){
            const tab = new bootstrap.Tab(document.getElementById('display-new'));
            tab.show()
            document.getElementById("QuName").value = "";
            document.getElementById("QuName").disabled = false;
            document.getElementById("queryInp").value = "";
            // document.getElementById("save_wk").style.display = "";
        } 

    }
})

function reset_new_wk_def() {
    document.getElementById("QuName").value = "";
    document.getElementById("QuName").disabled = false;
    document.getElementById("queryInp").value = "";
    document.getElementById("showSummary").checked = true
    // remove_series("all")
    document.getElementById("removeAllAggregation").click()
    document.getElementById("removeAllFilters").click()
    document.getElementById("graphTypeNew").value = "LineChart"
    document.getElementById("openedWorksheetTitle").innerText = `Query Designer`
    document.getElementById("wkDisplay").innerText = ""
}