import CodeMirror from "codemirror";
import 'codemirror/theme/dracula.css';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/r/r.js';
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/edit/matchbrackets.js";
import "codemirror/addon/comment/comment.js";
import { WebR } from "https://webr.r-wasm.org/latest/webr.mjs";
import { consoleNotebookOutput, get_cl_element, executeQuery } from '../../../assets/js/scc'
import { createCodeEditor } from "./script";

let canvas = null

export function createCodeMirrorEditor(kernelId, modelName, CellId, content,notebookId,blobFiles = []) {
    const cell = document.getElementById(kernelId);
    var editor = CodeMirror(cell.querySelector("div.computelite-text-editor"), {
        mode: "r",
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 4,
        indentUnit: 4,
        smartIndent: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        autofocus:true,
        extraKeys: {
            "Ctrl-/": "toggleComment",
            'Ctrl-Enter': async (cm) => executeCode(editor, cell, modelName, CellId,notebookId,blobFiles),
            "Shift-Enter": async (cm) => runAndMoveToNextCell(editor, cell, modelName, CellId, notebookId, blobFiles),
        },
    });

    editor.addKeyMap({
        'Backspace': function (cm) {
            const cursor = cm.getCursor();
            const line = cm.getLine(cursor.line);
            const indentUnit = cm.getOption('indentUnit');

            const leadingSpaces = line.slice(0, cursor.ch);
            if (/^\s*$/.test(leadingSpaces) && cursor.ch > 0) {
                const newCh = Math.max(0, cursor.ch - indentUnit);
                cm.setCursor({ line: cursor.line, ch: newCh });
            } else {
                cm.execCommand('delCharBefore');
            }
        },
    });
    cell.querySelector("button.cell-controls-button").onclick = function () {
        executeCode(editor, cell, modelName, CellId,notebookId,blobFiles)
    };

    setTimeout(() => {
        editor.refresh();
        if (content){
            editor.setValue(content)
        }
    }, 10);
    return editor
}

async function runAndMoveToNextCell(editor, cell, modelName, CellId, notebookId, blobFiles) {
    await executeCode(editor, cell, modelName, CellId, notebookId, blobFiles);
    const cells = document.querySelectorAll('computelite-cell')
    const isLastCell = cells[cells.length - 1] === cell;

    if (isLastCell) {
        const selected_li_el = document.getElementById('jsListDiv').querySelector("li.selectedValue");
        const notebookId = selected_li_el.getAttribute('id');

        if (!modelName) {
            confirmBox('Alert!', 'Model Name not found in the URL.');
            return;
        }

        try {
            const rowId = await executeQuery(
            "insertData",
            modelName,
            "INSERT INTO S_NotebookContent (CellContent, Name, NotebookId, CellType) VALUES (?, ?, ?, ?)",
            ['', selected_li_el.innerText, notebookId, 'r']
            );
            const newCellElement = createCodeEditor(rowId, notebookId, blobFiles);
            setTimeout(() => {
            const editors = document.querySelectorAll(".computelite-cell .CodeMirror");
            const lastEditor = editors[editors.length - 1];
            lastEditor?.CodeMirror?.focus();
            }, 50);
        } catch (err) {
            console.error("Failed to add new cell:", err);
        }
    } else {
        for (let i = 0; i < cells.length - 1; i++) {
            if (cells[i] === cell) {
            const nextEditor = cells[i + 1].querySelector(".CodeMirror");
            nextEditor?.CodeMirror?.focus();
            break;
            }
        }
    }
}

// Initialize WebR
async function initializeWebR(blobFiles) {
    if (!window.webr || window.webr.terminated) {
        window.webr = new WebR();
        await window.webr.init();
        await setupFileSystem()
        await writeInputFiles(blobFiles)
    }
}

