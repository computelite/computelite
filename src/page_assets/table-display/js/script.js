import { postData, get_cl_element, confirmBox, executeQuery } from "../../../assets/js/scc"
import * as gm from "../../../core/gridMethods"
import * as bootstrap from 'bootstrap'
import flatpickr from "flatpickr"
import 'flatpickr/dist/flatpickr.min.css'

const page_element = document.getElementById("currentPage")
const table_el = document.getElementById("displayTable")
const rec_per_page = 1000

var primary_column = false
var where_in = new Object
var where_not_in = new Object
var like_query = new Object
var sort_columns = []
var column_formatters = new Object
let col_name_types = {}
var editable_flag
var currentPage = 1
var col_names
var initial_row_values = []
var current_row_id = 0
let running_model = null;
var sort_col_names = {};
const params = new URLSearchParams(window.location.search)

const modelName = params.get('modelName');
const tableName = params.get('tableName');
if (tableName) {
    document.title = tableName
}

let parameters = {};
let dt_picker = null;

let freeze_col_num;

get_parameters();

document.addEventListener("DOMContentLoaded", async function () {
    let result = await executeQuery('init')
    if (result && result.msg == 'Success') {
        init()
    }

    const modalElements = document.querySelectorAll('.modal');
    modalElements.forEach(modalElement => {
        if (!bootstrap.Modal.getInstance(modalElement)) {
            new bootstrap.Modal(modalElement);
        }
    });
})

async function init() {
    document.getElementById("resetSort").onclick = reset_sort
    const result = await gm.fetchTableFormatter(modelName, tableName)
    column_formatters = result[0][0];
    freeze_col_num = result[0][2]
    if (result[0][1]) {
        document.getElementById("viewQuery").style.display = ""
        document.getElementById("queryInput").value = result[0][1]
    }
    if (result[1]) {
        editable_flag = true
        table_el.classList.add("no_user_select")
    }
    get_sort();
    get_columns();
    if (!editable_flag) {
        document.getElementById("deleteRecordsBtn").parentNode.style.display = "none"
        document.getElementById("excelUploadBtn").parentNode.style.display = "none"
        document.getElementById("addNewColBtn").parentNode.style.display = "none"
        document.getElementById("delNewColBtn").parentNode.style.display = "none"
        document.getElementById("multiUpdate").parentNode.style.display = "none"
    }
}

