import CodeMirror from "codemirror";
import 'codemirror/theme/dracula.css';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/python/python.js';
import {executePython,consoleNotebookOutput, get_cl_element,executeQuery,drawImageFromPython} from '../../../assets/js/scc'

const isPyProxy = (jsobj) => !!jsobj && jsobj.$$?.type === "PyProxy";

export function createCodeMirrorEditor(kernelId,modelName,CellId,content) {
  const cell = document.getElementById(kernelId);
  var editor = CodeMirror(cell.querySelector("div.computelite-text-editor"), {
    lineNumbers: true,
    lineWrapping:true,
    mode: "python",
    autoRefresh:true,
    autofocus:true,   
    tabSize:4,
    indentUnit:4,
    extraKeys: {
      'Ctrl-Enter': async (cm) => {
        // Custom function triggered by Ctrl+Enter
        cm.getInputField().blur();
        const query = editor.getValue();
        cell.querySelector(".cell-bottom").innerHTML = "";
        cell.querySelector(".sidebar-inner")?.innerHTML = "";

        // Show Running
        const btn = cell.querySelector('span.fa-regular')
        if (btn?.classList.contains("fa-play-circle")) {
          btn.classList.replace("fa-play-circle", "fa-hourglass");
        }

        // Update the cell content in the database
        const updateQuery = `UPDATE S_Notebook SET CellContent = ? WHERE CellId = ?`
        await executeQuery('updateData',modelName,updateQuery,[query,CellId])

        // Execute the Code
        let res = await executePython('execute','notebook',query,'Default',modelName,[],null,[],[],kernelId)

        // Hide Running
        if (btn?.classList.contains("fa-hourglass")) {
          btn.classList.replace("fa-hourglass", "fa-play-circle");
        }

        const htmlOutput = get_cl_element("div");
        cell.querySelector('.cell-bottom').appendChild(htmlOutput)

        if (res.result !== undefined){
          // Convert the result to a output element
          let val = await convertResult(res.result.display,res.result.value)
          if (val !== undefined) {      
            if (val instanceof HTMLElement) { // A plain HTML element
              htmlOutput.appendChild(val);
              val.querySelectorAll('script[type|="text/javascript"]').forEach(
                    function(e) {
                      if (e.textContent !== null) {
                        eval(e.textContent);
                      }
                    }
                  )
            }else if (isPyProxy(val)) { // Something that is proxied
              let hadHTMLOutput = false;
              if (val._repr_html_ !== undefined) { // Has a HTML representation (e.g. a Pandas table)
                let result = val._repr_html_();
                if (typeof result === "string") {
                  let div = get_cl_element("div","rendered_html cell-output-html");
                  div.appendChild(new DOMParser().parseFromString(result, "text/html").body.firstChild);
                  htmlOutput.appendChild(div);
                  // Evaluate all script tags manually, see previous comment
                  div.querySelectorAll('script[type|="text/javascript"]').forEach(
                    function(e) {
                      if (e.textContent !== null) {
                        eval(e.textContent);
                      }
                    }
                  )
                  hadHTMLOutput = true;
                }
              } 
              if (!hadHTMLOutput) {
                consoleNotebookOutput(cell,[val])
              }
            }else if (val instanceof Uint8Array){
              // Draw the image if output is an image
              drawImageFromPython(val) 
            } else {
              // show the output in the console
              consoleNotebookOutput(cell,[res.result.value])
            }
          }
        }else if (res.stderr != undefined){
          consoleNotebookOutput(cell,[res.stderr],'error')
        }
      },
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

  setTimeout(() => {
    editor.refresh();
    editor.setValue(content)
  }, 10);
  return editor
}


async function convertResult(display, value) {
  if (display === "html") {
    let div = get_cl_element("div", "rendered_html cell-output-html");
    div.appendChild(new DOMParser().parseFromString(value, "text/html").body.firstChild);
    return div;
  }
  return value;
}