async function executeCode(editor, cell, modelName, CellId,notebookId,blobFiles) {
    // Custom function triggered by Ctrl+Enter
    editor.getInputField().blur();
    const query = editor.getValue();
    cell.querySelector(".cell-bottom").innerHTML = "";
    if (cell.querySelector('.sidebar-inner')) {
        cell.querySelector('.sidebar-inner').innerHTML = '';
    }

    // Show Running
    const btn = cell.querySelector('span.fa-regular')
    if (btn?.classList.contains("fa-play-circle")) {
        btn.classList.replace("fa-play-circle", "fa-hourglass");
    }

    // Update the cell content in the database
    const updateQuery = `UPDATE S_NotebookContent SET CellContent = ? WHERE CellId = ? AND lower(CellType) = ? AND NotebookId = ?`
    await executeQuery('updateData', modelName, updateQuery, [query, CellId,'r',notebookId])

    const htmlOutput = get_cl_element("div");
    cell.querySelector('.cell-bottom').appendChild(htmlOutput);

    try {

        await initializeWebR(blobFiles);

        // Extract required packages
        const requiredPackages = extractRequiredPackages(query);
        await installMissingPackages(requiredPackages);

        const fsModelPath = `/home/web_user/data/${modelName}.sqlite3`;

        // Loading Database from OPFS
        await loadSQLiteFromOPFS(fsModelPath,modelName,'Default')
        await window.webr.evalR(`thisDB <- "${fsModelPath}"`);

        const shelter = await new window.webr.Shelter();
        const result = await shelter.captureR(query);
        shelter.purge();

        const updatedFile = await window.webr.FS.readFile(fsModelPath);
        await saveSQLiteToOPFS(modelName, 'Default', updatedFile);

        // Hide Running
        if (btn?.classList.contains("fa-hourglass")) {
            btn.classList.replace("fa-hourglass", "fa-play-circle");
        }

    
        // Process the result
        if (result !== undefined) {
            let output = result.output
            if (output.length > 0) {
                for (const item of output) {
                    if (item.type == "stdout"){
                        if (isHTML(item.data)) { // If it's an HTML element
                            let val = await convertResult('html', item.data)
                            htmlOutput.appendChild(val);
                            val.querySelectorAll('script[type|="text/javascript"]').forEach(e => {
                                if (e.textContent !== null) eval(e.textContent);
                            });
                        } else {
                            consoleROutput(cell, item.data)
                        }
                    }else if (item.type == "stderr"){
                        consoleNotebookOutput(cell, [`Execution Error: ${item.data}`], 'error');
                    }else{
                        consoleROutput(cell, item.data)
                    }
                };
            }

            if (result.images.length > 0) {
                const img = result.images[0];
                canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.style.width = "100%";
                canvas.style.height = "auto";
                
                canvas.getContext('2d').drawImage(img, 0, 0);
                htmlOutput.appendChild(canvas);
            }
            const outputFiles = await readDir('/home/web_user/outputDir');
            if (outputFiles.length > 0){
                await saveOutputFiles(modelName,outputFiles)
            }
        }
    } catch (error) {
        // Hide Running
        if (btn?.classList.contains("fa-hourglass")) {
            btn.classList.replace("fa-hourglass", "fa-play-circle");
        }
        if (error.message.includes("Syntax error")) {
            consoleNotebookOutput(cell, [`Syntax Error: ${error.message}`], 'error');
        } else {
            consoleNotebookOutput(cell, [`Execution Error: ${error.message}`], 'error');
        }
    }

}

// Function to check if a string is HTML
function isHTML(str) {
    const doc = new DOMParser().parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).some(node => node.nodeType === 1); // Checks if any element node exists
}


async function convertResult(display, value) {
    if (display === "html") {
        let div = get_cl_element("div", "rendered_html cell-output-html");
        div.appendChild(new DOMParser().parseFromString(value, "text/html").body.firstChild);
        return div;
    }
    return value;
}

function consoleROutput(cell, line) {
    let outputContainer = cell.querySelector('div.sidebar-inner');
    if (!outputContainer) {
        const outputInner = get_cl_element('computelite-output', null, null, get_cl_element('div', 'sidebar-inner px-4 py-2'))
        cell.querySelector('.cell-bottom').appendChild(outputInner);
        outputContainer = cell.querySelector('div.sidebar-inner');
    }

    if (line) {
        const lineElement = document.createElement('div');
        lineElement.textContent = line;
        lineElement.style.whiteSpace = "pre";
        outputContainer.appendChild(lineElement);
    }

}