function get_table_headers(header_rows) {
    update_column_formatters(header_rows)
    col_names = header_rows.reduce((a, b) => a.concat(b[0]), []);
    if (header_rows[0][1].toLowerCase() == "primary") {
        primary_column = true
    }
    get_table_data(col_names)
    const tbl = table_el.querySelector("thead")
    tbl.innerHTML = ""
    const tr1 = get_cl_element("tr", "headers", null, null)
    const tr2 = get_cl_element("tr", "lovRow", null, null)
    for (let hd of header_rows) {
        col_name_types[hd[0]] = hd[1]
        let th = get_cl_element("th", null, null, null)

        if (header_rows.indexOf(hd) < freeze_col_num) {
            th.classList.add('ZDX_H')
            th.classList.add(`C${header_rows.indexOf(hd)}`)
        }
        th.setAttribute("nowrap", "")
        const input_tag = get_cl_element("input", "form-control p-1", null, null)
        const th2 = get_cl_element("th", null, null,
            get_cl_element("div", "input-group", null, input_tag))
        input_tag.setAttribute("type", "text")

        input_tag.addEventListener("keydown", function (e) {
            const dropdown = this.nextElementSibling
            const dropdown_el = dropdown.nextElementSibling
            if (dropdown.classList.contains("show")) {
                if (e.keyCode == "27") {
                    let z = new bootstrap.Dropdown(dropdown)
                    z.toggle()
                } else if (e.keyCode == "40") {
                    let current_el = dropdown_el.querySelector("a.selected")
                    if (current_el) {
                        if (current_el.parentNode.tagName == 'FORM') {
                            const next_el = dropdown_el.querySelector("div.lov-values a")
                            if (next_el) {
                                current_el.classList.remove("selected")
                                next_el.classList.add("selected")
                            }
                        } else {
                            const next_el = current_el.nextElementSibling
                            if (next_el) {
                                current_el.classList.remove("selected")
                                next_el.classList.add("selected")
                            }
                        }

                    } else {
                        dropdown_el.querySelector("a.dropdown-item").classList.add("selected")
                    }
                } else if (e.keyCode == "38") {
                    // up
                    let current_el = dropdown_el.querySelector("a.selected")
                    if (current_el) {
                        if (current_el.parentNode.tagName == 'FORM') {

                        } else {
                            const prev_el = current_el.previousElementSibling
                            if (prev_el) {
                                current_el.classList.remove("selected")
                                prev_el.classList.add("selected")
                            } else {
                                current_el.classList.remove("selected")
                                dropdown_el.firstChild.firstChild.classList.add("selected")
                            }
                        }

                    }
                } else if (e.keyCode == "32") {
                    let current_el = dropdown_el.querySelector("a.selected")
                    current_el.firstChild.click()
                    e.preventDefault()
                } if (e.key === "Enter") {
                    submit_lov_button(th2, hd[0])
                    let z = new bootstrap.Dropdown(dropdown)
                    z.toggle()
                    e.preventDefault()
                }
                return false
            } else if (e.key === "Enter") {
                let reload_flag = update_like_object()
                if (reload_flag) {
                    get_table_data(col_names)
                }
                return false
            } else if (e.altKey && e.keyCode == "40") {
                let z = new bootstrap.Dropdown(dropdown)
                z.toggle()
                dropdown_el.querySelector("a.dropdown-item").classList.add("selected")
                return false
            }

        })
        const span = get_cl_element("span", "input-group-text dropdown-toggle px-1", null,
            get_cl_element("span", "fas fa-chevron-down", null, null))

        span.addEventListener('show.bs.dropdown', async function () {
            const lov_div = th2.querySelector("div.lov-values")
            if (!(hd[0] in where_in)) {
                where_in[hd[0]] = []
            }
            if (!(hd[0] in where_not_in)) {
                where_not_in[hd[0]] = []
            }
            if (where_in[hd[0]].length == 0 && where_not_in[hd[0]].length == 0) {
                lov_div.parentNode.querySelector("input").checked = true
            }
            lov_div.innerHTML = ""
            let temp_where_in = Object.assign({}, where_in)
            let temp_where_not_in = Object.assign({}, where_not_in)
            delete temp_where_in[hd[0]]
            delete temp_where_not_in[hd[0]]
            document.getElementById("data-loader").style.display = ""

            const result = await gm.fetchTableData(modelName, tableName, [hd[0]], { ...temp_where_in, ...parameters }, temp_where_not_in, like_query, 1, [], true, true)
            document.getElementById("data-loader").style.display = "none"
            const total_len = result[0].length
            for (let col_value of result[0]) {
                let el = get_cl_element("a", "dropdown-item", null,
                    get_cl_element("input", "form-check-input", null, null))
                el.firstChild.setAttribute("type", "checkbox")
                if (where_in[hd[0]].length > 0) {
                    if (col_value[0] !== null) {
                        if (where_in[hd[0]].indexOf(col_value[0].toString()) > -1) {
                            el.firstChild.checked = true
                        }
                    } else if (where_in[hd[0]].indexOf("null") > -1) {
                        el.firstChild.checked = true
                    }
                } else if (where_not_in[hd[0]].length > 0) {
                    if (col_value[0] !== null) {
                        if (where_not_in[hd[0]].indexOf(col_value[0].toString()) == -1) {
                            el.firstChild.checked = true
                        }
                    } else if (where_not_in[hd[0]].indexOf("null") == -1) {
                        el.firstChild.checked = true
                    }
                } else {
                    el.firstChild.checked = true
                }
                el.appendChild(get_cl_element("label", "form-check-label", null,
                    document.createTextNode(get_col_string(hd[0], col_value[0]))))
                el.querySelector('label').setAttribute('value', col_value[0])
                lov_div.appendChild(el)
                el.firstChild.onchange = function (e) {
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
        th2.querySelector("div").appendChild(span)

        const dropdown = get_cl_element("div", "multiselect-container dropdown-menu dropdown", null,
            get_cl_element("form", null, null,
                get_cl_element("a", "dropdown-item", null,
                    get_cl_element("input", "form-check-input", null, null))))
        dropdown.querySelector("a")
            .appendChild(get_cl_element("label", "form-check-label", null,
                document.createTextNode("Select All")))

        dropdown.querySelector("input").setAttribute("type", "checkbox")
        dropdown.firstChild.appendChild(get_cl_element("div", "dropdown-divider"))
        dropdown.firstChild.appendChild(get_cl_element("div", "lov-values"))
        dropdown.firstChild.appendChild(get_cl_element("div", "dropdown-divider"))
        const inp_tag = dropdown.querySelector("input")
        inp_tag.onchange = function (e) {
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
        dropdown.firstChild.appendChild(get_cl_element("div", "dropdown-item", null,
            prim_button))


        prim_button.parentNode.appendChild(ter_button)
        ter_button.style.float = "left";
        ter_button.setAttribute("type", "button")
        prim_button.setAttribute("type", "button")

        th2.querySelector("div").appendChild(dropdown)

        prim_button.addEventListener("mousedown", function (e) {
            let ct = th2.querySelectorAll("div.lov-values input:checked").length
            let total_len = th2.querySelectorAll("div.lov-values input").length

            setTimeout(function () {

                if (ct == total_len) {
                    if (span.childNodes[1]) {
                        span.removeChild(span.childNodes[0])
                        span.firstChild.style = ""
                    }
                } else {
                    if (!ct == 0) {
                        if (!(span.childNodes[1])) {
                            span.firstChild.style = "position:relative;top:4px;"
                            span.insertBefore(get_cl_element('span', 'fas fa-filter'), span.childNodes[0]);
                        }
                    }
                }
            }, 600);

            submit_lov_button(th2, hd[0])

        })


        ter_button.addEventListener("mousedown", function (e) {
            let flag = false
            if (where_in[hd[0]].length > 0) {
                flag = true
                where_in[hd[0]] = []
            } else if (where_not_in[hd[0]].length > 0) {
                flag = true
                where_not_in[hd[0]] = []
            }
            if (flag) {
                get_table_data(col_names)
            }
            setTimeout(function () {

                if (span.childNodes[1]) {
                    span.removeChild(span.childNodes[0])
                    span.firstChild.style = ""
                }
            }, 200);
        })

        let icon_class = get_icon_class(hd[0])


        if (primary_column && header_rows.indexOf(hd) == 0) {
            let el = get_cl_element("input", "form-check-input", "selectAll", null)
            el.setAttribute("type", "checkbox")
            th.appendChild(el)
            th.id = hd[0]
            tr2.appendChild(get_cl_element("th", 'ZDX_H', null, null))
            el.onchange = function (e) {
                for (let tr of table_el.querySelectorAll("tbody tr")) {
                    if (tr.firstChild.firstChild) {
                        tr.firstChild.firstChild.checked = el.checked
                    }
                }
            }

        } else if (hd[2] == 1) {
            th.classList.add("min-width")
            let el = get_cl_element("u", null, null, document.createTextNode(hd[0]))
            el.appendChild(get_cl_element("span", `fa ${icon_class}`, null, null))
            th.appendChild(el)
            tr2.appendChild(th2)
        } else {
            th.classList.add("min-width")
            th.appendChild(document.createTextNode(hd[0]))
            th.appendChild(get_cl_element("span", `fa ${icon_class}`, null, null))
            tr2.appendChild(th2)
        }

        if (header_rows.indexOf(hd) < freeze_col_num) {
            th2.classList.add('ZDX_H')
            th2.classList.add(`C${header_rows.indexOf(hd)}`)
        }

        const sort_el = th.querySelector(`span.${icon_class}`)

        if (sort_el) {
            sort_el.addEventListener('click', function () {
                const sort_cols = sort_columns.reduce((a, b) => a.concat(b[0]), []);
                let idx = sort_cols.indexOf(hd[0])
                if (idx < 0) {
                    idx = sort_cols.length
                }
                if (this.classList.contains("fa-sort-down")) {
                    sort_columns[idx] = [hd[0], "desc"]
                    this.classList.remove("fa-sort-down")
                    this.classList.add("fa-sort-up")
                } else {
                    this.classList.remove("fa-sort-up")
                    this.classList.remove("fa-sort")
                    this.classList.add("fa-sort-down")
                    sort_columns[idx] = [hd[0], "asc"]
                }
                get_table_data(col_names)
            })

            th.addEventListener('click', function (e) {
                if (e.target.classList.contains("fa")) {
                    return false
                } else {
                    const col_num = col_names.indexOf(this.firstChild.textContent)
                    if (this.classList.contains("selected_col")) {
                        for (let tr of table_el
                            .querySelectorAll("tr")) {
                            tr.childNodes[col_num].classList.remove("selected_col")
                        }

                    } else {
                        const other_selected = this.parentNode.querySelector('.selected_col')
                        if (other_selected) {
                            const prev_col = col_names.indexOf(other_selected.firstChild.textContent)
                            for (let tr of table_el
                                .querySelectorAll("tr")) {
                                tr.childNodes[prev_col].classList.remove("selected_col")
                            }
                        }
                        for (let tr of table_el
                            .querySelectorAll("tr")) {
                            tr.childNodes[col_num].classList.add("selected_col")
                        }
                    }
                }
            })


        }

        tr1.appendChild(th)
    }
    tbl.appendChild(tr1)
    tbl.appendChild(tr2)
}


async function get_table_data(col_names, page_num = 1) {
    current_row_id = 0
    initial_row_values = []
    currentPage = page_num
    let select_all = false
    if (primary_column && document.getElementById("selectAll")) {
        select_all = document.getElementById("selectAll").checked

    }
    const selected_header = table_el.querySelector('thead .selected_col')
    let selected_idx = 0
    if (selected_header) {
        selected_idx = col_names.indexOf(selected_header.firstChild.textContent)
    }
    document.getElementById("data-loader").style.display = ""
    const data = await gm.fetchTableData(modelName, tableName, col_names, { ...where_in, ...parameters }, where_not_in, like_query, page_num, sort_columns)
    document.getElementById("data-loader").style.display = "none"
    const tbl = table_el.querySelector("tbody")
    const total_len = data[0].length
    tbl.innerHTML = ""
    for (let row of data[0]) {
        let tr = get_table_row(row, selected_idx, select_all, page_num)
        tbl.appendChild(tr)
    }

    freeze_headers()

    if (editable_flag) {
        tbl.appendChild(add_insert_row())
    }

    if (total_len > -5) {
        let tr = get_cl_element("tr", "footer")
        for (let val of col_names) {
            let td = document.createElement("td")
            tr.appendChild(td)
        }
        tr.style.display = "none"
        tbl.appendChild(tr)

    }
    let inner_text = ""
    let total_pages = ""
    if (data[1] >= rec_per_page) {
        inner_text = ((page_num - 1) * rec_per_page + 1).toString() + '-'
            + (Math.min(page_num * rec_per_page, data[1])).toString() + ' of ' + data[1]
        total_pages = "of " + (parseInt(data[1] / rec_per_page) + 1).toString()
    } else {
        inner_text = '1-' + (data[1]).toString()
            + ' of ' + data[1].toString()
        total_pages = "of 1"
    }
    document.getElementById("totalRecordsPanel").innerText = inner_text
    page_element.parentNode.childNodes[2].textContent = total_pages
    page_element.setAttribute("maxPages", parseInt(data[1] / rec_per_page) + 1)
    page_element.value = currentPage
}

const not_eq_list = function (a, b) {
    if (a.length !== b.length) return true;
    for (let ax of a) {
        if (b.indexOf(ax) == -1) return true;
    }
    return false
}

function update_like_object() {
    let i = 0
    if (primary_column) {
        i = 1
    }
    let reload_flag = false
    for (let [idx, inp] of document.querySelectorAll("tr.lovRow th input[type=text]").entries()) {
        let val = inp.value
        let col_name = col_names[idx + i]
        if (col_name in like_query) {
            if (like_query[col_name] != val) {
                reload_flag = true
                if (val == "") {
                    delete like_query[col_name]
                } else {
                    like_query[col_name] = val
                }
            }
        } else if (val == "") {
            continue
        } else {
            like_query[col_name] = val
        }
    }
    if (Object.keys(like_query).length > 0) {
        reload_flag = true
    }
    return reload_flag
}


page_element.addEventListener("keyup", function (e) {
    if (e.key === "Enter") {
        const new_page_num = page_element.value
        if (isNaN(new_page_num)) {
            page_element.value = currentPage
        } else {
            const max_page_num = parseInt(page_element.getAttribute("maxPages"))
            let page_val = parseInt(page_element.value)
            if (page_val <= 1) {
                page_val = 1
            } else if (page_val >= max_page_num) {
                page_val = max_page_num
            }
            page_element.value = page_val
            if (page_val !== currentPage) {
                get_table_data(col_names, page_val)
            }
        }

    }
})


document.getElementById("firstPageBtn").onclick = function (e) {
    if (currentPage > 1) {
        page_element.value = 1
        get_table_data(col_names, 1)
    }
}

document.getElementById("prevPageBtn").onclick = function (e) {
    if (currentPage > 1) {
        page_element.value = currentPage - 1
        get_table_data(col_names, currentPage - 1)
    }
}

document.getElementById("nextPageBtn").onclick = function (e) {
    const max_page_num = parseInt(page_element.getAttribute("maxPages"))
    if (currentPage < max_page_num) {
        page_element.value = currentPage + 1
        get_table_data(col_names, currentPage + 1)
    }
}

document.getElementById("lastPageBtn").onclick = function (e) {
    const max_page_num = parseInt(page_element.getAttribute("maxPages"))
    if (currentPage < max_page_num) {
        page_element.value = max_page_num
        get_table_data(col_names, max_page_num)
    }
}


document.getElementById("refreshBtn").parentNode.onclick = function (e) {
    Promise.resolve(get_sort()).then(reload_table_data);
}

function reload_table_data() {
    reset_sort_buttons()
    where_in = new Object
    where_not_in = new Object
    like_query = new Object
    if (document.getElementById("selectAll")) {
        document.getElementById("selectAll").checked = false
    }
    get_table_data(col_names, 1)
    for (let cn of table_el.querySelectorAll(".lovRow input.form-control")) {
        cn.value = ""
    }
    const tbl = table_el.querySelector("thead")
    let span = tbl.querySelectorAll("span.input-group-text")
    for (let filter of span) {
        if (filter.childNodes[1]) {
            filter.removeChild(filter.childNodes[0])
            filter.firstChild.style = ""
        }
    }

}

function reset_sort_buttons() {
    for (let cn of table_el.querySelectorAll("thead span.fa-sort-down")) {
        if (!Object.keys(sort_col_names).includes(cn.parentNode.innerText.trim())) {
            cn.classList.add("fa-sort")
            cn.classList.remove("fa-sort-down")
        } else {
            if (sort_col_names[cn.parentNode.innerText.trim()] == 'desc') {
                cn.classList.remove("fa-sort-down")
                cn.classList.add("fa-sort-up")
            }
        }

    }
    for (let cn of table_el.querySelectorAll("thead span.fa-sort-up")) {
        if (!Object.keys(sort_col_names).includes(cn.parentNode.innerText.trim())) {
            cn.classList.add("fa-sort")
            cn.classList.remove("fa-sort-up")
        } else {
            if (sort_col_names[cn.parentNode.innerText.trim()] == 'asc') {
                cn.classList.remove("fa-sort-up")
                cn.classList.add("fa-sort-down")
            }
        }
    }
    for (let el of table_el.querySelectorAll('th.selected_col')) {
        el.classList.remove("selected_col")
    }

}

function submit_lov_button(th, header_name) {
    const selected_mem = []
    const not_selected_mem = []

    for (let cn of th.querySelectorAll("div.lov-values input")) {
        if (cn.checked) {
            selected_mem.push(cn.nextElementSibling.getAttribute('value'))
        } else {
            not_selected_mem.push(cn.nextElementSibling.getAttribute('value'))
        }
    }

    let reload_flag = false
    if (selected_mem.length > not_selected_mem.length) {
        if (not_eq_list(where_in[header_name], [])) {
            reload_flag = true
            where_in[header_name] = []
        }
        if (not_eq_list(where_not_in[header_name], not_selected_mem)) {
            reload_flag = true
            where_not_in[header_name] = not_selected_mem
        }
    } else {
        if (not_eq_list(where_in[header_name], selected_mem)) {
            reload_flag = true
            where_in[header_name] = selected_mem
        }
        if (not_eq_list(where_not_in[header_name], [])) {
            reload_flag = true
            where_not_in[header_name] = []
        }
    }
    if (reload_flag) {
        get_table_data(col_names)
    }
}

document.getElementById("excelDownloadBtn").onclick = async function (e) {
    document.getElementById("data-loader").style.display = ""
    await gm.downloadExcel(modelName, [tableName])
    document.getElementById("data-loader").style.display = "none"
}

document.getElementById("importExcel").onclick = async function (e) {
    if (document.getElementById("fileUpload").files[0]) {
        document.getElementById("data-loader").style.display = ""
        let selected_file = document.getElementById("fileUpload").files[0]
        const file = await selected_file.arrayBuffer();
        const data = await gm.uploadExcel(modelName, [tableName.toLowerCase()], file)
        document.getElementById("data-loader").style.display = "none"
        let sheet_names_case = Object.keys(data)
        let sheet_names = sheet_names_case.map(el => el.toLowerCase())
        let idx = sheet_names.indexOf(tableName.toLowerCase())
        if (idx > -1) {
            if (!isNaN(data[sheet_names_case[idx]])) {
                reload_table_data()
                confirmBox("Success!", "Total Rows: " + data[sheet_names_case[idx]] + " Imported")

            } else {
                confirmBox("Error!", data[sheet_names_case[idx]])
            }

        } else {
            confirmBox("Error!", "No sheet matches with table name")
        }

    } else {
        confirmBox('Alert!', 'Please choose a file to upload')
    }

}


document.getElementById("importCSV").onclick = function (e) {
    const delimiter = document.getElementById("selectDelimeter").value
    if (document.getElementById("textfileUpload").files[0]) {
        document.getElementById("data-loader").style.display = ""
        postFile("/grid/upload-csv", document.getElementById("textfileUpload").files[0], {
            delimiter: delimiter
        }
        ).then(data => {
            document.getElementById("data-loader").style.display = "none"
            let file_name = Object.keys(data)
            let idx = file_name.indexOf(sessionStorage.table_name.toLowerCase())
            if (idx > -1) {
                if (!isNaN(data[file_name[idx]])) {
                    reload_table_data()
                    confirmBox("Success!", "Total Rows: " + data[file_name[idx]] + " Imported")

                } else {
                    confirmBox("Error!", data[file_name[idx]])
                }

            } else {
                confirmBox("Error!", "No sheet matches with table name")
            }
        })
    } else {
        confirmBox('Alert!', 'Please choose a file to upload')
    }

}

async function update_column_formatters(header_rows) {
    let numeric_columns = ['NUMERIC', 'INTEGER']
    let formatters = { decimals: 2, comma: 0, locale: 0, currency: 0, aggregate: 'SUM' }
    const ncf = {}

    for (let format in formatters) {
        ncf[format] = new Object
        for (let col_row of header_rows) {
            let col_name = col_row[0]
            if (numeric_columns.indexOf(col_row[1]) > -1) {
                if (format in column_formatters) {
                    if (col_name in column_formatters[format]) {
                        let format_value = column_formatters[format][col_name]
                        if (!isNaN(format_value) && parseInt(format_value) > -1) {
                            ncf[format][col_name] = parseInt(format_value)
                        } else if (["locale", "currency", "aggregate"].indexOf(format) > -1) {
                            ncf[format][col_name] = format_value
                        } else {
                            ncf[format][col_name] = formatters[format]
                        }

                    } else {
                        if (format.toLowerCase() === 'decimals' && col_row[1] === 'INTEGER') {
                            ncf[format][col_name] = 0
                        } else {
                            ncf[format][col_name] = formatters[format]
                        }
                    }
                }
                else {
                    if (format.toLowerCase() === 'decimals' && col_row[1] === 'INTEGER') {
                        ncf[format][col_name] = 0
                    } else {
                        ncf[format][col_name] = formatters[format]
                    }
                }

            }
        }
    }


    col_names = header_rows.reduce((a, b) => a.concat(b[0]), []);
    for (let format in formatters) {
        column_formatters[format] = ncf[format]
    }

    if (!("autofiller" in column_formatters)) {
        column_formatters["autofiller"] = new Object
    }

    if (!("query" in column_formatters)) {
        column_formatters["query"] = new Object
    }

    if (!("lov" in column_formatters)) {
        column_formatters["lov"] = new Object
    }

    column_formatters["date"] = new Object
    column_formatters["datetime"] = new Object

    const col_formatter_list = Object.keys(column_formatters['lov'])
    for (let col_name of col_formatter_list) {
        let col_idx = col_names.indexOf(col_name)
        if (col_idx > -1 && !Array.isArray(column_formatters["lov"][col_name])) {
            let lov_list = column_formatters["lov"][col_name].split("|")
            const proper_col_name = header_rows[col_idx][0]
            if (lov_list[0].trim().toLowerCase() == "select") {
                if (lov_list[1].trim().toLowerCase().substring(0, 6) == "select") {
                    delete column_formatters['lov'][col_name]
                    let new_query = lov_list.slice(1).join('_').trim()
                    column_formatters["query"][proper_col_name] = new_query
                    const result = await gm.runSelectQuery(modelName, new_query)
                    column_formatters["lov"][proper_col_name] = result


                } else {
                    let lov_list1 = lov_list[1].trim().split(";")
                    let lov_list2 = []
                    for (let lov_mem of lov_list1) {
                        if (lov_mem.trim().length > 0) {
                            lov_list2.push(lov_mem.trim())
                        }
                    }
                    delete column_formatters['lov'][col_name]
                    column_formatters["lov"][proper_col_name] = lov_list2
                }
            } else if (lov_list[0].trim().toLowerCase() == "autofiller") {
                if (lov_list[1].trim().toLowerCase().substring(0, 6) == "select") {
                    delete column_formatters['lov'][col_name]
                    let new_query = lov_list.slice(1).join('|').trim()

                    let tbl_body = table_el.querySelector('tbody')

                    column_formatters["query"][proper_col_name] = new_query
                    const result = await gm.runSelectQuery(modelName, new_query)
                    column_formatters["autofiller"][proper_col_name] = result

                    document.getElementById("dataList_div").appendChild(get_dataList(`${proper_col_name}_dataList`, result))
                    let insert_row = tbl_body.getElementsByClassName('insert')
                    if (insert_row && insert_row[0]) {
                        insert_row[0].remove()
                        tbl_body.appendChild(add_insert_row())
                    }

                } else {
                    let lov_list1 = lov_list[1].trim().split(";")
                    let lov_list2 = []
                    for (let lov_mem of lov_list1) {
                        if (lov_mem.trim().length > 0) {
                            lov_list2.push(lov_mem.trim())
                        }
                    }
                    delete column_formatters['lov'][col_name]
                    column_formatters["autofiller"][proper_col_name] = lov_list2

                    let dl = document.getElementById(`${proper_col_name}_dataList`)
                    if (dl) {
                        dl.remove()
                    }

                    document.getElementById("dataList_div").appendChild(get_dataList(`${proper_col_name}_dataList`, lov_list2))
                }
            } else if (lov_list[0].trim().toLowerCase() == "date") {
                delete column_formatters['lov'][col_name]
                column_formatters["date"][proper_col_name] = 1
            } else if (lov_list[0].trim().toLowerCase() == "datetime") {
                delete column_formatters['lov'][col_name]
                column_formatters["datetime"][proper_col_name] = 1
            } else {
                console.log("Neither LOV nor Autofiller, please check")
            }

        }
    }


}

document.getElementById("incrDecimals").onclick = async function (e) {
    const selected_header = table_el.querySelector('thead .selected_col')
    if (selected_header) {
        const col_name = selected_header.innerText
        if (col_name in column_formatters["decimals"]) {
            column_formatters["decimals"][col_name] += 1
            await gm.setTableFormatter(modelName, tableName, col_name, { "Decimals": column_formatters["decimals"][col_name] })
            for (let cn of table_el.querySelectorAll("td.selected_col")) {
                let val = parseFloat(cn.getAttribute("title"))
                if (!isNaN(val)) {
                    cn.innerText = get_col_string(col_name, val)
                }
            }
        }
        else {
            confirmBox("Alert!", "Please select a numeric column")
        }
    } else {
        confirmBox("Alert!", "Please select a column")
    }
}

document.getElementById("decrDecimals").onclick = async function (e) {
    const selected_header = table_el.querySelector('thead .selected_col')
    if (selected_header) {
        const col_name = selected_header.innerText
        if (col_name in column_formatters["decimals"]) {
            const n = column_formatters["decimals"][col_name] - 1
            if (n > -1) {
                column_formatters["decimals"][col_name] = n
                await gm.setTableFormatter(modelName, tableName, col_name, { "Decimals": n })
                for (let cn of table_el.querySelectorAll("td.selected_col")) {
                    let val = parseFloat(cn.getAttribute("title"))
                    if (!isNaN(val)) {
                        cn.innerText = get_col_string(col_name, val)
                    }
                }
            }
        }
        else {
            confirmBox("Alert!", "Please select a numeric column")
        }
    } else {
        confirmBox("Alert!", "Please select a column")
    }
}

document.getElementById("showSummaryBtn").onclick = async function (e) {
    const numeric_columns = Object.keys(column_formatters["decimals"])
    let tfoot = table_el.querySelector("tr.footer")
    if (numeric_columns.length > 0) {
        if (tfoot.style.display === "none") {
            document.getElementById("data-loader").style.display = ""
            const data = await gm.getSummary(modelName, tableName, numeric_columns, where_in, where_not_in, like_query)
            document.getElementById("data-loader").style.display = "none"
            for (let col_name of numeric_columns) {
                let val = data[numeric_columns.indexOf(col_name)]
                let strt = 1
                if (!editable_flag) {
                    strt = 0
                }
                let idx = col_names.indexOf(col_name, strt)
                tfoot.childNodes[idx].innerText = get_col_string(col_name, val);
                tfoot.childNodes[idx].setAttribute("title", val)
            }
            tfoot.style.removeProperty("display");
        } else {
            tfoot.style.display = "none";
        }

    }
}

document.getElementById("thousandSepBtn").onclick = async function (e) {
    const selected_header = table_el.querySelector('thead .selected_col')
    if (selected_header) {
        const col_name = selected_header.innerText
        if (col_name in column_formatters["decimals"]) {
            column_formatters["comma"][col_name] = 1 - column_formatters["comma"][col_name]
            await gm.setTableFormatter(modelName, tableName, col_name, { "Comma": column_formatters["comma"][col_name] })

            for (let cn of table_el.querySelectorAll("td.selected_col")) {
                let val = parseFloat(cn.getAttribute("title"))
                if (!isNaN(val)) {
                    cn.innerText = get_col_string(col_name, val)
                }
            }

        }
        else {
            confirmBox("Alert!", "Please select a numeric column")
        }
    } else {
        confirmBox("Alert!", "Please select a column")
    }
}

function move_elements(bt_type, src_id, dest_id) {
    if (bt_type == "all") {
        for (let trd of document.getElementById(src_id).querySelectorAll("li")) {
            document.getElementById(dest_id).appendChild(trd)
        }

    } else if (bt_type == "one") {
        for (let trd of document.getElementById(src_id).querySelectorAll("li.selectedValue")) {
            document.getElementById(dest_id).appendChild(trd)
            trd.classList.remove("selectedValue")
        }

    }
}

document.getElementById("allLeft").onclick = function (e) {
    move_elements(this.getAttribute("bttype"), this.getAttribute("src"), this.getAttribute("dest"))
}

document.getElementById("allRight").onclick = function (e) {
    move_elements(this.getAttribute("bttype"), this.getAttribute("src"), this.getAttribute("dest"))
}

document.getElementById("selectedLeft").onclick = function (e) {
    move_elements(this.getAttribute("bttype"), this.getAttribute("src"), this.getAttribute("dest"))
}

document.getElementById("selectedRight").onclick = function (e) {
    move_elements(this.getAttribute("bttype"), this.getAttribute("src"), this.getAttribute("dest"))
}

function populate_columns(available_column, selected_column) {
    document.getElementById("availableColumn").innerHTML = ""
    document.getElementById("selectedColumn").innerHTML = ""

    for (let column_name of available_column) {
        document.getElementById("availableColumn").appendChild(get_li_element(column_name))
    }

    for (let column_name of selected_column) {
        document.getElementById("selectedColumn").appendChild(get_li_element(column_name))
    }

}


function get_li_element(col_name) {
    let el = get_cl_element("li", "dropzone", null, document.createTextNode(col_name))
    el.setAttribute("draggable", true)
    el.onclick = function (e) {
        if (!e.ctrlKey) {
            for (let cn of this.parentNode.querySelectorAll("li.selectedValue")) {
                cn.classList.remove("selectedValue")
            }
        }
        this.classList.add("selectedValue")
        e.preventDefault();
    }

    el.ondblclick = function () {
        let new_col_name = this.parentNode.getAttribute("dest")
        document.getElementById(new_col_name).appendChild(this)
        this.classList.remove("selectedValue")
    }

    return el
}


async function get_columns() {
    const data = await gm.fetchColumnsData(modelName, tableName)
    if (data.length == 0 || data[1].length == 0) {
        confirmBox("Alert!", `No table exists with tablename ${tableName} `)
        return
    }

    get_table_headers(data[1])
    let selected_column
    if (editable_flag) {
        selected_column = data[1].reduce((a, b) => a.concat(b[0]), []).splice(1)
    } else {
        selected_column = data[1].reduce((a, b) => a.concat(b[0]), [])
    }

    populate_columns(data[0], selected_column)
    let removeColumnEl = document.getElementById("removeColumnSelect")
    removeColumnEl.innerHTML = ""
    let el = get_cl_element("option", null, null, document.createTextNode("Select a Column to Remove"))
    el.setAttribute("value", 0)
    el.setAttribute("selected", "")
    removeColumnEl.appendChild(el)
    for (const [idx, val] of selected_column.entries()) {
        if (data[1][idx][1] != 'PRIMARY' || data[1][idx][2] != 1 || data[1][idx][3] != 1) {
            let el = get_cl_element("option", null, null, document.createTextNode(val))
            removeColumnEl.appendChild(el)

        }
    }
    for (let col_name of data[0]) {
        let el = get_cl_element("option", null, null, document.createTextNode(col_name))
        removeColumnEl.appendChild(el)
    }

}

document.getElementById("saveColumnSelection").onclick = async function (e) {
    const selected_column = []
    for (let cn of document.getElementById("selectedColumn").childNodes) {
        selected_column.push(cn.innerText)
    }
    const result = await gm.updateColumnOrders(modelName, tableName, selected_column)
    if (result) {
        get_columns()
    }

}

document.getElementById("addNewColumn").onclick = async function (e) {
    const new_col_name = document.getElementById("newColName").value
    const col_type = document.getElementById("addColumnSelect").value
    const splChars = "*|,\":<>[]{} `\';()@&$#%"
    const all_cols = col_names


    if (new_col_name) {
        const col_len = new_col_name.length
        if (col_len == 0) {
            confirmBox("Alert!", "Please Enter Column Name")
            return;
        }
        if (col_len >= 50) {
            confirmBox("Alert!", "Please Enter Column Name upto 50 characters")
            return;
        }
        for (var i = 0; i < col_len; i++) {
            if (splChars.indexOf(new_col_name.charAt(i)) > -1) {
                confirmBox("Alert!", "Please remove special characters from column name")
                return;
            }

            if (col_type == 0) {
                confirmBox("Alert!", "Please Select valid column type")
                return;
            }

        }

        for (let cn of document.getElementById("availableColumn").childNodes) {
            all_cols.push(cn.innerText)
        }

        if (all_cols.indexOf(new_col_name) > -1) {
            confirmBox("Alert!", "Column name already exist, please choose another name")
            return;

        }

        const x = await gm.addNewColumn(modelName, tableName, new_col_name, col_type)
        if (x) {

            get_columns();
            const bs_modal = bootstrap.Modal.getInstance(document.getElementById("modal-add-column"))
            bs_modal.hide()
        }
    } else {
        confirmBox("Alert!", "Please Enter Column Name")
        return;
    }


}


document.getElementById("removeColumn").onclick = async function (e) {
    const col_name = document.getElementById("removeColumnSelect").value
    if (col_name == 0) {
        confirmBox("Alert!", "Please Select a column to proceed")
    } else {

        const x = await gm.deleteColumn(modelName, tableName, col_name)
        if (x) {
            if (x.message == 'Success') {
                get_columns()
            } else {
                confirmBox("Alert!", x.message)
            }
        }
        const bs_modal = bootstrap.Modal.getInstance(document.getElementById("modal-remove-column"))
        bs_modal.hide()

    }

}

document.getElementById("delNewColBtn").onclick = function (e) {
    const selected_header = table_el.querySelector('thead .selected_col')
    if (selected_header) {
        const col_num = col_names.indexOf(selected_header.firstChild.textContent)
        for (let tr of table_el.querySelectorAll("tr")) {
            tr.childNodes[col_num].remove()
        }
        col_names.splice(col_num, 1)
        let li_el = document.getElementById("selectedColumn").childNodes[col_num - 1]
        document.getElementById("availableColumn").appendChild(li_el)
        const selected_column = col_names.filter(function (value, index, arr) { return index > 0; })
        postData('/grid/set-columns', { col_list: selected_column })
    } else {
        const bs_modal = new bootstrap.Modal(document.getElementById("modal-remove-column"))
        bs_modal.show()
    }

}

const delete_all_rows = async function (e) {
    const [in_flag, rowid_list] = get_selected_rows()

    const x = await gm.deleteRows(modelName, tableName, where_in, where_not_in, like_query, rowid_list, in_flag, document.getElementById("selectAll").parentNode.id)
    if (x) {
        reload_table_data()
        confirmBox("Success!", `Total of ${x} rows deleted`)
    }
}

document.getElementById("deleteRecordsBtn").onclick = function (e) {

    if (editable_flag) {
        const checked_val = document.getElementById("selectAll").checked
        if (checked_val) {
            confirmBox("Alert!", "Are you sure, you want to delete all the records?", delete_all_rows, 1)
        } else {
            const tbl = table_el.querySelector("tbody")
            const total_len = tbl.childNodes.length - 2
            const selected_len = tbl.querySelectorAll("input:checked").length
            if (selected_len == 0) {
                confirmBox("Alert!", "Please select atleast one row to proceed?")
            } else if (selected_len < total_len / 2) {
                confirmBox("Alert!", `This will delete ${selected_len} records`, delete_all_rows, 1)
            } else {
                const all_rec = parseInt(document.getElementById("totalRecordsPanel").innerText.split(" ").pop())
                confirmBox("Alert!", `This will delete ${all_rec - total_len + selected_len} records except ${total_len - selected_len} not selected records`, delete_all_rows, 1)
            }
        }
    }
}


document.getElementById('multiUpdate').onclick = function (e) {
    if (document.getElementById("modal-update-column").style.display == "none") {
        const selected_header = table_el.querySelector('thead .selected_col')
        if (selected_header) {
            update_column_modal(selected_header.innerText)
        } else {
            confirmBox("Alert!", "Please select a column")
        }
    }

}


document.getElementById("updateColumn").onclick = async function (e) {
    const col_name = document.getElementById("ColValueLabel").innerText
    let col_val = document.getElementById("colValue").value
    if (col_name in column_formatters["lov"]) {
        col_val = document.getElementById("colSelectValue").value
    } else if (col_name in column_formatters["decimals"]) {
        if (isNaN(col_val)) {
            confirmBox("Alert!", `Please enter numeric value`)
            return
        }
    } else if (column_formatters["date"] && col_name in column_formatters["date"]) {
        let new_val = col_val.split(' ')
        if (new_val[1] === '00:00:00') {
            col_val = new_val[0]
        }
    }

    if (col_val.trim() == "") {
        col_val = null
    }
    const [in_flag, rowid_list] = get_selected_rows()

    const x = await gm.updateCol(modelName, tableName, where_in, where_not_in, like_query, rowid_list, in_flag, document.getElementById("selectAll").parentNode.id, col_name, col_val)
    if (x) {
        let check_flag = false
        if (rowid_list.length == 0) {
            check_flag = true
        }
        for (let cn of table_el.querySelectorAll("td.selected_col")) {
            if (!cn.parentNode.classList.contains("insert") &&
                !cn.parentNode.classList.contains("footer")) {
                if (check_flag || cn.parentNode.firstChild.firstChild.checked) {
                    cn.setAttribute("title", col_val)
                    if (col_name in column_formatters["decimals"]) {
                        cn.innerText = get_col_string(col_name, col_val)
                    } else {
                        cn.innerText = col_val
                    }
                }
            }
        }
        const bs_modal = bootstrap.Modal.getInstance(document.getElementById("modal-update-column"))
        bs_modal.hide()
        confirmBox("Success!", `Total of ${x} rows updated`)
    }
}

function get_selected_rows() {
    const checked_val = document.getElementById("selectAll").checked
    let rowid_list = []
    let in_flag = false
    if (!checked_val) {
        const tbl = table_el.querySelector("tbody")
        const total_len = tbl.childNodes.length - 1
        const selected_len = tbl.querySelectorAll("input:checked").length
        if (selected_len < total_len / 2) {
            in_flag = true
            for (let cn of tbl.querySelectorAll("input:checked")) {
                rowid_list.push(cn.parentNode.id)
            }
        } else {
            in_flag = false
            for (let tr of tbl.childNodes) {
                if (tr.firstChild.firstChild) {
                    if (!tr.firstChild.firstChild.checked) {
                        rowid_list.push(tr.firstChild.id)
                    }

                }
            }

        }

    }
    return [in_flag, rowid_list]
}


document.addEventListener('keydown', multi_update);

function multi_update(e) {
    if (e.key == "F2" && editable_flag) {
        const selected_header = table_el.querySelector('thead .selected_col')
        if (selected_header) {
            if (document.getElementById("modal-update-column").style.display == "none") {
                update_column_modal(selected_header.innerText)
                e.preventDefault()
            }
        } else {
            confirmBox("Alert!", "Please select a column")
        }
    }
}


function update_column_modal(col_name) {
    let input_el = document.getElementById("colValue")
    input_el.setAttribute('Autocomplete', 'off')
    input_el.style.borderBottomRightRadius = 0
    input_el.style.borderTopRightRadius = 0
    if (input_el.parentNode.classList.contains("awesomplete")) {
        let other_inp = input_el.cloneNode(true)
        let pnode = input_el.parentNode.parentNode
        input_el.parentNode.remove()
        pnode.insertBefore(other_inp, pnode.firstChild)
        input_el = other_inp
    }
    input_el.value = ""
    if (dt_picker) {
        dt_picker.destroy()
        dt_picker = null
    }
    input_el.classList.remove("datepicker-input")
    input_el.removeAttribute('list')
    input_el.parentNode.style.display = "flex"
    document.getElementById("colSelectValue").parentNode.style.display = "none"
    document.getElementById("ColValueLabel").innerText = col_name
    if (col_name in column_formatters["autofiller"]) {
        input_el.setAttribute("list", `${col_name}_dataList`)
        input_el.parentNode.style.flex = 1;

    } else if (col_name in column_formatters["lov"]) {
        let select_el = document.getElementById("colSelectValue")
        input_el.parentNode.style.display = "none"
        select_el.parentNode.style.display = "flex"
        select_el.innerHTML = ""
        if (column_formatters["lov"][col_name].length > 0) {
            for (let col_val of column_formatters["lov"][col_name]) {
                let el = get_cl_element("option", null, null, document.createTextNode(col_val))
                select_el.appendChild(el)
            }
            select_el.firstChild.setAttribute("selected", "")
        } else {
            input_el.setAttribute("list", `${col_name}_dataList`)

        }


    } else if (col_name in column_formatters["decimals"]) {
        input_el.type = "number"
    } else if (column_formatters["date"] && col_name in column_formatters["date"]) {

        dt_picker = flatpickr(input_el, {
            dateFormat: "Y-m-d H:i:S",
            allowInput: true
        });


    }
    else {
        input_el.type = "text"
    }
    const bs_modal = new bootstrap.Modal(document.getElementById("modal-update-column"))
    bs_modal.show()

}


function open_row(td) {
    initial_row_values = []
    let tr = td.parentNode
    for (const [idx, cn] of tr.childNodes.entries()) {

        let awesomeplete = false
        if (idx == 0) {
            current_row_id = cn.id
            initial_row_values.push(cn.id)
        } else {
            let col_val
            let input_el
            if (cn.innerText == "") {
                col_val = null
            } else if (col_names[idx] in column_formatters["decimals"] && !(col_names[idx] in column_formatters["date"]) && !(col_names[idx] in column_formatters["datetime"])) {
                if (cn.getAttribute("title") === null) {
                    col_val = ""
                } else {

                    if (isNaN(parseFloat(cn.getAttribute("title")))) {
                        col_val = (cn.getAttribute("title"))
                    } else {
                        col_val = parseFloat(cn.getAttribute("title"))
                    }

                }
            } else {
                col_val = cn.innerText
            }

            if (cn.firstChild) {
                cn.firstChild.remove()
            }
            initial_row_values.push(col_val)
            if (col_names[idx] in column_formatters["lov"]) {
                input_el = get_cl_element("select", "form-select p-1", null)
                let selected_flag = false
                for (let opt_val of column_formatters["lov"][col_names[idx]]) {

                    let el = get_cl_element("option", null, null, document.createTextNode(opt_val))
                    input_el.appendChild(el)
                    if (opt_val == col_val) {
                        el.setAttribute("selected", "")
                        selected_flag = true
                    }
                }
                if (!selected_flag) {
                    let el = get_cl_element("option", null, null, document.createTextNode(col_val))
                    input_el.appendChild(el)
                }

            } else if (col_names[idx] in column_formatters["autofiller"]) {
                input_el = get_cl_element("input", "form-control p-1", null)
                awesomeplete = true
            } else if (col_names[idx] in column_formatters["decimals"] && !(col_names[idx] in column_formatters["date"]) && !col_names[idx] in column_formatters["datetime"]) {
                input_el = get_cl_element("input", "form-control p-1", null)
                input_el.type = "number"
            } else if (column_formatters["datetime"] && col_names[idx] in column_formatters["datetime"]) {
                input_el = get_cl_element("input", "form-control datepicker-input p-1", null)
                dt_picker = flatpickr(input_el, {
                    dateFormat: "Y-m-d H:i:S",
                    allowInput: true,
                    defaultDate: col_val
                });
                input_el.type = "text"
            } else if (column_formatters["date"] && col_names[idx] in column_formatters["date"]) {
                input_el = get_cl_element("input", "form-control datepicker-input p-1", null)
                input_el.value = col_val
                dt_picker = flatpickr(input_el, {
                    dateFormat: "Y-m-d",
                    allowInput: true,
                    defaultDate: col_val
                });
                input_el.type = "text"
            }
            else {
                input_el = get_cl_element("input", "form-control p-1", null)
                input_el.type = "text"
            }
            input_el.addEventListener("keydown", function (e) {
                if (e.keyCode == "27") {
                    restore_values(tr)
                } else if (e.keyCode == "13") {
                    update_row(tr)
                    e.preventDefault()
                }
            })
            input_el.value = col_val
            cn.appendChild(input_el)
            if (awesomeplete) {
                input_el.setAttribute("list", `${col_names[idx]}_dataList`)
            }
        }
    }
    td.firstChild.focus()
}

function get_dataList(col_name, optionsList) {
    let datalist = get_cl_element("datalist", null, col_name)
    for (let option of optionsList) {
        let opt = get_cl_element("option")
        opt.setAttribute("value", option)
        datalist.appendChild(opt)
    }
    return datalist
}

function restore_values(tr) {
    tr.parentNode.replaceChild(get_table_row(initial_row_values), tr)
    initial_row_values = []
    current_row_id = 0
}

function detect_changes(updated_row) {
    if (JSON.stringify(updated_row) == JSON.stringify(initial_row_values)) {
        return false
    } else {
        return true
    }
}


async function update_row(tr) {
    let updated_row = get_row_array(tr)
    if (updated_row && updated_row.length > 0) {
        if (detect_changes(updated_row)) {
            let update_dict = new Object
            for (const [idx, val] of updated_row.entries()) {
                if (val !== initial_row_values[idx]) {
                    if (column_formatters["date"] && col_names[idx] in column_formatters["date"]) {
                        let new_val = convertDateToExcelDate(val)
                        update_dict[col_names[idx]] = new_val
                    } else if (column_formatters["datetime"] && col_names[idx] in column_formatters["datetime"]) {
                        let new_val = convertDateTimeToExcelNumber(val)
                        update_dict[col_names[idx]] = new_val
                    } else {
                        update_dict[col_names[idx]] = val
                    }
                }
            }

            initial_row_values = []
            current_row_id = 0

            const x = await gm.updateRow(modelName, tableName, updated_row[0], update_dict, document.getElementById("selectAll").parentNode.id)
            const table = table_el.querySelector('table')
            let updtd_row = get_table_row(updated_row)

            var leftC = 0;

            for (var i = 0; i < freeze_col_num; i++) {
                leftC += table.rows[0].cells[i].clientWidth + 1;

                for (let cell of updtd_row.cells) {

                    if (i == 0 && cell.classList.contains(`C${i}`)) {
                        cell.style.left = 0 + "px";
                    } else if (cell.classList.contains(`C${i + 1}`)) {
                        cell.style.left = leftC + "px";
                    }
                }
            }
            tr.parentNode.replaceChild(updtd_row, tr)
        } else {
            restore_values(tr)
        }
    }

}


function add_insert_row() {
    let tr = get_cl_element("tr", "insert")
    let input_el
    for (const [idx, col_name] of col_names.entries()) {
        let autofill_flag = false
        let td = document.createElement("td")
        tr.appendChild(td)
        if (idx == 0) {
            td.id = 0
        }
        else if (idx > 0) {
            if (col_name in column_formatters["lov"] && column_formatters["lov"][col_name].toLowerCase() != 'freetext') {
                input_el = get_cl_element("select", "form-select p-1", null)
                for (let opt_val of column_formatters["lov"][col_name]) {
                    let el = get_cl_element("option", null, null, document.createTextNode(opt_val))
                    input_el.appendChild(el)
                }

            } else if (col_name in column_formatters["autofiller"]) {
                input_el = get_cl_element("input", "form-control p-1", null)
                autofill_flag = true
            } else if (col_name in column_formatters["decimals"]) {
                input_el = get_cl_element("input", "form-control p-1", null)
                input_el.type = "number"
            } else if (column_formatters["date"] && col_name in column_formatters["date"]) {
                input_el = get_cl_element("input", "form-control datepicker-input p-1", null)
                dt_picker = flatpickr(input_el, {
                    dateFormat: "Y-m-d H:i:S",
                    allowInput: true
                });
                input_el.type = "text"
            }
            else {
                input_el = get_cl_element("input", "form-control p-1", null)
                input_el.type = "text"
            }
            input_el.addEventListener("keydown", function (e) {
                if (e.keyCode == "27") {
                    for (let cn of this.parentNode.parentNode.childNodes) {
                        let inp_el = cn.firstChild
                        if (inp_el) {
                            if (inp_el.classList.contains("form-control")) {
                                inp_el.value = ""
                            }
                        }
                    }
                }
                else if (e.keyCode == "13") {
                    insert_row(this.parentNode.parentNode)
                    e.preventDefault()
                }
            })
            td.appendChild(input_el)
            if (autofill_flag) {
                input_el.setAttribute("list", `${col_name}_dataList`)

            }
        }
    }
    return tr
}


async function insert_row(tr) {
    let insert_dict = {}
    const row_data = get_row_array(tr)
    if (row_data) {
        for (const [idx, cn] of row_data.entries()) {
            if (idx > 0) {
                insert_dict[col_names[idx]] = cn
            }
        }

        const x = await gm.insertRow(modelName, tableName, insert_dict)
        if ("Success" in x) {
            row_data[0] = x["Success"]
            const tbody_el = tr.parentNode
            const summary_el = tbody_el.lastChild
            const new_tr = get_table_row(row_data)
            tr.remove()
            tbody_el.appendChild(new_tr)
            tbody_el.appendChild(add_insert_row())
            tbody_el.appendChild(summary_el)
        } else {
            confirmBox("Error!", `Error:  ${x["Error"]}`)
        }
    }
}

function get_table_row(row, selected_idx, select_all = false, page_num = 1) {
    let tr = get_cl_element("tr")
    const tbl = table_el.querySelector("tbody")

    let td

    for (const [idx, val] of row.entries()) {
        if (primary_column && idx == 0) {
            let input_el = get_cl_element("input", "form-check-input")
            input_el.setAttribute("type", "checkbox")
            if (select_all) {
                input_el.checked = true
            }
            if (page_num > 1) {
                input_el.disabled = true
            } else {
                input_el.onchange = function () {
                    const select_el = document.getElementById("selectAll")

                    if (!this.checked && select_el.checked) {
                        select_el.checked = false
                    } else if (this.checked && !select_el.checked) {
                        select_el.checked = true
                        for (let cn of tbl.querySelectorAll("input[type=checkbox]")) {
                            if (!cn.checked) {
                                select_el.checked = false
                                break;
                            }
                        }
                    }
                }
            }

            td = get_cl_element("td", null, val, input_el)
            tr.appendChild(td)
        } else {
            if (val === null) {
                td = get_cl_element("td")
            } else {
                if (col_names[idx] in column_formatters["decimals"] && !(col_names[idx] in column_formatters['date']) && !(col_names[idx] in column_formatters['datetime'])) {
                    td = get_cl_element("td")
                    td.style = 'text-align:right;'
                    if (isNaN(val)) {
                        td.appendChild(document.createTextNode(val))
                        td.style.backgroundColor = "red"
                        td.setAttribute("title", "Expecting Numeric Value")
                    } else {
                        td.appendChild(document.createTextNode(get_col_string(col_names[idx], val)))
                        td.setAttribute("title", val)
                    }

                } else {
                    td = get_cl_element("td", null, null, document.createTextNode(val))
                    td.setAttribute("title", val)

                }
            }
            td.ondblclick = function (e) {
                if (editable_flag) {
                    if (current_row_id == 0) {
                        open_row(this)
                    } else if (current_row_id !== this.parentNode.firstChild.id) {
                        if (detect_changes(get_row_array(document.getElementById(current_row_id).parentNode))) {
                            confirmBox("Alert!", "You have unsaved changes")
                        } else {
                            restore_values(document.getElementById(current_row_id).parentNode)
                            open_row(this)
                        }
                    }

                }
            }
            tr.appendChild(td)
        }
        if (idx < freeze_col_num) {
            td.classList.add(`C${idx}`)
            td.classList.add('ZDX_R')
            td.classList.add('STX')
            td.classList.add('FXC')
        }
    }
    if (selected_idx > 0 && selected_idx < row.length) {
        tr.childNodes[selected_idx].classList.add("selected_col")
    }
    return tr
}



document.getElementById("formatColumn").onclick = function (e) {
    const selected_header = table_el.querySelector('thead .selected_col')
    if (selected_header) {
        const decimalPlaces = document.getElementById("decimalPlaces")
        const commaSeparator = document.getElementById("commaSeparator")
        const localeString = document.getElementById("localeString")
        const displayCurrency = document.getElementById("displayCurrency")
        const aggregateFunction = document.getElementById("aggregateFunction")
        const fieldType = document.getElementById("fieldType")


        const col_name = selected_header.innerText


        if (!(col_name in column_formatters["decimals"])) {
            lovText.style.display = ''
        } else {
            lovText.style.display = 'none'
        }

        decimalPlaces.parentElement.style.display = 'none'
        commaSeparator.parentElement.style.display = 'none'
        localeString.parentElement.style.display = 'none'
        displayCurrency.parentElement.style.display = 'none'
        aggregateFunction.parentElement.style.display = 'none'
        fieldType.parentElement.style.display = ''

        const options = {
            freetext: 'Free Text',
            autofiller: 'Auto Filler',
            date: 'Date',
            datetime: 'Date Time',
            lov: 'LOV',
            numeric: 'Numeric'
        };

        fieldType.innerHTML = '';


        if (col_name in column_formatters["decimals"] && !(col_name in column_formatters['date']) && !(col_name in column_formatters['datetime'])) {
            fieldType.add(new Option(options.numeric, 'numeric'));
            fieldType.add(new Option(options.date, 'date'));
            fieldType.add(new Option(options.datetime, 'datetime'));
        } else {
            for (let key in options) {
                if (key !== 'numeric') {
                    fieldType.add(new Option(options[key], key));
                }
            }
        }

        if (col_name in column_formatters['date'] || col_name in column_formatters['datetime']) {
            fieldType.add(new Option('Numeric', 'numeric'));
            fieldType.value = 'date'
            if (col_name in column_formatters['datetime']) {
                fieldType.value = 'datetime'
            }
            lovText.style.display = 'none'
        } else if (col_name in column_formatters["decimals"]) {
            decimalPlaces.parentElement.style.display = ''
            commaSeparator.parentElement.style.display = ''
            localeString.parentElement.style.display = ''
            displayCurrency.parentElement.style.display = ''
            aggregateFunction.parentElement.style.display = ''
            fieldType.value = 'numeric'

            const n = column_formatters["decimals"][col_name]
            const comma_flag = column_formatters["comma"][col_name]
            const locale = column_formatters["locale"][col_name]
            const currency = column_formatters["currency"][col_name]
            const aggregate = column_formatters["aggregate"][col_name]

            decimalPlaces.value = n
            commaSeparator.value = comma_flag
            localeString.value = locale
            displayCurrency.value = currency
            aggregateFunction.value = aggregate
        }
        else {
            let col_vals = []
            if (col_name in column_formatters['lov'] && column_formatters['lov'][col_name].toLowerCase() != 'freetext') {
                fieldType.value = 'lov'
                col_vals = column_formatters['lov'][col_name]

            } else if (col_name in column_formatters['autofiller']) {
                fieldType.value = 'autofiller'
                col_vals = column_formatters['autofiller'][col_name]

            } else if (col_name in column_formatters['date']) {
                fieldType.value = 'date'
                lovText.style.display = 'none'
            } else {
                fieldType.value = 'freetext'
                lovText.style.display = 'none'
            }

            if (column_formatters['query'] && col_name in column_formatters['query']) {
                lovText.value = column_formatters['query'][col_name]
                lovText.style.display = ''
            } else if (col_vals.length > 0) {
                lovText.value = col_vals.join(';')
                lovText.style.display = ''

            } else {
                lovText.value = ''
            }


        }
        const bs_modal = new bootstrap.Modal(document.getElementById("modal-format-column"))
        bs_modal.show()
    } else {
        confirmBox("Alert!", "Please select a column")
    }

}


const fieldType = document.querySelector('#fieldType');
const lovInnerText = document.querySelector('#lovText');

fieldType.addEventListener('change', (e) => {
    decimalPlaces.parentElement.style.display = 'none'
    commaSeparator.parentElement.style.display = 'none'
    localeString.parentElement.style.display = 'none'
    displayCurrency.parentElement.style.display = 'none'
    aggregateFunction.parentElement.style.display = 'none'
    if (e.target.value == 'date' || e.target.value == 'datetime' || e.target.value == 'freetext' || e.target.value == 'numeric') {
        lovInnerText.style.display = 'none';
        if (e.target.value == 'numeric') {
            decimalPlaces.parentElement.style.display = ''
            commaSeparator.parentElement.style.display = ''
            localeString.parentElement.style.display = ''
            displayCurrency.parentElement.style.display = ''
            aggregateFunction.parentElement.style.display = ''
        }
    } else {
        lovInnerText.style.display = '';
    }

})

document.getElementById("updateFormats").onclick = async function (e) {
    const parameter_dict = new Object
    const col_name = table_el.querySelector('thead .selected_col').innerText
    const n = parseInt(document.getElementById("decimalPlaces").value)
    const aggregate = document.getElementById("aggregateFunction").value
    const comma_flag = parseInt(document.getElementById("commaSeparator").value)
    const fieldType = document.getElementById('fieldType').value
    const lovInnerText = document.getElementById('lovText').value


    let locale = document.getElementById("localeString").value
    let currency = document.getElementById("displayCurrency").value


    if (currency == "0") {
        currency = 0
    }

    if (locale == "0") {
        locale = 0
    }


    if (fieldType == 'date' || fieldType == 'datetime') {
        if (col_name in column_formatters["decimals"]) {
            delete column_formatters["decimals"][col_name]
            delete column_formatters["comma"][col_name]
            delete column_formatters["locale"][col_name]
            delete column_formatters["currency"][col_name]
            delete column_formatters["aggregate"][col_name]
        }
        parameter_dict["LOV"] = fieldType[0].toUpperCase() + fieldType.slice(1)
        if (col_name in column_formatters['lov']) {
            delete column_formatters['lov'][col_name]
        }
        if (col_name in column_formatters['autofiller']) {
            delete column_formatters['autofiller'][col_name]
        }
        if (col_name in column_formatters['query']) {
            delete column_formatters['query'][col_name]
        }
        if (col_name in column_formatters['date'] && fieldType != 'date') {
            delete column_formatters['date'][col_name]
        } else if (col_name in column_formatters['datetime'] && fieldType != 'date') {
            delete column_formatters['datetime'][col_name]
        }
        column_formatters[fieldType][col_name] = 1

    } else if (fieldType == 'autofiller') {
        if (lovInnerText !== '') {
            parameter_dict["LOV"] = `Autofiller | ${lovInnerText}`
            if (col_name in column_formatters['lov']) {
                delete column_formatters['lov'][col_name]
            }

            column_formatters['query'][col_name] = lovInnerText

            if (lovInnerText.trim().toLowerCase().substring(0, 6) == "select") {
                const result = await gm.runSelectQuery(modelName, lovInnerText)
                column_formatters["autofiller"][col_name] = result
                let dl = document.getElementById(`${col_name}_dataList`)
                if (dl) {
                    dl.remove()
                }
                document.getElementById("dataList_div").appendChild(get_dataList(`${col_name}_dataList`, result))

            } else {
                let lov_list2 = []
                for (let lov_mem of lovInnerText.trim().split(";")) {
                    if (lov_mem.trim().length > 0) {
                        lov_list2.push(lov_mem.trim())
                    }
                }
                column_formatters["autofiller"][col_name] = lov_list2
                let dl = document.getElementById(`${col_name}_dataList`)
                if (dl) {
                    dl.remove()
                }
                document.getElementById("dataList_div").appendChild(get_dataList(`${col_name}_dataList`, lov_list2))
            }
        }
    } else if (fieldType == 'lov') {
        if (lovInnerText !== '') {
            parameter_dict["LOV"] = `Select | ${lovInnerText}`
            if (col_name in column_formatters['lov']) {
                delete column_formatters['lov'][col_name]
            }
            if (lovInnerText.trim().toLowerCase().substring(0, 6) == "select") {
                column_formatters["query"][col_name] = lovInnerText
                const result = await gm.runSelectQuery(modelName, lovInnerText)
                column_formatters["lov"][col_name] = result
            } else {
                let lov_list2 = []
                for (let lov_mem of lovInnerText.trim().split(";")) {
                    if (lov_mem.trim().length > 0) {
                        lov_list2.push(lov_mem.trim())
                    }
                }
                delete column_formatters['lov'][col_name]
                column_formatters["lov"][col_name] = lov_list2
            }
        }
    } else if (fieldType == 'freetext') {
        parameter_dict["LOV"] = 'Freetext'
        if (col_name in column_formatters['lov']) {
            delete column_formatters['lov'][col_name]
        }
        if (col_name in column_formatters['autofiller']) {
            delete column_formatters['autofiller'][col_name]
        }
        if (col_name in column_formatters['date']) {
            delete column_formatters['date'][col_name]
        }
        if (col_name in column_formatters['datetime']) {
            delete column_formatters['datetime'][col_name]
        }
        if (col_name in column_formatters['query']) {
            delete column_formatters['query'][col_name]
        }
    } else {
        if (col_name_types[col_name] == 'NUMERIC') {
            if (col_name in column_formatters['lov']) {
                delete column_formatters['lov'][col_name]
            }
            if (col_name in column_formatters['autofiller']) {
                delete column_formatters['autofiller'][col_name]
            }
            if (col_name in column_formatters['date']) {
                delete column_formatters['date'][col_name]
            }
            if (col_name in column_formatters['datetime']) {
                delete column_formatters['datetime'][col_name]
            }
            if (col_name in column_formatters['query']) {
                delete column_formatters['query'][col_name]
            }

            parameter_dict["Decimals"] = n
            parameter_dict["Comma"] = comma_flag
            parameter_dict["Locale"] = locale
            parameter_dict["Currency"] = currency
            parameter_dict["Aggregate"] = aggregate

            column_formatters["decimals"][col_name] = n
            column_formatters["comma"][col_name] = comma_flag
            column_formatters["locale"][col_name] = locale
            column_formatters["currency"][col_name] = currency
            column_formatters["aggregate"][col_name] = aggregate
        } else {
            confirmBox('Alert', "You can't convert text column to Numeric.")
            return
        }
    }





    const bs_modal = bootstrap.Modal.getInstance(document.getElementById("modal-format-column"))
    bs_modal.hide()
    await gm.setTableFormatter(modelName, tableName, col_name, parameter_dict)
    reload_table_data()
    let el = table_el.querySelector('tr.insert')
    el.remove()

    const tbody = table_el.querySelector('tbody')
    tbody.appendChild(add_insert_row())
    for (let cn of table_el.querySelectorAll("td.selected_col")) {
        if (cn.firstChild && cn.firstChild.tagName !== "INPUT") {
            if (col_name in column_formatters["decimals"]) {
                let val = parseFloat(cn.getAttribute("title"))
                cn.innerText = get_col_string(col_name, val)
            } else {
                let val = cn.getAttribute("title")
                cn.innerText = val
            }
        }
    }
}

function get_col_string(col_name, col_val) {

    if (col_val === undefined || col_val === null) {
        return ""
    }
    const n = column_formatters["decimals"][col_name]
    const locale_obj = {
        maximumFractionDigits: n,
        minimumFractionDigits: n,
        useGrouping: false
    }
    let currency = column_formatters["currency"][col_name]
    const comma_flag = column_formatters["comma"][col_name]
    const locale = column_formatters["locale"][col_name]
    if (currency) {
        locale_obj["style"] = "currency"
        locale_obj["currency"] = currency
    }
    if (comma_flag) {
        locale_obj["useGrouping"] = true
    }

    return col_val.toLocaleString(locale, locale_obj)

}

function get_row_array(tr) {
    let updated_row = []
    let header_row = table_el.querySelector("tr.headers").childNodes

    for (const [idx, cn] of tr.childNodes.entries()) {
        if (idx == 0) {
            updated_row.push(cn.id)
        } else {
            let col_val = cn.firstChild.value
            if (cn.firstChild.classList.contains("awesomplete")) {
                col_val = cn.firstChild.firstChild.value
            }
            if (col_names[idx] in column_formatters["decimals"] && isNaN(col_val) && !(col_names[idx] in column_formatters["date"]) && !(col_names[idx] in column_formatters["datetime"])) {
                confirmBox("Alert!", `Please enter numeric value in ${col_names[idx]} Column`)
                return
            } else if (col_val.trim() == "" && header_row[idx].querySelector("u")) {
                confirmBox("Alert!", `Please enter not null value in ${col_names[idx]} Column`)
                return
            } else if (column_formatters["date"] && col_names[idx] in column_formatters["date"]) {
                let new_val = col_val.split(' ')
                if (new_val[1] === '00:00:00') {
                    col_val = new_val[0]
                }
            }

            if (col_val.trim() == "") {
                col_val = null
            } else if (col_val.trim() == "null" && col_names[idx] in column_formatters["lov"]) {
                col_val = null
            } else if (col_names[idx] in column_formatters["decimals"] && !(col_names[idx] in column_formatters["date"]) && !(col_names[idx] in column_formatters["datetime"])) {
                col_val = parseFloat(col_val)
            }

            updated_row.push(col_val)
        }
    }

    return updated_row
}

function reset_sort() {
    let get_data = false
    for (let item of document.querySelector('.headers').childNodes) {
        let el = item.querySelector('span')
        if (el) {
            if (!el.classList.contains('fa-sort')) {
                get_data = true
                if (el.classList.contains('fa-sort-down')) {
                    el.classList.remove('fa-sort-down')
                } else if (el.classList.contains('fa-sort-up')) {
                    el.classList.remove('fa-sort-up')
                }
                el.classList.add("fa-sort")
            }
        }

    }
    if (get_data) {
        sort_columns = []
        sort_col_names = {}
        get_table_data(col_names);
        save_sort();
    }
}

document.getElementById("ok-query").onclick = function () {
    const view_query = document.getElementById("queryInput").value
    if (view_query.trim() == "") {
        confirmBox("Alert!", "Please enter a query")
    }
    postData('/home/check-or-createview', { view_name: sessionStorage.table_name, view_query: view_query, is_exist: true }).then(data => {
        document.getElementById("queryInput").value = view_query
        const bs_modal = bootstrap.Modal.getInstance(document.getElementById("modal-get-viewQuery"))
        bs_modal.hide()
        init()
        confirmBox("Success", "View updated successfully")
    })
}


document.getElementById("copyTable").onclick = async function () {
    document.getElementById("data-loader").style.display = ""
    const data = await gm.fetchTableData(modelName, tableName, col_names, parameters, {}, {}, 1, [], false)
    if (data) {
        document.getElementById("data-loader").style.display = "none"
        if (data[1] > 100000) {
            confirmBox("Alert!", "Sorry! , Data exceeded maximum Limit")
            return
        }

        copyArrayToClipboard(data[0])
    }

}

function copyTextToClipboard(text) {

    navigator.clipboard.writeText(text).then(function () {
        document.getElementById("data-loader").style.display = "none"
        confirmBox('Success', 'Copied to clipboard')
    }, function (err) {
        document.getElementById("data-loader").style.display = "none"
        confirmBox('Alert!', `Error occured : ${err}`)
    });
}

function copyArrayToClipboard(array) {
    var csv = '', row, cell;
    for (row = 0; row < array.length; row++) {
        for (cell = 0; cell < array[row].length; cell++) {
            csv += (array[row][cell] + '').replace(/[\n\t]+/g, ' ');
            if (cell + 1 < array[row].length) csv += '\t';
        }
        if (row + 1 < array.length) csv += '\n';
    }
    copyTextToClipboard(csv);
}

document.getElementById("modal-file-upload").addEventListener('show.bs.modal', function () {
    document.getElementById("fileUpload").value = ""
})

function get_icon_class(col_name) {
    let icon_class = "fa-sort"

    for (let rw of sort_columns) {
        if (col_name === rw[0]) {
            if (rw[1] === "asc") {
                icon_class = "fa-sort-down"
            } else {
                icon_class = "fa-sort-up"
            }
            break
        }

    }
    return icon_class
}

document.getElementById("saveSort").onclick = save_sort

async function save_sort() {
    await gm.saveSortColumns(modelName, tableName, sort_columns)
    sort_col_names = {}
    for (let sc of sort_columns) {
        sort_col_names[sc[0]] = sc[1]
    }
    if (this) {
        confirmBox("Success", "Sort saved successfully")
    }

}

async function get_sort() {
    let data = await gm.fetchSort(modelName, tableName)

    sort_columns = data
    for (let sc of data) {
        sort_col_names[sc[0]] = sc[1]
    }

}

function get_parameters() {
    for (let param of params.entries()) {
        if (!['tablename', 'modelname'].includes(param[0].toLowerCase())) {
            parameters[param[0]] = param[1].split(',')
        }
    }
}

function freeze_headers() {
    const table = table_el.querySelector('table')
    var leftC = 0;

    for (var i = 0; i < freeze_col_num; i++) {
        leftC += table.rows[0].cells[i].clientWidth + 1;

        for (let rw of table.rows) {

            for (let cell of rw.cells) {

                if (i == 0 && cell.classList.contains(`C${i}`)) {

                    cell.style.left = 0 + "px";
                } else if (cell.classList.contains(`C${i + 1}`)) {

                    cell.style.left = leftC + "px";
                }
            }
        }
    }

}

document.getElementById('saveFreeze').onclick = async function () {
    const selected_header = table_el.querySelector('thead .selected_col')
    if (selected_header) {
        const col_name = selected_header.innerText

        let col_num = col_names.indexOf(col_name) + 1

        if (col_num == freeze_col_num) {
            col_num = 0
        }

        await gm.freezeColNum(modelName, tableName, col_num)
        freeze_col_num = col_num;

        for (let tr of table_el
            .querySelectorAll("tr")) {
            tr.childNodes[col_names.indexOf(col_name)].classList.remove("selected_col")

            for (let [idx, el] of tr.childNodes.entries()) {
                if (idx < freeze_col_num) {
                    el.classList.add(`C${idx}`)

                    if (tr.classList.contains('headers') || tr.classList.contains('lovRow')) {
                        el.classList.add('ZDX_H')
                    } else {
                        el.classList.add('ZDX_R', 'STX', 'FXC')

                    }
                } else {
                    if (tr.classList.contains('headers') || tr.classList.contains('lovRow')) {
                        el.style.left = '';
                        el.classList.remove(`C${idx}`, 'ZDX_H')
                    } else {
                        el.classList.remove('ZDX_R', 'STX', 'FXC')
                    }
                }
            }
        }

        freeze_headers()

    } else {
        confirmBox("Alert!", "Please select a column")
    }

}

function convertDateToExcelDate(date) {
    date = new Date(date);
    const excelEpoch = new Date(1899, 11, 30);
    const diffInTime = date - excelEpoch;
    const diffInDays = diffInTime / (1000 * 60 * 60 * 24);
    return Math.floor(diffInDays);
}

function convertDateTimeToExcelNumber(date) {
    date = new Date(date);
    date.setHours(0, 0, 0, 0)
    const excelEpoch = new Date(1899, 11, 30);
    const daysDiff = (date - excelEpoch) / (1000 * 60 * 60 * 24);
    return Math.floor(daysDiff + 1);
}

export { column_formatters, col_names, get_table_row, add_insert_row }