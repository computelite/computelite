import { postData,get_cl_element,confirmBox,executeQuery, fetchData, uploadFile,executePython,addDefaultModel } from "../../../assets/js/scc"
import {uploadExcel,downloadExcel,get_uploadExcel_info} from "../../../core/gridMethods"
import sqlScripts from "../../../core/modelSql"

import * as bootstrap from 'bootstrap'
const scc_one_modal = document.getElementById("scc-one-modal")
let selected = []
let excelUploadInfo = {}
let selectedFile = null
let imgBlob = null
const current_version = "1.0.5"

const params = new URLSearchParams(window.location.search)

const modelUID = params.get('modelUID');

const icons_class = {'Sample_DB': 'fas fa-database','Supply Planning':'fas fa-database'}


function get_accordian(group_name, table_list) {
    let accordian_id = group_name.replace(/\s/g, "_")
    let card_border = get_cl_element("div", "accordion-item border-light mb-0", null,
        get_cl_element("h2", "accordion-header", accordian_id + '_head',
            get_cl_element("button", "accordion-button collapsed", null,
                get_cl_element("span", "h6 mb-0 font-weight-bold", null, document.createTextNode(group_name)))))
   
    card_border.querySelector("button").setAttribute("type", "button")
    card_border.querySelector("button").setAttribute("data-bs-toggle", "collapse")
    card_border.querySelector("button").setAttribute("aria-expanded", "false")
    card_border.querySelector("button").setAttribute("data-bs-target", '#' + accordian_id)
    card_border.querySelector("button").setAttribute("aria-controls", accordian_id)

    let card_body = get_cl_element("div", "accordion-collapse collapse", accordian_id,
        get_cl_element("div", "accordion-body", null,
            get_cl_element("table", "table table-hover", null,
                get_cl_element("tbody", null, null, null))))
    card_body.setAttribute("aria-labelledby", accordian_id + '_head')
    card_body.setAttribute("data-bs-parent", "#tableGroup")

    for (let table_name of table_list) {
        let el = get_cl_element("tr", null, null,
            get_cl_element("td", null, null, document.createTextNode(table_name[1])))
        el.onclick = function () {
            const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
            window.open(`./tableDisplay.html?tableName=${table_name[0]}&modelName=${selected_model.innerText}`);
        }
        el.setAttribute("tableName", table_name[0])
        card_body.querySelector("tbody").appendChild(el)
    }

    card_border.appendChild(card_body)

    return card_border
}

document.addEventListener("DOMContentLoaded", async function() {

    // Initialize the SQLite3 module
    let result = await executeQuery('init')
    if (!result || result.msg != 'Success'){
        confirmBox('Alert!','Some error occured while initializing sqlite.')
        return
    }

    if (modelUID){
        await postData('/home/get-attached-model',{modelId:`${modelUID}`})
        const url = window.location.origin + window.location.pathname;
        history.replaceState(null, '', url);        
    }

    setTimeout(get_user_models, 400);

    const shareBtn = document.getElementById('shareBtn');
    shareBtn.classList.add('blink');
    
   
    const modalElements = document.querySelectorAll('.modal');
    modalElements.forEach(modalElement => {
        if (!bootstrap.Modal.getInstance(modalElement)) {
        new bootstrap.Modal(modalElement);
        }
    });
    
    

    document.getElementById("modal-createView").addEventListener('hide.bs.modal',function(){
        document.getElementById("viewName").value = ""
        document.getElementById("query-input").value = ""
    })

    document.getElementById("editorBtn").onclick = async function(){
        const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue").innerText
        if (!selected_model){
            confirmBox("Alert!","Please select a model")
            return
        }    
        window.open(`/sqlEditor.html?tableName=V_TEMPV&modelName=${selected_model}`);
    }

    document.getElementById('availInpFiles').onclick = function(){
        document.getElementById('modal-input-files').querySelector('h2').innerText = 'Input Files'
        populateInputFiles()
    } 
    
    document.getElementById('availOutFiles').onclick = function(){
        document.getElementById('modal-input-files').querySelector('h2').innerText = 'Output Files'
        populateOutputFiles()
    } 

    
    document.getElementById("shareBtn").onclick = function(){
        const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
        if (!selected_model){
            confirmBox("Alert!","Please select a model")
            return
        }
        const modelName = selected_model.innerText
        const projectName = selected_model.getAttribute('project')
        window.open(`./editorPage.html?projectName=${projectName}&modelName=${modelName}`);
    }


    document.getElementById("closeOutput").onclick = function(){
        document.getElementById('outputDiv').style.display = "none"     
    }

    document.getElementById("ok-view").onclick = create_view;
    document.getElementById("deleteModel").onclick = remove_modal.bind(null,true)
    document.getElementById("removeModel").onclick = remove_modal.bind(null,false)
    document.getElementById("addNew").onclick = get_newModel_modal.bind(null,"Add New Model",false)
    document.getElementById('downloadAllFiles').onclick = fetchFilesAndDownloadZip
    document.getElementById("addExisting").onclick = addExistingModel
    document.getElementById("saveAs").onclick = saveAsModel
    document.getElementById("uploadModel").onclick = uplaodModel
    document.getElementById("downloadModel").onclick = downloadModel
    document.getElementById("uploadExcel").onclick = uploadExcelFile
    document.getElementById("downloadExcel").onclick = downloadExcelFile
    document.getElementById("vacuum").onclick = vacuumModel
    document.getElementById('saveFiles').onclick = saveFiles
    document.getElementById("uploadPackage").onclick = uploadPackage
    document.getElementById('downloadOutput').onclick = downloadOutput    

    await executePython('init','editor')
    shareBtn.classList.remove('blink');
});

async function get_user_models() {
    document.getElementById("tableGroup").innerHTML = ""
    let all_models = await fetchData('home','getUserModels')
    if (all_models.length == 0){
        let model = await addDefaultModel()
        if ((model).length > 0){
            all_models.push(model)
        }
    }
    populate_models(all_models)
    return all_models
}

function populate_models(model_names) {
    let model_body = document.getElementById("availableModal")
    model_body.innerHTML = ""
    for (let model_name of model_names) {
        model_body.appendChild(get_li_element(model_name))
    }

    if (modelUID && model_body.lastChild){
        model_body.lastChild.click()
    }else if ( model_body.firstChild){
        model_body.firstChild.click()
    }
}