function extractRequiredPackages(code) {
    const libraryRegex = /library\(["']?([\w\.]+)["']?\)/g;
    const requireRegex = /require\(["']?([\w\.]+)["']?\)/g;
    const doubleColonRegex = /([\w\.]+)::[\w\.]+/g;

    let packages = new Set();

    // Extract from library()
    let match;
    while ((match = libraryRegex.exec(code)) !== null) {
        packages.add(match[1]);
    }
    // Extract from require()
    while ((match = requireRegex.exec(code)) !== null) {
        packages.add(match[1]);
    }
    // Extract from ::
    while ((match = doubleColonRegex.exec(code)) !== null) {
        packages.add(match[1]);
    }

    return Array.from(packages);
}


async function installMissingPackages(packages) {
    let missingPackages = [];
    for (const pkg of packages) {
        const checkPkgCmd = `if (!requireNamespace("${pkg}", quietly = TRUE)) { cat("${pkg}") }`;
        const shelter = await new window.webr.Shelter();
        const result = await shelter.captureR(checkPkgCmd);
        shelter.purge();

        if (result?.output?.length > 0) {
            missingPackages.push(pkg);
        }
    }

    if (missingPackages.length > 0) {
        console.log("Installing missing packages:", missingPackages);
        const installCmd = `
            webr::shim_install()
            install.packages(c(${missingPackages.map(p => `"${p}"`).join(", ")}))
        `;
        const installShelter = await new window.webr.Shelter();
        await installShelter.captureR(installCmd);
        installShelter.purge();
    }
}


// -------------------------------------- 20 March Changes ---------------------------------------


async function loadSQLiteFromOPFS(modelPath,modelName,projectName) {
 
    let root = await navigator.storage.getDirectory();
    const dataFolder = await root.getDirectoryHandle('data', { create: true });
    const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: false });
    const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`)
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    window.webr.FS.writeFile(modelPath, uint8Array);
  }
  
  async function saveSQLiteToOPFS(modelName,projectName,file) {
    let root = await navigator.storage.getDirectory();
    const dataFolder = await root.getDirectoryHandle('data', { create: true });
    const projectFolder = await dataFolder.getDirectoryHandle(projectName, { create: false });
    const fileHandle = await projectFolder.getFileHandle(`${modelName}.sqlite3`,{ create: false })
    const writable = await fileHandle.createWritable();
  
    await writable.write(file);
    await writable.close();
  }
  
  async function setupFileSystem() {
    const inpDirPath = '/home/web_user/inputDir';
    const outDirPath = '/home/web_user/outputDir';
    const dataDirPath = '/home/web_user/data';
    await window.webr.evalR('inputDir <- "/home/web_user/inputDir"');
    await window.webr.evalR('outputDir <- "/home/web_user/outputDir"');
    await window.webr.FS.mkdir(inpDirPath);
    await window.webr.FS.mkdir(outDirPath);
    await window.webr.FS.mkdir(dataDirPath);
  }
  
  async function writeInputFiles(blobFiles) {
    for (let file of blobFiles) {
      await window.webr.FS.writeFile(`inputDir/${file[0]}`, file[1]);
    }
  } 

  async function readDir(dirPath) {
    let outputFiles = []
    try{
        const dir = await window.webr.FS.lookupPath(dirPath)
        for (const file in dir.contents){
            const filePath = `${dirPath}/${file}`
            let Path = await window.webr.FS.lookupPath(filePath)            
            if (!Path.isFolder){
                const fileData = await window.webr.FS.readFile(filePath)    
                const blob = await new Blob([fileData]).arrayBuffer();
                const uint8Array = new Uint8Array(blob);
                outputFiles.push([file,uint8Array])  
            }
        }        
    }catch{
        console.error('Some error occured while reading output file')
    }
    return outputFiles;
  }

  async function saveOutputFiles(modelName,outputFiles){
    const delQuery = `DELETE FROM S_DataFiles WHERE FileType = 'Output'`
    await executeQuery('deleteData',modelName,delQuery)

    outputFiles.forEach(async ([filename, fileBlob]) => {
    let query = `INSERT INTO S_DataFiles (FileName,FileType,FileBlob) 
                            VALUES (?, ?, ?) ON CONFLICT (FileName,FileType) DO UPDATE SET FileBlob = ? `
    await executeQuery('insertData',modelName,query,[filename,'Output',fileBlob,fileBlob])
    });
  }
  
  // -----------------------------------------------------------------------------------------------