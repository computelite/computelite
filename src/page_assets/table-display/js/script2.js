import { column_formatters,col_names,get_table_row,add_insert_row } from "./script.js"

const table_el = document.getElementById("displayTable")
let initial_row_values = []

let div_map = {
    "searchSelectedPeriodMembers":"selectedPeriodMembers",
    "searchAvailablePeriodMembers":"availablePeriodMembers",
    "searchSelectedModeMembers":"selectedModeMembers",
    "searchAvailableModeMembers":"availableModeMembers",
    "searchSelectedSrcLocationMembers":"selectedSrcLocationMembers",
    "searchAvailableSrcLocationMembers":"availableSrcLocationMembers",
    "searchSelectedDestLocationMembers":"selectedDestLocationMembers",
    "searchAvailableDestLocationMembers":"availableDestLocationMembers",
    "searchSelectedItemMembers":"selectedItemMembers",
    "searchAvailableItemMembers":"availableItemMembers"
}

let constraint_dict = {"itm":["availableItemLevel","selectedItemLevel","availableItemMembers","selectedItemMembers","Item-data-loader","item-new"],"sl":["availableSrcLocationLevel","selectedSrcLocationLevel","availableSrcLocationMembers","selectedSrcLocationMembers","srcLocation-data-loader","src-location-new"],"dl":["availableDestLocationLevel","selectedDestLocationLevel","availableDestLocationMembers","selectedDestLocationMembers","destLocation-data-loader","dest-location-new"],"prd":["availablePeriodLevel","selectedPeriodLevel","availablePeriodMembers","selectedPeriodMembers","Period-data-loader","period-new"],"tp":["availableModeLevel","selectedModeLevel","availableModeMembers","selectedModeMembers","Mode-data-loader","mode-new"]}