function get_li_element(model_name) {
    let el = get_cl_element("li", "nav-item mb-0", null,null)
    let el_child = get_cl_element("a","nav-link p-2 rounded-0")
    el_child.appendChild(get_cl_element("span","d-block text-left",null,null))
    el_child.firstChild.appendChild(get_cl_element("span",`${icons_class[model_name[1]]} pe-2`))
    el_child.firstChild.appendChild(document.createTextNode(model_name[0]))
    el.appendChild(el_child)
    el.setAttribute("project", model_name[2])
    el.setAttribute("template", model_name[1])
    el.setAttribute("dbtype",model_name[3])
    el.onclick = async function (e) {
        let proj_name = el.getAttribute('project')
        document.getElementById('outputTxt').innerHTML = ""
        
        if (!this.classList.contains("selectedValue")) {
            // UPGRADE VERSION
            let version = await fetchData('home','getVersion',{ model_name: this.innerText })
            if (version !== current_version){
                await fetchData('home','upgradeVersion',{ modelName: this.innerText,db_version:version,current_version: current_version})
            }
            
            for (let cn of this.parentNode.querySelectorAll("li.selectedValue")) {
                cn.classList.remove("selectedValue")
            }
            get_model_tables(this.innerText,model_name[1])

            this.classList.add("selectedValue")
            e.preventDefault();
        }
        
        await populateExecutableFiles(this.innerText)
    }
    return el
}

async function get_model_tables(model_name,template) {
    document.getElementById("tableGroup").innerHTML = ""    
    const data = await fetchData('home','fetchTableGroups',{ model_name: model_name })

    for (let group_name in data) {
        document.getElementById("tableGroup").appendChild(get_accordian(group_name, data[group_name]))
    }    
}


function get_scc_tree(model_dict,parent_icon = "fa-server",project = null) {
    let tree = get_cl_element("ul", "tree")
    for (let project_name in model_dict) {
        tree.appendChild(document.createElement("li"))
        let parent = get_tree_li_element(project_name, parent_icon)
        tree.appendChild(parent)
        parent.onclick = function () {
            let ul = parent.nextElementSibling
            if (parent.firstChild.checked) {
                parent.firstChild.checked = false
                for (let li of ul.childNodes) {
                    if (li.firstChild.checked) {
                        li.firstChild.checked = false
                    }
                }
            } else {
                parent.firstChild.checked = true
                for (let li of ul.childNodes) {
                    if (!li.firstChild.checked) {
                        li.firstChild.checked = true
                    }
                }
            }

        }
        tree.appendChild(get_cl_element("ul", "childList TreeMembers"))
        for (let model_name of model_dict[project_name]) {
            let el = get_tree_li_element(model_name[0], icons_class[model_name[1]])
            if (!project){
                el.onclick = function (e) {
                    if (el.firstChild.checked) {
                        el.firstChild.checked = false
                        if (parent.firstChild.checked) {
                            parent.firstChild.checked = false
                        }
                    } else {
                        el.firstChild.checked = true
                        parent.firstChild.checked = true
                        for (let cn of this.parentNode.childNodes) {
                            if (!cn.firstChild.checked) {
                                parent.firstChild.checked = false
                            }
                        }
                    }
                }
            }
            tree.lastChild.appendChild(el)
        }
    }
    return get_cl_element("div", "card-body scc-box", null, tree)
}

function get_tree_li_element(level_name, span) {
    let el = get_cl_element("li", null, null, get_cl_element("input", "inputcheckbox"))
    el.firstChild.setAttribute("type", "checkbox")
    let label = get_cl_element("label", "checkBox-label", null,
        get_cl_element("span", `fas ${span}`), null)
    label.appendChild(document.createTextNode(level_name))
    el.appendChild(label)
    return el
}

function populate_modal(header_name, btn_text) {
    const modal_header = scc_one_modal.querySelector('.modal-header h2')
    modal_header.innerHTML = ""
    modal_header.innerText = header_name
    const modal_body = scc_one_modal.querySelector(".modal-body")
    modal_body.innerHTML = ""
    const modal_footer = scc_one_modal.querySelector(".modal-footer")
    modal_footer.innerHTML = ""

    const cancel_button = get_cl_element("button", "btn btn-tertiary", null,
        document.createTextNode("Cancel"))
    cancel_button.setAttribute("type", "button")
    cancel_button.setAttribute("data-bs-dismiss", "modal")
    const add_btn = get_cl_element("button", "btn btn-primary ml-auto", null,
        document.createTextNode(btn_text))
    add_btn.setAttribute("type", "button")

    modal_footer.appendChild(cancel_button)
    modal_footer.appendChild(add_btn)

    return [modal_body, add_btn]
}

function get_addModel_row(div_id,label_text,id,input_type,options = [],placeholder_text = '',icon_class = '',input_typ = 'text'){
    let inputDiv;
    const main_div = get_cl_element("div","row row-header align-items-center mb-4",div_id)
    let label = get_cl_element("div", "col-12 col-sm-4 align-self-center",null,        get_cl_element("label","my-2",null,document.createTextNode(label_text)));
    inputDiv = get_cl_element("div", "col-12 col-sm")
    if (input_type=='select'){
        const input_el = get_cl_element("select", "form-select", id)
        if(options.includes('Default') || options.length==0){
            input_el.appendChild(get_cl_element("option", null, null, document.createTextNode('Default')))
        }
        
        for (let mtype of options) {
            if (mtype!='Default'){
                let opt = get_cl_element("option", null, null, document.createTextNode(mtype))
                input_el.appendChild(opt)
            }            
        }
        if(input_el.firstChild){
            input_el.firstChild.setAttribute("selected", "")
            inputDiv.appendChild(input_el)
        }
       
    }else{
        const input_el = get_cl_element("div", "input-group", null, get_cl_element("input", "form-control",id))
        input_el.firstChild.setAttribute("type", input_typ)
        input_el.firstChild.setAttribute("placeholder", placeholder_text)
        if(icon_class.trim() != ''){
            input_el.appendChild(get_cl_element("span", "input-group-text", null, get_cl_element("span", icon_class)))
        }        
        inputDiv.appendChild(input_el)
    }
    main_div.appendChild(label);
    main_div.appendChild(inputDiv);            
    
    return main_div 
}

