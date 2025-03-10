import CodeMirror from "codemirror";
import 'codemirror/theme/dracula.css';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript.js';
import {consoleNotebookOutput, get_cl_element,executeQuery} from '../../../assets/js/scc'
import { JavascriptEvaluator } from "./eval";



export function createCodeMirrorEditor(kernelId, modelName, CellId, content) {
  const cell = document.getElementById(kernelId);
  const jsRunner = new JavascriptEvaluator();
  const editor = CodeMirror(cell.querySelector("div.computelite-text-editor"), {
    lineNumbers: true,
    lineWrapping: true,
    mode: "javascript",
    autoRefresh: true,
    autofocus: true,
    tabSize: 4,
    indentUnit: 4,
    extraKeys: {
      "Ctrl-Enter": async (cm) => executeCode(editor, cell, jsRunner, modelName, CellId),
    },
  });

  editor.addKeyMap({
    Backspace: function (cm) {
      handleBackspace(cm);
    },
  });

  setTimeout(() => {
    editor.refresh();
    editor.setValue(content);
  }, 10);

  cell.querySelector("button.cell-controls-button").onclick = function(){
    executeCode(editor, cell, jsRunner, modelName, CellId)
  }

  return editor;
}


async function executeCode(editor, cell, jsRunner, modelName, CellId) {
  editor.getInputField().blur();
  const query = editor.getValue();
  cell.querySelector(".cell-bottom").innerHTML = "";
  if (cell.querySelector('.sidebar-inner')){
    cell.querySelector('.sidebar-inner').innerHTML = '';
  }

  toggleRunningState(cell, true);

  await executeQuery("updateData", modelName, `UPDATE S_JsNotebook SET CellContent = ? WHERE CellId = ?`, [query, CellId]);

  const htmlOutput = get_cl_element("div");
  cell.querySelector(".cell-bottom").appendChild(htmlOutput);
  window.outputArea = htmlOutput;

  // Capture console output
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    consoleNotebookOutput(cell, [args.join(" ")]);
    originalConsoleLog.apply(console, args);
  };

  // Execute the Code
  const outVal = await jsRunner.run(query);
  console.log = originalConsoleLog;

  toggleRunningState(cell, false);
  handleExecutionOutput(cell, outVal, htmlOutput);
}


function toggleRunningState(cell, isRunning) {
  const btn = cell.querySelector("span.fa-regular");
  if (btn) {
    btn.classList.toggle("fa-play-circle", !isRunning);
    btn.classList.toggle("fa-hourglass", isRunning);
  }
}


function handleBackspace(cm) {
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  const indentUnit = cm.getOption("indentUnit");

  if (/^\s*$/.test(line.slice(0, cursor.ch)) && cursor.ch > 0) {
    cm.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - indentUnit) });
  } else {
    cm.execCommand("delCharBefore");
  }
}

function handleExecutionOutput(cell, outVal, htmlOutput) {
  const { value, error } = outVal;
  if (!renderHtmlOutput(value, htmlOutput) && value !== undefined) {
    consoleNotebookOutput(cell, [value], error ? "error" : undefined);
  }
  if (error) throw value;
}

function renderHtmlOutput(val, intoElement) {
  if (val instanceof HTMLElement) {
    intoElement.appendChild(val);
    return true;
  }
  return false;
}

export async function runAllCell(container,modelName){
  container.innerHTML = ""
  let query = "SELECT CellId,CellContent FROM S_JsNotebook"
  const data = await executeQuery('fetchData', modelName, query)
  for (let row of data) {
    const kernel = get_cl_element('computelite-cell','cell-grid cell-container celltype-python');
    kernel.setAttribute('tabindex', '0');

    const output_container = get_cl_element('div','cell-bottom');  
    const htmlOutput = get_cl_element("div");
    window.outputArea = htmlOutput;
    output_container.appendChild(htmlOutput)
    kernel.appendChild(output_container);
    container.appendChild(kernel)

    await runCode(row[1],htmlOutput)    
  } 
}


async function runCode(content, htmlOutput) {
  const jsRunner = new JavascriptEvaluator();
  const outVal = await jsRunner.run(content);

  if (!renderHtmlOutput(outVal.value, htmlOutput) && outVal.error) {
    throw outVal.value;
  }
}