const findtr = function (e) {
    let el = e.target
    let colname = el.getAttribute("colname")
    let tbody_id = div_map[el.id]
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



document.getElementById("buttonSelectedItemMembers").onclick = toggle_search.bind(null, "searchSelectedItemMembers","selectedItemLevel")
document.getElementById("buttonAvailableItemMembers").onclick = toggle_search.bind(null, "searchAvailableItemMembers","selectedItemLevel")
document.getElementById("buttonSelectedSrcLocationMembers").onclick = toggle_search.bind(null, "searchSelectedSrcLocationMembers","selectedSrcLocationLevel")
document.getElementById("buttonAvailableSrcLocationMembers").onclick = toggle_search.bind(null, "searchAvailableSrcLocationMembers","selectedSrcLocationLevel")
document.getElementById("buttonSelectedDestLocationMembers").onclick = toggle_search.bind(null, "searchSelectedDestLocationMembers","selectedDestLocationLevel")
document.getElementById("buttonAvailableDestLocationMembers").onclick = toggle_search.bind(null, "searchAvailableDestLocationMembers","selectedDestLocationLevel")
document.getElementById("buttonSelectedPeriodMembers").onclick = toggle_search.bind(null, "searchSelectedPeriodMembers","selectedPeriodLevel")
document.getElementById("buttonAvailablePeriodMembers").onclick = toggle_search.bind(null, "searchAvailablePeriodMembers","selectedPeriodLevel")
document.getElementById("buttonSelectedModeMembers").onclick = toggle_search.bind(null, "searchSelectedModeMembers","selectedModeLevel")
document.getElementById("buttonAvailableModeMembers").onclick = toggle_search.bind(null, "searchAvailableModeMembers","selectedModeLevel")



document.getElementById("Item_allLeft").onclick = click_button.bind(null, "selectedItemMembers", "availableItemMembers", "all");
document.getElementById("Item_oneLeft").onclick = click_button.bind(null, "selectedItemMembers", "availableItemMembers", "one");
document.getElementById("Item_oneRight").onclick = click_button.bind(null, "availableItemMembers", "selectedItemMembers", "one");
document.getElementById("Item_allRight").onclick = click_button.bind(null, "availableItemMembers", "selectedItemMembers", "all");
document.getElementById("srcLocation_allLeft").onclick = click_button.bind(null, "selectedSrcLocationMembers", "availableSrcLocationMembers", "all");
document.getElementById("srcLocation_oneLeft").onclick = click_button.bind(null, "selectedSrcLocationMembers", "availableSrcLocationMembers", "one");
document.getElementById("srcLocation_oneRight").onclick = click_button.bind(null, "availableSrcLocationMembers", "selectedSrcLocationMembers", "one");
document.getElementById("srcLocation_allRight").onclick = click_button.bind(null, "availableSrcLocationMembers", "selectedSrcLocationMembers", "all");
document.getElementById("destLocation_allLeft").onclick = click_button.bind(null, "selectedDestLocationMembers", "availableDestLocationMembers", "all");
document.getElementById("destLocation_oneLeft").onclick = click_button.bind(null, "selectedDestLocationMembers", "availableDestLocationMembers", "one");
document.getElementById("destLocation_oneRight").onclick = click_button.bind(null, "availableDestLocationMembers", "selectedDestLocationMembers", "one");
document.getElementById("destLocation_allRight").onclick = click_button.bind(null, "availableDestLocationMembers", "selectedDestLocationMembers", "all");
document.getElementById("Period_allLeft").onclick = click_button.bind(null, "selectedPeriodMembers", "availablePeriodMembers", "all");
document.getElementById("Period_oneLeft").onclick = click_button.bind(null, "selectedPeriodMembers", "availablePeriodMembers", "one");
document.getElementById("Period_oneRight").onclick = click_button.bind(null, "availablePeriodMembers", "selectedPeriodMembers", "one");
document.getElementById("Period_allRight").onclick = click_button.bind(null, "availablePeriodMembers", "selectedPeriodMembers", "all");
document.getElementById("Mode_allLeft").onclick = click_button.bind(null, "selectedModeMembers", "availableModeMembers", "all");
document.getElementById("Mode_oneLeft").onclick = click_button.bind(null, "selectedModeMembers", "availableModeMembers", "one");
document.getElementById("Mode_oneRight").onclick = click_button.bind(null, "availableModeMembers", "selectedModeMembers", "one");
document.getElementById("Mode_allRight").onclick = click_button.bind(null, "availableModeMembers", "selectedModeMembers", "all");



document.getElementById("removeAllItemFilters").onclick = click_button.bind(null, "selectedItemLevel", "availableItemLevel", "removeAll");
document.getElementById("removeAllSrcLocationFilters").onclick = click_button.bind(null, "selectedSrcLocationLevel", "availableSrcLocationLevel", "removeAll");
document.getElementById("removeAllDestLocationFilters").onclick = click_button.bind(null, "selectedDestLocationLevel", "availableDestLocationLevel", "removeAll");
document.getElementById("removeAllPeriodFilters").onclick = click_button.bind(null, "selectedPeriodLevel", "availablePeriodLevel", "removeAll");
document.getElementById("removeAllModeFilters").onclick = click_button.bind(null, "selectedModeLevel", "availableModeLevel", "removeAll");



document.getElementById("searchSelectedItemMembers").onkeyup = findtr
document.getElementById("searchAvailableItemMembers").onkeyup = findtr
document.getElementById("searchSelectedSrcLocationMembers").onkeyup = findtr
document.getElementById("searchAvailableSrcLocationMembers").onkeyup = findtr
document.getElementById("searchSelectedDestLocationMembers").onkeyup = findtr
document.getElementById("searchAvailableDestLocationMembers").onkeyup = findtr
document.getElementById("searchSelectedPeriodMembers").onkeyup = findtr
document.getElementById("searchAvailablePeriodMembers").onkeyup = findtr
document.getElementById("searchSelectedModeMembers").onkeyup = findtr
document.getElementById("searchAvailableModeMembers").onkeyup = findtr



// document.getElementById("constraint-setting").onclick = function(){ 
//     const tbl = table_el.querySelector("tbody")
//     const selected_len = tbl.querySelectorAll("input:checked").length

//     if (selected_len>1){
//         confirmBox("Alert!", "Please select only one row at a time to proceed")
//         return
//     }
    
//     get_constraint_tabs()   

//     const bs_modal = new bootstrap.Modal(document.getElementById("modal-flow-constraint"))
//     bs_modal.show()    
//     hide_search()
// }


async function get_constraint_tabs() {

    const data = await postData("/forecast-setup/get-aggregation-levels")

    for (let tab in constraint_dict){
        let avail_filter = document.getElementById(constraint_dict[tab][0])
        let select_filter = document.getElementById(constraint_dict[tab][1])
        let avail_mem = document.getElementById(constraint_dict[tab][2])
        let select_mem = document.getElementById(constraint_dict[tab][3])
        let loader = document.getElementById(constraint_dict[tab][4])
        let tab_el = document.getElementById(constraint_dict[tab][5]).querySelector('span')
        avail_filter.innerHTML = ""
        select_filter.innerHTML = ""
        avail_mem.innerHTML = ""
        select_mem.innerHTML = ""
    
        
        for (let key in data) {
            for (const [idx, level_tuple] of data[key].entries()) {
                if(level_tuple[1].split("_")[0]==tab){
                    if (idx == 0) {
                        
                        if (tab_el.childNodes.length==1){
                            tab_el.insertBefore(get_scc_element('span',`fas ${level_tuple[2]} pr-2`),tab_el.firstChild)
                        }
                        
                        avail_filter.appendChild(get_scc_element("li"))
                        let li_element = get_constraint_li_element(level_tuple[0],
                            level_tuple[1].toLowerCase(), level_tuple[2], "available",avail_filter,select_filter,avail_mem,select_mem,loader)
                        li_element.classList.add('head-selector')
                        avail_filter.appendChild(li_element)
                    } else {
                        if (idx == 1) {
                            avail_filter.appendChild(get_scc_element("ul", "childList TreeMembers"))
                        }
                        let node_list = avail_filter.querySelectorAll("ul.childList")
                        let tl = node_list[node_list.length - 1]
                        tl.appendChild(get_constraint_li_element(level_tuple[0],
                            level_tuple[1].toLowerCase(), level_tuple[2], "available",avail_filter,select_filter,avail_mem,select_mem,loader))
                    }
    
                }
            }
        }
    }  
 
    get_row_data()
}


function get_constraint_li_element(level_name, level_id, level_class, filter_level = "none",avail_filter,select_filter,avail_mem,select_mem,loader) {

    let el = get_scc_element("li", null, null, get_scc_element("input", "inputcheckbox"))
    el.firstChild.setAttribute("type", "checkbox")
    el.firstChild.value = level_id

    let label = get_scc_element("label", "checkBox-label", null,
        get_scc_element("span", `fas ${level_class}`), null)
    label.appendChild(document.createTextNode(level_name))

    el.appendChild(label)

    if (filter_level == "none") {
        el.onclick = function () {
            select_aggregation_level(this)
        }
    } else if (filter_level == "selected") {
        el.onclick = function () {
            hide_search()
            select_selected_filter_level(this,avail_filter,select_filter,avail_mem,select_mem,loader)
        }
    } else if (filter_level == "available") {
        el.onclick = function () {
            hide_search()
            select_avl_filter_level(this,avail_filter,select_filter,avail_mem,select_mem,loader)
        }
    }
    return el
}


function select_aggregation_level(li_el) {
    let parent_div = get_parent_div(li_el)
    let dest_id = parent_div.getAttribute("dest")

    if (li_el.parentNode.tagName == "UL") {
        if (li_el.firstChild.checked) {
            li_el.firstChild.checked = false
            for (let el of document.getElementById(dest_id).querySelectorAll("li")) {
                if (el.firstChild.value == li_el.firstChild.value) {
                    document.getElementById(dest_id).removeChild(el)
                    break;
                }
            }

            for (let layout of layout_el) {
                let l_el = document.getElementById(layout)
                for (let cn of l_el.querySelectorAll("li")) {
                    if (cn.getAttribute("value") == li_el.firstChild.value) {
                        cn.remove()
                    }
                }
            }


        }
        else {
            li_el.firstChild.checked = true;
            let new_el = li_el.cloneNode(true);
            new_el.style.paddingLeft = "15px";
            new_el.onclick = function () {
                select_aggregation_level(this)
            }
            document.getElementById(dest_id).appendChild(new_el)

            // Add in layout tab

            let layout_li = get_scc_element("li")
            layout_li.appendChild(li_el.querySelector("span").cloneNode(true))
            layout_li.appendChild(document.createTextNode(li_el.innerText))
            layout_li.setAttribute("value", li_el.firstChild.value)
            document.getElementById("layoutY").appendChild(layout_li)

            // End Layout tab

        }
    } else if (li_el.parentNode.tagName == "DIV") {
        li_el.parentNode.removeChild(li_el)
        for (let el of document.getElementById(dest_id)
            .querySelectorAll("input.inputcheckbox")) {
            if (el.checked && el.value == li_el.firstChild.value) {
                el.checked = false;
            }
        }
        for (let layout of layout_el) {
            let l_el = document.getElementById(layout)
            for (let cn of l_el.querySelectorAll("li")) {
                if (cn.getAttribute("value") == li_el.firstChild.value) {
                    cn.remove()
                }
            }
        }
    }
}

function get_parent_div(el) {
    let z = null
    if (el.classList.contains("parent-div")) {
        return el
    }
    else {
        z = get_parent_div(el.parentNode)
    }

    return z
}

function click_button(src_table, dest_table, bt_type) {

    if (bt_type == "all") {
        for (let trd of document.getElementById(src_table).querySelectorAll("tr")) {
            if (trd.style.display !== "none") {
                document.getElementById(dest_table).appendChild(trd)
            }
        }
        hide_search()

    } else if (bt_type == "one") {
        for (let trd of document.getElementById(src_table).querySelectorAll("tr.selectedValue")) {
            document.getElementById(dest_table).appendChild(trd)
            trd.classList.remove("selectedValue")
        }

    }
    else if (bt_type == "addAll") {

        for (let el of document.getElementById(src_table).querySelectorAll("input.inputcheckbox")) {
            if (!el.checked) {
                select_aggregation_level(el.parentNode)
            }
        }
    } else if (bt_type == "removeAll") {

        for (let el of document.getElementById(dest_table).querySelectorAll("input.inputcheckbox")) {
            if (el.checked) {
                el.parentNode.click()
            }
        }
    }

}

async function select_avl_filter_level(li_el,avail_filter,select_filter,avail_mem,select_mem,loader) {

    let parent_div = get_parent_div(li_el)
    let dest_id = parent_div.getAttribute("dest")
    let dest_el = document.getElementById(dest_id)
    let input_el = li_el.querySelector("input")
    let level_name = li_el.innerText
    let level_id = input_el.value
    let level_class = li_el.querySelector("span.fas").classList[1]

    if (!input_el.checked) {

        if (dest_el.childNodes.length == 0) {
            let selected_el = get_constraint_li_element(level_name, level_id, level_class, "selected",avail_filter,select_filter,avail_mem,select_mem,loader)
            selected_el.setAttribute("fetch", false)
            selected_el.style.paddingLeft = "15px";
            dest_el.appendChild(selected_el)
            input_el.checked = true
            await select_selected_filter_level(selected_el,avail_filter,select_filter,avail_mem,select_mem,loader)

        } else {

            var selector_div = select_filter.lastChild
            var colname = selector_div.firstChild.value
            var l = select_mem.querySelectorAll(`tr[colname="${colname}"]`).length
            if (l > 0) {
                let selected_el = get_constraint_li_element(level_name, level_id, level_class, "selected",avail_filter,select_filter,avail_mem,select_mem,loader)
                selected_el.setAttribute("fetch", false)
                selected_el.style.paddingLeft = "15px";
                dest_el.appendChild(selected_el)
                input_el.checked = true
                await select_selected_filter_level(selected_el,avail_filter,select_filter,avail_mem,select_mem,loader)
            } else {
                for (let ex of avail_filter.querySelectorAll("input.inputcheckbox")) {
                    if (ex.value == colname && ex.checked) {
                        ex.checked = false;
                        for (let trd of avail_mem.querySelectorAll(`tr[colname="${level_id}"]`)) {
                            trd.remove()
                        }

                        break;
                    }
                }
                selector_div.remove()
                select_avl_filter_level(li_el,avail_filter,select_filter,avail_mem,select_mem,loader)
            }
        }
    } else {
        var class_flag = 0
        for (let ex of select_filter.querySelectorAll("li")) {
            if (ex.innerText == level_name) {
                if (ex.classList.contains("selectedValue")) {
                    class_flag = 1
                }
                ex.remove()
                for (let trd of select_mem.querySelectorAll(`tr[colname="${level_id}"]`)) {
                    trd.remove()
                }
                for (let trd of avail_mem.querySelectorAll(`tr[colname="${level_id}"]`)) {
                    trd.remove()
                }
                input_el.checked = false
                break;
            }
        }
        if (class_flag == 1 && select_filter.childNodes.length > 0) {

            await select_selected_filter_level(select_filter.lastChild,avail_filter,select_filter,avail_mem,select_mem,loader)
        }
    }
}

async function select_selected_filter_level(li_el,avail_filter,select_filter,avail_mem,select_mem,loader) {
    if (!li_el.classList.contains("selectedValue")) {
        for (let cn of li_el.parentNode.childNodes) {
            cn.classList.remove("selectedValue")
        }
        li_el.classList.add("selectedValue")
        for (let trd of avail_mem.querySelectorAll("tr")) {
            trd.style.display = "none"
        }
        for (let trd of select_mem.querySelectorAll("tr")) {
            trd.style.display = "none";
        }
        let new_profile = {}


        if (li_el.getAttribute("fetch") === "false") {
            let filter_obj = {}
            for (let tr of select_mem.childNodes) {
                let colname = tr.getAttribute("colname")
                if (colname !== li_el.firstChild.value) {
                    if (Object.keys(filter_obj).indexOf(colname) > -1) {
                        filter_obj[colname].push(tr.firstChild.innerText)
                    } else {
                        filter_obj[colname] = [tr.firstChild.innerText]
                    }

                }
            }
            const col_name = li_el.firstChild.value
            let c_specific = select_mem.getAttribute("c_specific")
            let c_data = {
                'col_name': col_name,
                'filter_obj': filter_obj,
                'time_obj': new_profile
            }
            if (c_specific){
                c_data["from_master"] = "yes"
            }
            
            loader.style.display = ""
            let result = await postData('/forecast-setup/get-filter-members', c_data)
            loader.style.display = "none"

            populate_available_filter(col_name, result,select_filter,avail_mem)
        }
        else {
            let col_name = li_el.firstChild.value
            for (let trd of avail_mem.querySelectorAll(`tr[colname="${col_name}"]`)) {
                trd.style.display = ""
            }
            for (let trd of select_mem.querySelectorAll(`tr[colname="${col_name}"]`)) {
                trd.style.display = "";
            }
        }
    }
}

function populate_available_filter(colname, result,select_filter,avail_mem) {
    for (let el of select_filter.childNodes) {
        if (el.firstChild.value == colname) {
            if (el.classList.contains("selectedValue")) {
                for (let avl_mem of result) {
                    avail_mem.appendChild(get_tr_element(avl_mem, colname))
                }
            }
            el.setAttribute("fetch", true)
            break;
        }
    }
}

function get_tr_element(member_name, colname = "xx") {
    let tr = document.createElement("tr")
    tr.setAttribute("colname", colname)
    tr.appendChild(document.createElement("td"))
    tr.firstChild.classList.add("border-remove")
    tr.style.userSelect = "none";
    tr.style.borderBottom = "thin solid #89CFF0"
    tr.firstChild.innerText = member_name
    
    tr.onclick = function (e) {
        if (!e.ctrlKey) {
            for (let cn of this.parentNode.querySelectorAll("tr.selectedValue")) {
                cn.classList.remove("selectedValue")
            }
        }
        this.classList.add("selectedValue")
        e.preventDefault();
    }

    tr.ondblclick = function () {
        let new_col_name = this.parentNode.getAttribute("destination-table")
        document.getElementById(new_col_name).appendChild(get_tr_element(member_name, colname))
        this.remove()
    }
    return tr
}

function toggle_search(button_id,selector) {
    let search_div = document.getElementById(div_map[button_id])
    let button_div = document.getElementById(button_id)
    if (button_div.style.display == "none") {
        hide_search()
        if (search_div.childNodes.length > 0) {
            const selector_div = document.getElementById(selector).querySelector("li.selectedValue")
            if (selector_div !== null) {
                const colname = selector_div.firstChild.value
                button_div.setAttribute("colname", colname)
                button_div.style.display = '';
                button_div.focus()
            }
        }

    } else {
        hide_search()
    }
}


function hide_search() {

    let search_divs = ["searchAvailablePeriodMembers","searchSelectedPeriodMembers",
    "searchAvailableModeMembers","searchSelectedModeMembers",
    "searchAvailableSrcLocationMembers","searchSelectedSrcLocationMembers","searchAvailableDestLocationMembers","searchSelectedDestLocationMembers","searchAvailableItemMembers","searchSelectedItemMembers"]

    for (let search_div_id of search_divs) {
        let input_div = document.getElementById(search_div_id)
        if (input_div.style.display !== "none") {
            input_div.style.display = "none"
            let tbody_id = document.getElementById(div_map[search_div_id])
            let colname = input_div.getAttribute("colname")
            for (let trd of tbody_id.querySelectorAll(`tr[colname="${colname}"]`)) {
                trd.style.display = "";
            }
            input_div.value = ""
        }
    }
}

async function get_row_data(){

    const tbl = table_el.querySelector("tbody")

    let selected_row = tbl.querySelector("input:checked")
    if (!selected_row){
        selected_row = tbl.querySelector("tr.insert").childNodes
    }else{
        selected_row = selected_row.parentNode.parentNode.childNodes
    }

    const col_prefixes = await postData("/grid/get-column-prefixes")
    // const col_prefixes = {'SOURCELOCATION':['sl','location'],'DESTINATIONLOCATION':['dl','location'],'ITEM':['itm','item'],'PERIODNAME':['prd','period'],'MODE':['tp','mode']}

    let not_in_cols = []
    let filter_values = {} 

    for (let [idx,cn] of selected_row.entries()){
        if(col_names[idx] in col_prefixes[sessionStorage.table_name]){
            let value = cn.innerText.trim()
            let col_name = col_prefixes[sessionStorage.table_name][col_names[idx]][1]
            let prefix = col_prefixes[sessionStorage.table_name][col_names[idx]][0]
            let level_name = `${prefix}_${col_name}`
            if(value.charAt(0)=='<'&& value.charAt(value.length-1) =='>'){
                let str = value.replace(/[<>]/g,"")
                // let col_name = str.trim().split(" ")[0]               

                if(str.search('not')>-1){
                    not_in_cols.push(level_name)
                }

                let values = str.slice(str.indexOf('(')+1, str.lastIndexOf(')'));
                values = values.toLowerCase()

                let val_arr = values.replace(/['"]/g,"").split(",")
                filter_values[level_name] = val_arr   

            }else if(value.trim()!="" && value.trim()!="All"){
                filter_values[level_name] = [value.trim().toLowerCase()]
            }
        }
    }

    document.getElementById("removeAllItemFilters").click()
    document.getElementById("removeAllSrcLocationFilters").click()
    document.getElementById("removeAllDestLocationFilters").click()
    document.getElementById("removeAllPeriodFilters").click()
    document.getElementById("removeAllModeFilters").click()

    for (let level_name in filter_values) {
        
        let tab_ids = constraint_dict[level_name.split('_',1)[0]]

        let avail_filter = document.getElementById(tab_ids[0])
        let select_filter = document.getElementById(tab_ids[1])
        let avail_mem = document.getElementById(tab_ids[2])
        let select_mem = document.getElementById(tab_ids[3])
        let loader = document.getElementById(tab_ids[4])

        let el = avail_filter.querySelector(`input[value="${level_name}"]`)
        if(el){
            await select_avl_filter_level(el.parentNode,avail_filter,select_filter,avail_mem,select_mem,loader)
            if (not_in_cols.indexOf(level_name)>-1){
                for (let trd of avail_mem.querySelectorAll(`tr[colname=${level_name}]`)) {
                    if (filter_values[level_name].indexOf(trd.innerText.trim().toLowerCase()) < 0 && trd.style.display != "none") {
                        select_mem.appendChild(trd)
                    }                    
                }
            }
            else{
                let ct = 0
                let len = avail_mem.querySelectorAll(`tr[colname=${level_name}]`).length
                
                for (let trd of avail_mem.querySelectorAll(`tr[colname=${level_name}]`)) {
                    
                    if (filter_values[level_name].indexOf(trd.innerText.trim().toLowerCase()) > -1) {
                        select_mem.appendChild(trd)
                    }else{
                        ct+=1
                    }
                }
                if(ct==len){
                    el.parentNode.click()
                }
            }
            
        }else{
            console.log("error",level_name)
        }
        
    }
}


function get_other_columns(){
    const tbl = table_el.querySelector("tbody")
    let selected_row = tbl.querySelector("input:checked")
    let insert = false
    if(!selected_row){
        insert = true
        selected_row = tbl.querySelector("tr.insert").childNodes
    }else{
        selected_row = selected_row.parentNode.parentNode.childNodes
    }
    initial_row_values = []

    let not_selected_cols = ['SOURCETYPE','SOURCELOCATION','DESTINATIONTYPE','DESTINATIONLOCATION','ITEMTYPE','ITEM','PERIODTYPE','PERIODNAME','MODETYPE','MODE']

    const tbl_div = document.getElementById("columns-div")
    tbl_div.innerHTML = ""

    for (const [idx, cn] of selected_row.entries()) {
        let main_div = get_scc_element("div","row align-items-center py-2 mt-2")
        let autofill_flag = false
        let col_val
        if (idx == 0) {
            initial_row_values.push(cn.id)
        }
        else if (idx > 0 && !not_selected_cols.includes(col_names[idx])) {
            let label = get_scc_element("div","col-5",null,get_scc_element("label",null,null,document.createTextNode(col_names[idx])))
            main_div.appendChild(label)
            let input_el
            if (cn.innerText == "") {
                col_val = null
            } else if (col_names[idx] in column_formatters["decimals"]) {
                if (cn.getAttribute("title") === null) {
                    col_val = ""
                } else {

                    if(isNaN(parseFloat(cn.getAttribute("title")))) {
                        col_val = (cn.getAttribute("title"))
                    }else {
                        col_val = parseFloat(cn.getAttribute("title"))
                    }
                    
                }
            } else {
                col_val = cn.innerText
            }
            initial_row_values.push(col_val)
            let input_div = get_scc_element("div","col-7")
            if (col_names[idx] in column_formatters["lov"]) {
                input_el = get_scc_element("select", "form-select", null)
                for (let opt_val of column_formatters["lov"][col_names[idx]]) {
                    let el = get_scc_element("option", null, null, document.createTextNode(opt_val))
                    input_el.appendChild(el)
                }

            } else if (col_names[idx] in column_formatters["autofiller"]) {
                input_div.style.display = "flex"
                input_el = get_scc_element("input", "form-control", null)
                autofill_flag = true
            } else if (col_names[idx] in column_formatters["decimals"]) {
                input_el = get_scc_element("input", "form-control", null)
                // input_el.type = "number"
            } else if (column_formatters["date"] && col_names[idx] in column_formatters["date"]){
                input_el = get_scc_element("input", "form-control datepicker-input", null) 
                new Datepicker(input_el, {format: "yyyy-mm-dd", autohide: true})
                input_el.type = "text"
            }
            else {
                input_el = get_scc_element("input", "form-control", null)
                input_el.type = "text"
            }
            if (!insert){
                input_el.value = col_val
            }

            input_div.appendChild(input_el)
            main_div.appendChild(input_div)
            tbl_div.appendChild(main_div)
            if (autofill_flag){
                new Awesomplete(input_el,{
                    list:column_formatters["autofiller"][col_names[idx]],
                    tabSelect: true                    
                })
                input_el.parentNode.style.flex = 1;
            }
        }else{
            
            if (cn.innerText == "") {
                col_val = null
            }else {
                col_val = cn.innerText
            }
            initial_row_values.push(col_val)
        }
    }
}

function show_tabs(){
    let tab_cols = {'ITEM':'item-new','SOURCELOCATION':'src-location-new','DESTINATIONLOCATION':'dest-location-new','PERIODNAME':'period-new','MODE':'mode-new'}

    let i = 0
    for (let col_name in tab_cols){
        if(col_names.indexOf(col_name)>-1){
            document.getElementById(tab_cols[col_name]).parentNode.style.display = ''
            if (i==0){
                document.getElementById(tab_cols[col_name]).click()
                i+=1
            }
        }else{
            document.getElementById(tab_cols[col_name]).parentNode.style.display = 'none'   
        }
    }
}

document.getElementById("modal-flow-constraint").addEventListener('show.bs.modal',function(){
    const tbl = table_el.querySelector("tbody")
    let select_ids = {ITEMTYPE:'itemType',SOURCETYPE:'srcType',DESTINATIONTYPE:'destType',PERIODTYPE:'prdType',MODETYPE:'modeType'}
    
    get_other_columns()
    show_tabs() 
    
    let selected_row = tbl.querySelector("input:checked")
    for (let key in select_ids){
        let select_el = document.getElementById(select_ids[key])
        select_el.innerHTML = ''
        if(col_names.indexOf(key)>-1){
            for (let opt of column_formatters['lov'][key]){
                let opt_el = get_scc_element('option',null,null,document.createTextNode(opt))
                opt_el.setAttribute('value',opt)
                select_el.appendChild(opt_el)
            }
            if(selected_row){
                select_el.value = initial_row_values[col_names.indexOf(key)]
            } 
        }        
    }

})

document.getElementById('item-new').onclick = function(){
    get_type_row('itmTypeRow')
}

document.getElementById('src-location-new').onclick = function(){
    get_type_row('srcTypeRow')    
}

document.getElementById('dest-location-new').onclick = function(){
    get_type_row('destTypeRow')
}

document.getElementById('period-new').onclick = function(){
    get_type_row('prdTypeRow')    
}

document.getElementById('mode-new').onclick = function(){
    get_type_row('modeTypeRow')
}

document.getElementById('details-new').onclick = function(){
    get_type_row()
}

function get_type_row(tab_id){
    let type_div = document.getElementById(tab_id)

    for (let el of document.getElementById('headerDiv').querySelectorAll('div.row')){
        el.style.display = 'none'
    }

    if(type_div){
        let col_name = type_div.querySelector('h6').innerText
        if(col_names.indexOf(col_name)>-1){
            type_div.style.display = ''
        }
    }
    
}

    
document.getElementById("ok-constraint").onclick = function(){
    let new_profile = {}
    new_profile["SelectedLvlFilterData"] = {}

    let selected_filters = [["availableItemLevel","selectedItemLevel","availableItemMembers","selectedItemMembers",'ITEM'],["availableSrcLocationLevel","selectedSrcLocationLevel","availableSrcLocationMembers","selectedSrcLocationMembers",'SOURCELOCATION'],["availableDestLocationLevel","selectedDestLocationLevel","availableDestLocationMembers","selectedDestLocationMembers",'DESTINATIONLOCATION'],["availablePeriodLevel","selectedPeriodLevel","availablePeriodMembers","selectedPeriodMembers","PERIODNAME"],["availableModeLevel","selectedModeLevel","availableModeMembers","selectedModeMembers","MODE"]]

    for (let rw of selected_filters){
        const exact_col_name = rw[4]
        let avail_mem = document.getElementById(rw[2])
        let select_mem = document.getElementById(rw[3])
        let select_filter = document.getElementById(rw[1]).childNodes
        
        for (let tr of select_filter){
            let col_name = tr.querySelector("input").value
            let avail_members = avail_mem.querySelectorAll(`tr[colname=${col_name.trim()}]`)
            let selected_members = select_mem.querySelectorAll(`tr[colname=${col_name}]`)
            let header_el = document.getElementById(rw[0]).querySelector('li.head-selector')
            let header_check = false
            if (header_el){
                header_check = header_el.querySelector('input').checked
            }
            
            if(header_check && select_filter.length==1 && selected_members.length==1 ){
                new_profile[exact_col_name] = selected_members[0].firstChild.innerText 
                
            }else if (selected_members.length>avail_members.length && avail_members.length>0){
                for (let new_cn of avail_members){
                    if (Object.keys(new_profile["SelectedLvlFilterData"]).indexOf(col_name) > -1) { 
                        new_profile["SelectedLvlFilterData"][col_name]['where_not_in'].push(new_cn.firstChild.innerText)
                    }else{
                        let val_obj = {where_in:[],where_not_in:[new_cn.firstChild.innerText]}
                        new_profile["SelectedLvlFilterData"][col_name] = val_obj   
                    }
                }
                
            }else{
                for (let new_cn of selected_members){
                    if (Object.keys(new_profile["SelectedLvlFilterData"]).indexOf(col_name) > -1) { 
                        new_profile["SelectedLvlFilterData"][col_name]['where_in'].push(new_cn.firstChild.innerText)
                    }else{
                        let val_obj = {where_in:[new_cn.firstChild.innerText],where_not_in:[]}
                        new_profile["SelectedLvlFilterData"][col_name] = val_obj   
                    }
                }
            }
            
        }
         
    }
    for (let cn of document.getElementById("columns-div").childNodes){
        let col_name = cn.firstChild.firstChild.innerText
        let col_value = cn.lastChild.firstChild.value
        new_profile[col_name] = col_value
    }

    for (let cn of document.getElementById("headerDiv").querySelectorAll('div.row')){
        let col_name = cn.querySelector('h6').innerText
        let col_value = cn.querySelector('select').value
        new_profile[col_name] = col_value
    }


    let updated_row = get_updated_constraint(new_profile)
    if(detect_changes(updated_row)){
        const tbl_body = table_el.querySelector("tbody")
        let selected_row = tbl_body.querySelector("input:checked")
        let insert = false
        if(!selected_row){
            insert = true
            selected_row = tbl_body.querySelector("tr.insert")
        }else{
            selected_row = selected_row.parentNode.parentNode
        }
        let update_dict = new Object
        for (const [idx, val] of updated_row.entries()) {
            if (val !== initial_row_values[idx]) {
                update_dict[col_names[idx]] = val
            }
        }

        // current_row_id = 0
        
        if(insert){
            postData('/grid/insert_row', {
                insert_dict: update_dict
            }).then(x => {
                if ("Success" in x) {
                    updated_row[0] = x['Success']
                    initial_row_values = []
                    const summary_el = tbl_body.lastChild
                    let new_row = get_table_row(updated_row)                
                    selected_row.remove()
                    tbl_body.appendChild(new_row)
                   
                    tbl_body.appendChild(add_insert_row())
                    tbl_body.appendChild(summary_el)
                }else {
                    confirmBox("Error!", `Error:  ${x["Error"]}`)
                }
                
            })
        }else{
            postData('/grid/update_row', {
                rowid: initial_row_values[0],
                primary_col: document.getElementById("selectAll").parentNode.id,
                update_dict: update_dict
            }).then(x => {
                initial_row_values = []
                let new_row = get_table_row(updated_row)                
                selected_row.parentNode.replaceChild(new_row, selected_row)
                new_row.querySelector('input.form-check-input').checked = true 
            })

        }   
        
    }
    const bs_modal = bootstrap.Modal.getInstance(document.getElementById("modal-flow-constraint"))
    bs_modal.hide()
    
    
}

function get_updated_constraint(new_profile){
    let update_row = []

    for (let [idx,name] of col_names.entries()){
        let col_val
        if(idx==0){
            update_row.push(initial_row_values[0])
        }
        else if(name in new_profile){
            col_val = new_profile[name]
            if (name in column_formatters["decimals"] && isNaN(col_val)) {
                confirmBox("Alert!", `Please enter numeric value in ${name} Column`)
                return
            }
            if (col_val.trim() == "") {
                col_val = null
            } else if (col_val.trim() == "null" && name in column_formatters["lov"]){
                col_val = null
            } else if (name in column_formatters["decimals"]) {
                col_val = parseFloat(col_val)
            }
            update_row.push(col_val)             
        }else{
            let col_post = {itm:'item',dl:'destinationlocation',sl:'sourcelocation',prd:'periodname',tp:'mode'}
            col_val = "<"
            for (let key in new_profile["SelectedLvlFilterData"]){
                let col_name = col_post[key.split("_",1)[0]]
                 
                if(col_name.toLowerCase()==name.toLowerCase()){
                    if(col_val.length==1){
                        col_val+=`${key.split("_")[1]}`
                    }else{
                        col_val+=` and ${key.split("_")[1]}`
                    }   
                    if(new_profile["SelectedLvlFilterData"][key]['where_in'].length>0){
                        for (let [idx,val] of new_profile["SelectedLvlFilterData"][key]['where_in'].entries()){
                            if (idx==0){
                                col_val+=` in ('${val}'`
                            }else{
                                col_val+=','+`'${val}'`
                            }
                        }
                        col_val+=')'
                    }else{
                        for (let [idx,val] of new_profile["SelectedLvlFilterData"][key]['where_not_in'].entries()){
                            if (idx==0){
                                col_val+=` not in ('${val}'`
                            }else{
                                col_val+=','+`'${val}'`
                            }
                        }
                        col_val+=')'
                    }
                }
            }
            col_val+='>'
            if (col_val.length>2){
                update_row.push(col_val)
            }else if(update_row.length==0){
                update_row.push(initial_row_values[col_names.indexOf(name)])
            }else{
                if(initial_row_values[col_names.indexOf(name)]&& initial_row_values[col_names.indexOf(name)].trim().charAt(0)=="<"){
                    update_row.push('All')
                }else{
                    update_row.push(initial_row_values[col_names.indexOf(name)])
                }
                
            }
        }
        
    }
    return update_row
}

function detect_changes(updated_row) {
    if (JSON.stringify(updated_row) == JSON.stringify(initial_row_values)) {
        return false
    } else {
        return true
    }
}