function get_newModel_modal (header,anotherModal = false) {  
    const [modal_body, add_btn] = populate_modal(header, "Add")
    const form_div = get_cl_element("div", "form-group")
    
    form_div.appendChild(get_addModel_row('name_div','Model Name','db_name','normal',[],'',"fas fa-database"))
    
    if(anotherModal){
        form_div.appendChild(get_addModel_row('path_div','Model Path','db_path','normal'))
    }
    else{
        form_div.appendChild(get_addModel_row('template_div','Model Template','model_template','select',
            Object.keys(sqlScripts)))
    }       
    

    modal_body.appendChild(form_div)

    
    add_btn.onclick = async function (e) {
        const model_name = document.getElementById('db_name').value
        if (model_name.trim() == "" || !valid_string(model_name)) {
            confirmBox("Alert!", "Please enter valid model name")
            return
        }

        for (let cn of document.getElementById("availableModal").querySelectorAll("li")){
            if(model_name.trim()==cn.innerText){
                confirmBox("Alert!", `Model already active with same name ${model_name}`)
                return
            }
        }

        let template_el = document.getElementById('model_template')
        let model_template = 'Sample DB'
       
        if (template_el){
            model_template = template_el.value
        }
        
        let project_name = 'Default'

        const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
        bs_modal.hide()
        
        
        let data = {
            model_name: model_name,
            model_template: model_template,
            project_name: project_name,
            db_user: '',
            password : '',
            host:'',
            port:0,
            db_type:'SQLITE'
        }

        const res = await fetchData('home','addNewModel',data)

        if (res.msg === 'Success'){
            let model_body = document.getElementById("availableModal")
            model_body.appendChild(get_li_element([model_name, model_template, project_name,'SQLITE']))
            model_body.lastChild.click()
            confirmBox("Success!", "New Model added")
        }else{
            confirmBox("Alert!", res.msg)
        }
    }

    
}

async function addExistingModel() {
    const [modal_body, add_btn] = populate_modal("Add Existing Models", "Add")
    const temp_dict = new Object

    
    const data = await fetchData('home','getExistingModels')
    let model_dict = new Object
    for (let cn of data) {
        let project_name = cn[1]
        let model_name = cn[0]
        temp_dict[model_name] = [project_name, cn[2],cn[3]]
        if (project_name in model_dict) {
            model_dict[project_name].push([model_name,cn[2]])
        } else {
            model_dict[project_name] = [[model_name,cn[2]]]
        }
    }
    modal_body.appendChild(get_scc_tree(model_dict))


    add_btn.onclick = async function () {
        let model_names = []
        for (let cn of document.getElementById("availableModal").querySelectorAll("li")){
            model_names.push(cn.innerText)
        }
        let projects_dict = {}
        let model_list = []
        for (let cn of modal_body.querySelectorAll(".TreeMembers li")) {
            if (cn.parentNode.classList.contains("childList")) {
                if (cn.firstChild.checked) {
                    if (model_names.includes(cn.innerText)){
                        confirmBox('Alert!',`Model Already Active with name ${cn.innerText}`)
                        return
                    }
                    
                    let project_name = cn.parentNode.previousElementSibling.innerText
                    if(!(project_name in projects_dict)){
                        projects_dict[project_name] = []
                    }
                    projects_dict[project_name].push(cn.innerText)
                    if (model_list.includes(cn.innerText)){
                        confirmBox('Alert!',"You Cannot Add more than one model of same name")
                        return
                    }
                    model_list.push(cn.innerText)
                   
                }
            }
        }
        
        if (Object.keys(projects_dict).length > 0) {
            const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
            bs_modal.hide()
            
            const data = await fetchData('home','addExistingModels',{ model_list: model_list,projects_dict:projects_dict })
            let model_body = document.getElementById("availableModal")
            for (let model_name of model_list) {
                model_body.appendChild(get_li_element([model_name, temp_dict[model_name][1],
                    temp_dict[model_name][0],temp_dict[model_name][2]]))
            }
        } else {
            const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
            bs_modal.hide()

        }
    }
}

function remove_modal (del_btn) {
    let cancel_text = "Hide"
    let header_text = "Hide Models"
    if(del_btn){
        cancel_text = "Delete"
        header_text = "Delete Models"
    }

    const [modal_body, add_btn] = populate_modal(header_text, cancel_text)
    let model_dict = new Object
    for (let cn of document.getElementById("availableModal").childNodes) {
        let project_name = cn.getAttribute("project")
        let template_name = cn.getAttribute("template")
        let model_name = cn.innerText
        if (project_name in model_dict) {
            model_dict[project_name].push([model_name,template_name])
        } else {
            model_dict[project_name] = [[model_name,template_name]]
        }
    }
    modal_body.appendChild(get_scc_tree(model_dict))
    
    add_btn.onclick = async function () {
        let model_list = []
        let projects_dict = {}
        for (let cn of modal_body.querySelectorAll(".TreeMembers li")) {
            if (cn.parentNode.classList.contains("childList")) {
                if (cn.firstChild.checked) {
                    model_list.push(cn.innerText)
                    let project_name = cn.parentNode.previousElementSibling.innerText
                    if(!(project_name in projects_dict)){
                        projects_dict[project_name] = []
                    }
                    projects_dict[project_name].push(cn.innerText)   
                }
            }          
        }

        if (Object.keys(projects_dict).length > 0) {
            const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
            bs_modal.hide()
            
            const data = await fetchData('home','deleteModel',{
                projects_dict:projects_dict,
                del_opt: del_btn,
            })
           
            let modals = document.getElementById('availableModal')
            for (let cn of modals.querySelectorAll("li")) {
                if (model_list.indexOf(cn.innerText) > -1) {
                    cn.remove()                        
                }
            }
            
            if (modals.firstChild){
                modals.firstChild.click()
            }else{
                document.getElementById("tableGroup").innerHTML = ""
            }
            confirmBox("Success!", "Model removed successfully")
            
        } else {
            confirmBox("Alert!", "Please select atleast one model")
        }
    }
}

