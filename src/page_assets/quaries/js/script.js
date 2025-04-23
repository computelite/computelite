import * as bootstrap from 'bootstrap'
import { executeQuery, confirmBox, get_cl_element } from '../../../assets/js/scc'
import * as dfd from "danfojs";

const params = new URLSearchParams(window.location.search)
const modelName = params.get('modelName')
let pragmaResult = {}

document.addEventListener('DOMContentLoaded', async function () {
    let result = await executeQuery('init')
    if (!result || result.msg !== 'Success') {
        confirmBox('Alert!', 'Some error occurred while initializing SQLite.')
        return
    }

    const links = document.querySelectorAll('#queryUl li a.nav-link')
    links.forEach(link => {
        link.addEventListener('click', async function (e) {
            const fileName = link.firstElementChild.innerText
            if(fileName !== 'Display'){
                e.preventDefault()

                const query_val = document.getElementById('queryInp').value
                let tableMatch = query_val.match(/from\s+([^\s;]+)/i);
                let tableName = tableMatch ? tableMatch[1] : null;

                let col_name_query = `PRAGMA table_info(${tableName});`
                try {
                    if(query_val !== ''){

                        if(Object.keys(pragmaResult).length <= 0){
                            
                            // pragmaResult = await executeQuery("fetchData", modelName, query_val);

                            pragmaResult = await executeQuery("fetchData", modelName, col_name_query);
                            
                            const columnTypeInfo = pragmaResult.map(row => {
                                const [cid, name, type] = row;
                                return { column: name, type: type.toUpperCase() };
                            });

                            const numericTypes = ['INTEGER', 'REAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'DECIMAL'];
                            const stringTypes = ['TEXT', 'VARCHAR', 'CHAR', 'CLOB'];
                            
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

function get_column_type(numeric,string){
    const num_ul = document.getElementById('availableLevel')
    const str_ul = document.getElementById('selectedLevel')

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
