import CodeMirror from "codemirror";
import 'codemirror/theme/dracula.css';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript.js';
import "codemirror/addon/edit/closebrackets.js";
import "codemirror/addon/edit/matchbrackets.js";
import "codemirror/addon/comment/comment.js";
import {consoleNotebookOutput, get_cl_element,executeQuery} from '../../../assets/js/scc'
import { JavascriptEvaluator } from "./eval";
import { createCodeEditor } from "./script";



export function createCodeMirrorEditor(kernelId, modelName, CellId, content, NotebookId) {
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
    indentWithTabs: true,
    smartIndent: true,
    matchBrackets: true,
    autoCloseBrackets:true,
    extraKeys: {
      "Ctrl-/": "toggleComment",
      "Ctrl-Enter": async (cm) => executeCode(editor, cell, jsRunner, modelName, CellId, NotebookId),
      "Shift-Enter": async (cm) => runAndMoveToNextCell(editor, cell, jsRunner, modelName, CellId, NotebookId),
    },
  });

  editor.addKeyMap({
    Backspace: function (cm) {
      handleBackspace(cm);
    },
  });

  setTimeout(() => {
    editor.refresh();
    if (content) {
      editor.setValue(content);
    }
  }, 10);

  cell.querySelector("button.cell-controls-button").onclick = function () {
    executeCode(editor, cell, jsRunner, modelName, CellId);
  };

  return editor;
}

async function runAndMoveToNextCell (editor, cell, jsRunner, modelName, CellId, NotebookId){
  await executeCode(editor, cell, jsRunner, modelName, CellId, NotebookId);
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
        ['', selected_li_el.innerText, notebookId, 'javascript']
      );
      const newCellElement = createCodeEditor(rowId, notebookId);
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

async function executeCode(editor, cell, jsRunner, modelName, CellId, NotebookId) {
  editor.getInputField().blur();
  const query = editor.getValue();
  cell.querySelector(".cell-bottom").innerHTML = "";
  if (cell.querySelector('.sidebar-inner')){
    cell.querySelector('.sidebar-inner').innerHTML = '';
  }

  toggleRunningState(cell, true);

  await executeQuery("updateData", modelName, `UPDATE S_NotebookContent SET CellContent = ? WHERE CellId = ? AND CellType = ? AND NotebookId = ?`, [query,CellId,'javascript',NotebookId]);

  const htmlOutput = get_cl_element("div");
  cell.querySelector(".cell-bottom").appendChild(htmlOutput);
  window.thisDiv = htmlOutput;
  window.applyCss = function (css_content) {
    apply_css(css_content,htmlOutput)
  } 

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

export async function runAllCell(container, modelName, noteBookNm) {
  container.innerHTML = "";
  container.style = "width:100% !important"
  container.parentNode.style = "width:100% !important"
  container.classList.remove("cell-position")
  let query = "SELECT CellId,CellContent FROM S_NotebookContent WHERE Name = ? AND CellType = ?";
  const data = await executeQuery("fetchData", modelName, query, [noteBookNm, 'javascript']);
  document.getElementById
  for (let row of data) {
    // const kernel = get_cl_element('computelite-cell','cell-grid cell-container celltype-python');
    const kernel = get_cl_element('computelite-cell');
    kernel.setAttribute('tabindex', '0');

    const output_container = get_cl_element('div','cell-bottom');  
    const htmlOutput = get_cl_element("div");
    window.thisDiv = htmlOutput;
    window.applyStyle = async function(css_content){
      apply_css(css_content,htmlOutput)
    }
    output_container.appendChild(htmlOutput)
    kernel.appendChild(output_container);
    container.appendChild(kernel)

    await runCode(row[1],htmlOutput)    
  } 
}

function apply_css (css_content,el){
  // el.style = css_content
  let style = document.createElement("style");
  style.innerHTML = css_content;
  document.head.appendChild(style);
}


async function runCode(content, htmlOutput) {
  const jsRunner = new JavascriptEvaluator();
  const outVal = await jsRunner.run(content);

  if (!renderHtmlOutput(outVal.value, htmlOutput) && outVal.error) {
    throw outVal.value;
  }
}