function saveAsModel(e) {
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }
    if (selected_model.getAttribute("dbtype")!="SQLITE"){
        confirmBox("Alert!", "Method is applicable only for SQLITE type models")
        return
    }
    else
    {
        const model_name = selected_model.innerText
        const selected_project_name = selected_model.getAttribute("project")
        const selected_project_template = selected_model.getAttribute("template")
        const model_type = selected_model.getAttribute("dbtype")

        const [modal_body, add_btn] = populate_modal("Save As", "Save")
        const form_div = get_cl_element("div", "form-group mb-4")
        
        form_div.appendChild(get_addModel_row('new_modelName_div','New Model Name','new_model_name','normal',[],'','fas fa-database'))

        modal_body.appendChild(form_div)

        add_btn.onclick =async function (e) {
            const new_model_name = document.getElementById('new_model_name').value
            if (new_model_name.trim() == "" || !valid_string(new_model_name)) {
                confirmBox("Alert!", "Please enter valid model name")
                return
            }

            for (let cn of document.getElementById("availableModal").querySelectorAll("li")){
                if(new_model_name.trim()==cn.innerText){
                    confirmBox("Alert!", `Model already active with same name ${new_model_name}`)
                    return
                }
            }
            
            const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
            bs_modal.hide()
            
            const data = await fetchData('home','saveAsModel',{
                     new_model_name: new_model_name,
                     new_model_template: selected_project_template,
                     project_name: selected_project_name,
                     model_name: model_name
                 })
            if (data['message'].indexOf('Invalid') > -1) {
                confirmBox('Alert', data['message'])
                return
            }
            
            let model_body = document.getElementById("availableModal")
            model_body.appendChild(get_li_element([new_model_name, selected_project_template, selected_project_name,model_type]))
            model_body.lastChild.click()
            confirmBox("Success!", "Save As Model added")
        }
    }
}

// ----------------------------------------------------------------------------------------------------

function uplaodModel(e) {
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }
    
        const model_name = selected_model.innerText
        const template = selected_model.getAttribute("template")
        const [modal_body, add_btn] = populate_modal("Restore Model", "Upload")
        const input_div = get_cl_element("input", "form-control")
        const form_div = get_cl_element("div", "input-group", null, input_div)

        input_div.setAttribute("type", "file")
        input_div.setAttribute("accept", ".db, .sqlite3")

        modal_body.appendChild(form_div)

        add_btn.onclick = async function (e) {
            if (input_div.files[0]){
                add_btn.setAttribute("disabled", "")
                add_btn.innerHTML = `<span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>`
                
                const data = await uploadFile('home','uploadModel',input_div.files[0],{ model_name: model_name })
                input_div.value = null
                add_btn.removeAttribute("disabled", "")
                add_btn.innerHTML = "Upload"
                const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
                bs_modal.hide()
                confirmBox("Success!", "Model uploaded successfully")
                get_model_tables(model_name,template)
            }else{
                confirmBox("Alert!", "Please choose a model") 
            }
        }
}   

async function downloadModel(e) {
    let loader = document.getElementById('data-loader')
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }
    const model_name = selected_model.innerText
    const projectName = selected_model.getAttribute('project')
    loader.style.display = ""
    
    await fetchData('home','downloadModel',{ model_name: model_name,project_name:projectName })
    loader.style.display = "none"

}

function uploadExcelFile(e) {
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }
    const model_name = selected_model.innerText

    const [modal_body, add_btn] = populate_modal("Upload Excel", "Upload")
    const input_div = get_cl_element("input", "form-control")
    const form_div = get_cl_element("div", "input-group", null, input_div)

    input_div.setAttribute("type", "file")
    input_div.setAttribute("accept", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    modal_body.appendChild(form_div)

    add_btn.onclick = async function (e) {
        selectedFile = input_div.files[0]
        if(selectedFile){
            add_btn.setAttribute("disabled", "")
            add_btn.innerHTML = `<span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>`    
            
            excelUploadInfo = {}
            const excelInfo = await get_uploadExcel_info(model_name, [], selectedFile)
            excelUploadInfo = excelInfo


            bootstrap.Modal.getInstance(document.getElementById('scc-one-modal')).hide()
            const bs_modal = new bootstrap.Modal(document.getElementById('modal-uploadExcel-info'))
            bs_modal.show()
            input_div.value = null
            add_btn.innerHTML = "Upload"
            add_btn.removeAttribute("disabled", "")
        }else{
            confirmBox("Alert!", "Please choose a file")
        }
        
    }
}

document.getElementById('modal-uploadExcel-info').addEventListener('show.bs.modal',function(){
    const body_el = this.querySelector('.modal-body')
    body_el.innerHTML = ''

    const header_row = get_cl_element("tr")
    const form_div = get_cl_element("div", "form-group", null,
        get_cl_element("table", "table table-bordered table-sm", null,
            get_cl_element("thead", null, null, header_row)))

    form_div.style.maxHeight = "300px"
    form_div.style.overflowY = "auto"

    header_row.appendChild(get_cl_element("td", 'text-center', null,get_cl_element('h6','m-0',null,document.createTextNode('Sheet Name'))))
    header_row.appendChild(get_cl_element("td", 'text-center', null,get_cl_element('h6','m-0',null,document.createTextNode('Upload Option'))))
    const tbody = get_cl_element("tbody")
    form_div.firstChild.appendChild(tbody)
    body_el.appendChild(form_div)
    for (let filename in excelUploadInfo){
       
        let tr = get_cl_element("tr",'')
        tr.appendChild(get_cl_element("td", null, null, document.createTextNode(filename)))        
    
        const select = get_cl_element('select','form-select');
        select.style = 'line-height:1 !important;'
    
        const existOptions = [
        { value: 'purgeAndUpload', text: 'Purge and Upload' },
        { value: 'createAndUpload', text: 'Drop Table and Upload' },
        { value: 'ignore', text: 'Ignore' }
        ];
    
        const newOptions = [
            { value: 'ignore', text: 'Ignore' },
            { value: 'createAndUpload', text: 'Create and Upload' }
        ]

        if (excelUploadInfo[filename][0] === 'New'){
            newOptions.forEach(optionData => {
                const option = get_cl_element('option');
                option.value = optionData.value;
                option.textContent = optionData.text;
                select.appendChild(option);
            });
        }else{
            existOptions.forEach(optionData => {
                
                const option = document.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.text;
                if (optionData.value == 'ignore' && excelUploadInfo[filename][1] != 'Input'){
                    option.setAttribute('Selected','')
                }
                select.appendChild(option);
            });
        }
        let td = get_cl_element("td", 'text-center', null, select)
        
        tr.appendChild(td)
        tbody.appendChild(tr)
    
    }

})

