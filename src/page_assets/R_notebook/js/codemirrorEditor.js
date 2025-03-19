import CodeMirror from "codemirror";
import 'codemirror/theme/dracula.css';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/r/r.js';
import { WebR } from "https://webr.r-wasm.org/latest/webr.mjs";
import { consoleNotebookOutput, get_cl_element, executeQuery } from '../../../assets/js/scc'

let canvas = null

export function createCodeMirrorEditor(kernelId, modelName, CellId, content) {
    const cell = document.getElementById(kernelId);
    var editor = CodeMirror(cell.querySelector("div.computelite-text-editor"), {
        lineNumbers: true,
        lineWrapping: true,
        mode: "r",
        autoRefresh: true,
        autofocus: true,
        tabSize: 4,
        indentUnit: 4,
        extraKeys: {
            'Ctrl-Enter': async (cm) => executeCode(editor, cell, modelName, CellId, kernelId),
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
        executeCode(editor, cell, modelName, CellId, kernelId)
    };

    setTimeout(() => {
        editor.refresh();
        editor.setValue(content)
    }, 10);
    return editor
}

// Initialize WebR
async function initializeWebR() {
    if (!window.webr || window.webr.terminated) {
        window.webr = new WebR();
        await window.webr.init();
    }
}

async function executeCode(editor, cell, modelName, CellId) {
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
    const updateQuery = `UPDATE S_RNotebook SET CellContent = ? WHERE CellId = ?`
    await executeQuery('updateData', modelName, updateQuery, [query, CellId])

    const htmlOutput = get_cl_element("div");
    cell.querySelector('.cell-bottom').appendChild(htmlOutput);

    try {

        await initializeWebR();

        const shelter = await new window.webr.Shelter();
        const result = await shelter.captureR(query);
        console.log('result for test', result)
        shelter.purge();

        // Hide Running
        if (btn?.classList.contains("fa-hourglass")) {
            btn.classList.replace("fa-hourglass", "fa-play-circle");
        }

        console.log('result', result)
        // Process the result
        if (result !== undefined) {
            let output = result.output
            if (output.length > 0) {
                for (const item of output) {
                    if (isHTML(item.data)) { // If it's an HTML element
                        let val = await convertResult('html', item.data)
                        console.log('html value', val)
                        htmlOutput.appendChild(val);
                        val.querySelectorAll('script[type|="text/javascript"]').forEach(e => {
                            if (e.textContent !== null) eval(e.textContent);
                        });
                    } else {
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
                console.log("Plot image drawn on canvas");
            }
        }
    } catch (error) {
        console.log('error', error)
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