document.getElementById('saveFileName').onclick =async function(){
    this.setAttribute("disabled", "")
    this.innerHTML = `<span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>`
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    const model_name = selected_model.innerText
    const template = selected_model.getAttribute("template")
    const body_el = document.getElementById('modal-uploadExcel-info').querySelector('tbody')
    const uploadInfo = {}
    for (let tr of body_el.querySelectorAll('tr')){
        const label = tr.firstElementChild.innerText
        const selectVal = tr.querySelector('select').value
        uploadInfo[label] = selectVal
    }

    const data = await uploadExcel(model_name, Object.keys(uploadInfo), selectedFile,uploadInfo)

    bootstrap.Modal.getInstance(document.getElementById('modal-uploadExcel-info')).hide() 
    confirmBox("Success!", "Excel uploaded successfully")
    update_excel_log(data,uploadInfo)
    get_model_tables(model_name,template)
    this.innerText = 'Upload'
    this.removeAttribute('disabled')
}

function update_excel_log(rows,uploadInfo) {
    const [modal_body, add_btn] = populate_modal("Status", "OK")
    const header_row = get_cl_element("tr", null, null,
        get_cl_element("td", null, null, document.createTextNode("SheetName")))
    const form_div = get_cl_element("div", "form-group mb-4", null,
        get_cl_element("table", "table table-bordered table-sm", null,
            get_cl_element("thead", null, null, header_row)))
    form_div.style.maxHeight = "300px"
    form_div.style.overflowY = "auto"
    form_div.style.overflowX = "auto"
    header_row.appendChild(get_cl_element("td", null, null, document.createTextNode("Status")))
    header_row.appendChild(get_cl_element("td", null, null, document.createTextNode("Msg")))
    const tbody = get_cl_element("tbody")
    form_div.firstChild.appendChild(tbody)
    for (let rw in rows) {
        let tr = get_cl_element("tr")
        tr.appendChild(get_cl_element("td", null, null, document.createTextNode(rw)))
        let status
        let message
        if (!isNaN(rows[rw]) && uploadInfo[rw]=='createAndUpload') {
            status = "Create And Uploaded"
            message = `${rows[rw]} rows inserted`
        }else if(!isNaN(rows[rw] && uploadInfo[rw] == 'purgeAndUpload')){
            status = "Purge And Uploaded"
            message = `${rows[rw]} rows inserted`
        }
         else {
            status = "Errored"
            message = rows[rw]
        }
        tr.appendChild(get_cl_element("td", null, null, document.createTextNode(status)))
        tr.appendChild(get_cl_element("td", null, null, document.createTextNode(message)))
        tbody.appendChild(tr)
    }
    modal_body.appendChild(form_div)
    new bootstrap.Modal(document.getElementById('scc-one-modal')).show()

    add_btn.onclick = function () {
        const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
        bs_modal.hide()
    }
}

function downloadExcelFile(e) {
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }

    const table_groups = []

    for (let el of document.getElementById("tableGroup").querySelectorAll("button.accordion-button")) {
        table_groups.push(el.innerText)
    }

    const model_name = selected_model.innerText
    const [modal_body, add_btn] = populate_modal("Download Excel", "Download")
    const input_div = get_cl_element("input", "form-check-input round-check")
    const form_div = get_cl_element("div", "form-check", null, input_div)
    input_div.setAttribute("type", "checkbox")
    input_div.checked = true
    form_div.appendChild(get_cl_element("label", "form-check-label",
        null, document.createTextNode("Input Tables Only")))

    for (let group_name of table_groups) {
        let form_div1 = form_div.cloneNode(true)
        form_div1.lastChild.innerText = group_name
        modal_body.appendChild(form_div1)
    }


    add_btn.onclick = async function (e) {
        let table_groups = []
        for (let el of modal_body.querySelectorAll("input:checked")) {
            table_groups.push(el.parentNode.lastChild.innerText)
        }
        const bs_modal = bootstrap.Modal.getInstance(scc_one_modal)
        bs_modal.hide()

        let loader = document.getElementById("dl_progress_div")

        loader.querySelector('div').innerText = 'Downloading'
        loader.style.display = ""
        
        const x = await downloadExcel(model_name,[], table_groups)

        loader.querySelector('div').innerText = 'Running'        
        loader.style.display = "none"

    }
}

async function vacuumModel(e) {
    let loader = document.getElementById('data-loader')
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }
    const model_name = selected_model.innerText
    
    loader.style.display = ""
    const x = await executeQuery('executeQuery',model_name,'VACUUM')
    loader.style.display = "none"
    confirmBox("Success!", "Model vacuumed successfully")
}

async function create_view(){
    const view_name = document.getElementById("viewName").value
    const view_query = document.getElementById("query-input").value
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue").innerText
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }
    if (view_name.trim() == "" || view_query.trim()==""){
        confirmBox("Alert!","Please make sure that View Name and Query was entered")
    }
   
    await fetchData('home','checkOrCreateView',{view_name:view_name,view_query:view_query,model_name:selected_model,isExist:false})
    const bs_modal = bootstrap.Modal.getInstance(document.getElementById("modal-createView"))
    bs_modal.hide()
    confirmBox("Success","View created successfully")
    get_model_tables(selected_model,null)
}

function get_dropdown_item(itm_name, lov_div,inp_id){
    const input = document.getElementById(inp_id) 
    let el = get_cl_element("a", "dropdown-item", null,
                    get_cl_element("input", "form-check-input", null, null))
    el.firstChild.setAttribute("type", "checkbox")
    if (selected.length > 0) {
        if(itm_name!==null){
            if (selected.indexOf(itm_name.toString().trim()) > -1) {
                el.firstChild.checked = true
            }
        }else if (selected.indexOf("null") > -1) {
            el.firstChild.checked = true
        }
    } 
    else {
        input.value = "All"
        el.firstChild.checked = true
    }        
    el.appendChild(get_cl_element("label", "form-check-label pl-2", null,
        document.createTextNode(itm_name)))
    el.firstChild.onchange= function (e) {
        if (!el.firstChild.checked && lov_div.parentNode.querySelector("input").checked) {
            lov_div.parentNode.querySelector("input").checked = false
        } else if (el.firstChild.checked && !lov_div.parentNode.querySelector("input").checked) {
            const ct = lov_div.querySelectorAll("input:checked").length
            const total_len = lov_div.querySelectorAll("div.lov-values input").length
            if (ct == total_len) {
                input.value = "All"
                lov_div.parentNode.querySelector("input").checked = true
            }
        }
    }
    return el
}

const not_eq_list = function (a, b) {
    if (a.length !== b.length) return true;
    for (let ax of a) {
        if (b.indexOf(ax) == -1) return true;
    }
    return false
}

function get_multiselect_dropdown(el,members,inp_id){
    const input = document.getElementById(inp_id) 
    const form_div = get_cl_element("form")
    const dropdown = get_cl_element("a", "dropdown-item", null,
                get_cl_element("input", "form-check-input", null, null))
    form_div.appendChild(dropdown)
    dropdown.appendChild(get_cl_element("label", "form-check-label pl-2", null,
            document.createTextNode("Select All")))
    
    dropdown.querySelector("input").setAttribute("type", "checkbox")
    form_div.appendChild(get_cl_element("div", "dropdown-divider"))
    let lov_div = get_cl_element("div", "lov-values")
    lov_div.setAttribute("level_name", "any")
    lov_div.style = "max-height:22vh;overflow-y:auto;"
    form_div.appendChild(lov_div)
    form_div.appendChild(get_cl_element("div", "dropdown-divider"))
    const inp_tag = dropdown.querySelector("input")
    inp_tag.onchange= function (e) {
        if (inp_tag.checked) {
            input.value = "All"
            for (let cn of lov_div.querySelectorAll("input")) {
                if (!cn.checked) {
                    cn.checked = true
                }
            }
        } else {
            for (let cn of lov_div.querySelectorAll("input")) {
                if (cn.checked) {
                    cn.checked = false
                }
            }
        }
    }
    const prim_button = get_cl_element("button", "btn btn-sm btn-primary w-100", 'dropdown_ok',
        document.createTextNode("OK"))
    form_div.appendChild(get_cl_element("div", "px-2 py-2 d-flex flex-row justify-content-between", 
                                            null,prim_button))

    prim_button.setAttribute("type", "button")
    prim_button.addEventListener("mousedown", function () {
        setTimeout(function () {
            let z = new bootstrap.Dropdown(el)
            z.toggle()            
        }, 200);
        const selected_mem = []
        input.value = ""
        for (let cn of lov_div.querySelectorAll("input")) {
            if(!inp_tag.checked){
                if (cn.checked) {
                    if(input.value.trim() == ""){
                        input.value = cn.nextElementSibling.innerText
                    }else{
                        input.value = input.value+" , "+cn.nextElementSibling.innerText
                    }                                  
                    selected_mem.push(cn.nextElementSibling.innerText)
                } 
            }else{
                input.value = "All"
            }  
        }
        if (not_eq_list(selected, selected_mem)) {
            selected = selected_mem
        }

    })
    if (!(selected.length>0)) {
        selected = []
        lov_div.parentNode.querySelector("input").checked = true
    }

    for (let val of members) {
        let cn = get_dropdown_item(val[0], lov_div,inp_id)
        if (val.length==2){
            cn.setAttribute("username",val[1])
        }
        lov_div.appendChild(cn)
    }
    return form_div
}

function valid_string(string) {
    var pattern = /^[a-zA-Z0-9_]+$/;
    return pattern.test(string);
}

function displayOutput(stderr) {
    const outputContainer = document.getElementById('outputTxt');  
    if (stderr) {
        const errorElement = document.createElement('div');
        errorElement.textContent = `Error: ${stderr}`;
        errorElement.style.color = 'red';
        outputContainer.appendChild(errorElement);
    }  
}

async function populateExecutableFiles(modelName){
    const fileDiv = document.getElementById('taskDiv')
    fileDiv.innerHTML = ""
    let query = `SELECT TaskId,TaskName,TaskDisplayName FROM S_TaskMaster`
    const files = await executeQuery('fetchData',modelName,query)
    for (const [TaskId,TaskName,TaskDisplayName] of files){

        const li_el  =get_cl_element('li',null,null,get_cl_element('a','dropdown-item',null,document.createTextNode(TaskDisplayName)))

        li_el.onclick =async function(){
            const canvas = document.getElementById('myCanvas');
            document.getElementById("loadingOverlay").classList.remove("hidden");
            document.getElementById("outputDiv").style.display = ""
            document.getElementById('outputTxt').innerHTML = ""
            imgBlob = null
            
            const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
            const proj_name = selected_model.getAttribute('project')

            let filesQuery = `SELECT FilePath,FileData,FileName FROM S_ExecutionFiles WHERE FileName IS NOT NULL AND Status = 'Active' `
            const execFiles = await executeQuery("fetchData",selected_model.innerText, filesQuery)
            let fileContent = null
            execFiles.forEach(rw => {
                if (rw[0] === TaskName) {
                    fileContent = rw[1]
                }
            });

            const blobQuery = `SELECT FileName,FileBlob FROM S_DataFiles WHERE FileType = 'Input'`
            const blobFiles = await executeQuery("fetchData",selected_model.innerText, blobQuery)

            const wheelQuery = `SELECT WheelName,WheelBlob FROM S_PackageWheels`
            const wheelFiles = await executeQuery("fetchData",selected_model.innerText, wheelQuery)           

            let query = `UPDATE S_Taskmaster SET TaskLastRunDate = ? WHERE TaskId = ? `
            const result = await executeQuery('updateData',selected_model.innerText,query,[get_current_datetime(),TaskId]);

            const task_id = await update_task(TaskName,'Started',null,null,TaskId)
            let res = await executePython('executeScript','editor',fileContent,proj_name,selected_model.innerText,execFiles,null,blobFiles,wheelFiles)
            
            if (res.stderr){
                update_task(TaskName,'Errored',res.stderr,task_id)
            }else{
                if (res.blob){
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    imgBlob = res.blob
                    const imageBitmap = await createImageBitmap(res.blob);
                    // Calculate the scale factor to fit the image within the canvas while maintaining the aspect ratio
                    const scale = Math.min(canvas.width / imageBitmap.width, canvas.height / imageBitmap.height);
                
                    // Calculate the top-left corner positions to center the image in the canvas
                    const x = (canvas.width - imageBitmap.width * scale) / 2;
                    const y = (canvas.height - imageBitmap.height * scale) / 2;
                
                    ctx.drawImage(imageBitmap, x, y,imageBitmap.width * scale, imageBitmap.height * scale);
                    new bootstrap.Modal(document.getElementById('modal-show-output')).show()
                  }
                update_task(TaskName,'Completed',null,task_id)
                if (res.outputFiles && res.outputFiles.length > 0){
                    const delQuery = `DELETE FROM S_DataFiles WHERE FileType = 'Output'`
                    await executeQuery('deleteData',selected_model.innerText,delQuery)

                    res.outputFiles.forEach(async ([filename, fileBlob]) => {
                      let query = `INSERT INTO S_DataFiles (FileName,FileType,FileBlob) 
                                            VALUES (?, ?, ?) ON CONFLICT (FileName,FileType) DO UPDATE SET FileBlob = ? `
                      await executeQuery('insertData',selected_model.innerText,query,[filename,'Output',fileBlob,fileBlob])
                    });
                }
            }
            document.getElementById("loadingOverlay").classList.add("hidden");
            
            displayOutput(res.stderr)
            
        }
        fileDiv.appendChild(li_el)
    }
}

function get_current_datetime(){
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are zero-based, so add 1
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return formattedDateTime
}

async function update_task(taskName,taskStatus,msg = null,assignedTaskId = null,taskId = null){
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    
    if (!assignedTaskId){
        let query = `INSERT INTO T_TaskLogs (TaskId,TaskName,TaskStatus,EndDate) VALUES (?, ?, ?, datetime('now', 'localtime'))`
        const res = await executeQuery('insertData',selected_model.innerText,query,[taskId,taskName,taskStatus])
        return res
    }else{
        let query = `UPDATE T_TaskLogs SET TaskStatus = ?,ErrorMsg = ?, EndDate = datetime('now', 'localtime')
                     WHERE TaskName = ? AND Id = ? `
        const result = await executeQuery('updateData',selected_model.innerText,query,[taskStatus,msg,taskName,assignedTaskId])
    }
}

async function saveFiles(){
    this.setAttribute("disabled", "")
    this.innerHTML = `<span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>`            
    
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    const inp_el = document.getElementById('inpFiles')

    if (inp_el.files.length > 0){
        const delQuery = `DELETE FROM S_DataFiles;`
        await executeQuery('executeQuery',selected_model.innerText,delQuery,['script'])

        for (const file of inp_el.files) {
            const arrayBuffer = await file.arrayBuffer();
            let query = `INSERT INTO S_DataFiles (FileName,FileType,FileBlob) 
                            VALUES (?, ?, ?) ON CONFLICT (FileName,FileType) DO UPDATE SET FileBlob = ? `
            await executeQuery('insertData',selected_model.innerText,query,[file.name,'Input',new Uint8Array(arrayBuffer),new Uint8Array(arrayBuffer)])
        }

        this.removeAttribute("disabled", "")
        this.innerHTML = "Upload"
        bootstrap.Modal.getInstance(document.getElementById('modal-upload-files')).hide()
        confirmBox('Success','Files Upload Successfully.')
    }

    inp_el.value = null
}

async function populateInputFiles(){
    const body_el = document.getElementById('modal-input-files').querySelector('.modal-body')
    body_el.innerHTML = ''

    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")

    const query = `SELECT FileId,FileName FROM S_DataFiles WHERE FileType = 'Input' `
    const files = await executeQuery('fetchData',selected_model.innerText,query)

    const header_row = get_cl_element("tr")
    const form_div = get_cl_element("div", "form-group", null,
        get_cl_element("table", "table table-bordered table-sm", null,
            get_cl_element("thead", null, null, header_row)))

    form_div.style.maxHeight = "300px"
    form_div.style.overflowY = "auto"

   
    const tbody = get_cl_element("tbody")
    form_div.firstChild.appendChild(tbody)
    body_el.appendChild(form_div)


    for (let file of files){
        const tr = get_cl_element("tr",'d-flex align-items-center')
        tr.appendChild(get_cl_element("td", 'w-100', null, document.createTextNode(file[1])))

        const del_td = get_cl_element("td","input-file-icon m-0 px-2")
        let del_el = get_cl_element('span','fa fa-trash')
        del_el.onclick = delInputFile.bind(null,file[1],file[0])
        del_td.appendChild(del_el)

        const download_td = get_cl_element("td","input-file-icon m-0 px-2")
        let download_el = get_cl_element('span','fa fa-download')
        download_el.onclick = downloadInputFile.bind(null,file[1],file[0])
        download_td.appendChild(download_el)

        const upload_td = get_cl_element("td","input-file-icon m-0 px-2")
        let upload_el = get_cl_element('span','fa fa-upload')
        upload_el.onclick = uploadInputFile.bind(null,file[1],file[0])
        upload_td.appendChild(upload_el)

        tr.appendChild(del_td)
        tr.appendChild(upload_td)
        tr.appendChild(download_td)

        tbody.appendChild(tr)
    }   

    const btn_div = get_cl_element('div','d-flex justify-content-end')
    let btn_el = get_cl_element('button','btn btn-primary',null,document.createTextNode('Add File'))
    btn_div.appendChild(btn_el)
    body_el.appendChild(btn_div)

    btn_el.onclick = uploadInputFile

}

async function populateOutputFiles(){
    const body_el = document.getElementById('modal-input-files').querySelector('.modal-body')
    body_el.innerHTML = ''

    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")

    const query = `SELECT FileId,FileName FROM S_DataFiles WHERE FileType = 'Output' `
    const files = await executeQuery('fetchData',selected_model.innerText,query)

    const header_row = get_cl_element("tr")
    const form_div = get_cl_element("div", "form-group", null,
        get_cl_element("table", "table table-bordered table-sm", null,
            get_cl_element("thead", null, null, header_row)))

    form_div.style.maxHeight = "300px"
    form_div.style.overflowY = "auto"

   
    const tbody = get_cl_element("tbody")
    form_div.firstChild.appendChild(tbody)
    body_el.appendChild(form_div)


    for (let file of files){
        const tr = get_cl_element("tr",'d-flex align-items-center')
        tr.appendChild(get_cl_element("td", 'w-100', null, document.createTextNode(file[1])))

        const download_td = get_cl_element("td","input-file-icon m-0 px-2")
        let download_el = get_cl_element('span','fa fa-download')
        download_el.onclick = downloadInputFile.bind(null,file[1],file[0])
        download_td.appendChild(download_el)

        tr.appendChild(download_td)

        tbody.appendChild(tr)
    }   

}

async function delInputFile(fileName,fileId){
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    const query = `DELETE FROM S_DataFiles WHERE FileType = 'Input' AND FileId = ? AND FileName = ? `
    await executeQuery('deleteData',selected_model.innerText,query,[fileId,fileName])
    populateInputFiles()
}

async function downloadInputFile(fileName,fileId){
    let fileType = document.getElementById('modal-input-files').querySelector('h2').innerText.indexOf('Input') > -1?'Input':'Output'
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    let query = `SELECT FileName,FileBlob FROM S_DataFiles WHERE FileType = ? AND FileID = ? AND FileName = ?`
    const file = await executeQuery('fetchData',selected_model.innerText,query,[fileType,fileId,fileName])

    if (file){
        const fileBlob = new Blob([file[0][1]]);

        // IE doesn't allow using a blob object directly as link href
        // instead it is necessary to use msSaveOrOpenBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(fileBlob);
            return;
        }

        // For other browsers: 
        // Create a link pointing to the ObjectURL containing the blob.
        const data = window.URL.createObjectURL(fileBlob);
        var link = document.createElement('a');
        link.href = data;
        link.download = fileName;
        link.click();
        setTimeout(function () {
            // For Firefox it is necessary to delay revoking the ObjectURL
            window.URL.revokeObjectURL(data);
        }, 1000);
    }else{
        confirmBox('Alert!','No File Exists')
    }
}

function uploadInputFile(fileName = null,fileId = null){
    bootstrap.Modal.getInstance(document.getElementById('modal-input-files')).hide()
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    
    const [modal_body, add_btn] = populate_modal("Upload Excel", "Upload")
    const input_div = get_cl_element("input", "form-control")
    const form_div = get_cl_element("div", "input-group", null, input_div)

    input_div.setAttribute("type", "file")
    modal_body.appendChild(form_div)

    add_btn.onclick = async function (e) {
        if(input_div.files[0]){
            add_btn.setAttribute("disabled", "")
            add_btn.innerHTML = `<span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>`    
            
            const arrayBuffer = await input_div.files[0].arrayBuffer();

            if (fileName && fileId){
                let query = `UPDATE S_DataFiles SET FileBlob = ? WHERE FileType = 'Input' AND FileName = ? AND FileId = ? `
                await executeQuery('updateData',selected_model.innerText,query,[input_div.files[0].name,new Uint8Array(arrayBuffer),fileName,fileId])
            }else{
                let query = `INSERT INTO S_DataFiles (FileName,FileType,FileBlob) VALUES (?, ?, ?) ON CONFLICT (FileName,FileType) DO UPDATE SET FileBlob = ?`
                await executeQuery('insertData',selected_model.innerText,query,[input_div.files[0].name,'Input',new Uint8Array(arrayBuffer),new Uint8Array(arrayBuffer)])
            }

            bootstrap.Modal.getInstance(document.getElementById('scc-one-modal')).hide()
            new bootstrap.Modal(document.getElementById('modal-input-files')).show()
            input_div.value = null
            add_btn.innerHTML = "Upload"
            add_btn.removeAttribute("disabled", "")
            populateInputFiles()
        }else{
            confirmBox("Alert!", "Please choose a file")
        }
    }
    new bootstrap.Modal(document.getElementById('scc-one-modal')).show()
}

async function fetchFilesAndDownloadZip() {
    let fileType = document.getElementById('modal-input-files').querySelector('h2').innerText.indexOf('Input') > -1?'Input':'Output'
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    try {
      let query = `SELECT FileName,FileBlob FROM S_DataFiles WHERE FileType = ?`
      const files = await executeQuery('fetchData',selected_model.innerText,query,[fileType])
      
      if (!files || files.length === 0) {
        confirmBox('Alert!',"No files found to download.")
        return;
      }
  
      const zip = new JSZip();
  
      files.forEach(file => {
        zip.file(file[0], file[1]);
      });
  
      const zipBlob = await zip.generateAsync({ type: "blob" });
  
      const downloadLink = document.createElement("a");
      downloadLink.href = window.URL.createObjectURL(zipBlob);
      downloadLink.download = "InputFiles.zip";
      downloadLink.click();
  
      setTimeout(function () {
        // For Firefox it is necessary to delay revoking the ObjectURL
        window.URL.revokeObjectURL(downloadLink.href);
      }, 1000);
  
    } catch (error) {
      console.error("Error creating zip file for download:", error);
    }
}

async function uploadPackage(e) {
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model) {
        confirmBox("Alert!", "Please select a model")
        return
    }

    const [modal_body, add_btn] = populate_modal("Upload Package", "Upload")
    const input_div = get_cl_element("input", "form-control")
    const form_div = get_cl_element("div", "input-group", null, input_div)

    input_div.setAttribute("type", "file")
    input_div.setAttribute("accept", ".whl")
    modal_body.appendChild(form_div)

    add_btn.onclick = async function (e) {
        let selectedFile = input_div.files[0]
        if(selectedFile){
            add_btn.setAttribute("disabled", "")
            add_btn.innerHTML = `<span class="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>`    
            const arrayBuffer = await input_div.files[0].arrayBuffer();                
            try {
                let query = `INSERT INTO S_PackageWheels (WheelName,WheelBlob) VALUES (?, ?) ON CONFLICT (WheelName) DO UPDATE SET WheelBlob = ?`
                await executeQuery('insertData',selected_model.innerText,query,[input_div.files[0].name,new Uint8Array(arrayBuffer),new Uint8Array(arrayBuffer)])                        
                confirmBox('Success',"Package uploaded successfully!");
            } catch (error) {
                console.error("Error saving file:", error);
            }

            bootstrap.Modal.getInstance(document.getElementById('scc-one-modal')).hide()
            
            input_div.value = null
            add_btn.innerHTML = "Upload"
            add_btn.removeAttribute("disabled", "")
        }else{
            confirmBox("Alert!", "Please choose a file")
        }
        
    }
}

async function downloadOutput() {
    const downloadLink = document.createElement("a");
    downloadLink.href = window.URL.createObjectURL(imgBlob);
    downloadLink.download = "output.jpg";
    downloadLink.click();
  
    setTimeout(function () {
      window.URL.revokeObjectURL(downloadLink.href);
    }, 1000);  
}

document.getElementById("notebookBtn").onclick = function(){
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model){
        confirmBox("Alert!","Please select a model")
        return
    }
    const modelName = selected_model.innerText
    window.open(`./S_Notebook.html?modelName=${modelName}`);
}

document.getElementById("notebookJS").onclick = function(){
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model){
        confirmBox("Alert!","Please select a model")
        return
    }
    const modelName = selected_model.innerText
    window.open(`/javascriptNB.html?modelName=${modelName}`);
}

document.getElementById("sqlEditor").onclick = function(){
    const selected_model = document.getElementById("availableModal").querySelector("li.selectedValue")
    if (!selected_model){
        confirmBox("Alert!","Please select a model")
        return
    }
    const modelName = selected_model.innerText
    window.open(`./playground/client.html?modelName=${modelName}`);
}