import { parse } from "@babel/parser";
import { simple } from "babel-walk";

export async function precompileJavascriptCode(content) {
    let wrapped = "(async () => {" + content + "\n})()";
    const root = parse(wrapped, { ecmaVersion: 8 });
    const body = root.program.body[0].expression.callee.body;
  
    const isTopLevel = (node) => {
      return body.body.indexOf(node) !== -1;
    };
  
    const changes = [];
  
    const visitors = {
      ClassDeclaration(node) {
        if (isTopLevel(node)) {
          changes.push({
            text: node.id.name + "=",
            start: node.start,
            end: node.start,
          });
        }
      },
      FunctionDeclaration(node) {
        changes.push({
          text: node.id.name + "=",
          start: node.start,
          end: node.start,
        });
        return node;
      },
      VariableDeclaration(node) {
        if (node.kind !== "var" || !isTopLevel(node)) return;
        const onlyOneDeclaration = node.declarations.length === 1;
        changes.push({
          text: onlyOneDeclaration ? "void" : "void (",
          start: node.start,
          end: node.start + node.kind.length,
        });
        for (const declaration of node.declarations) {
          if (!declaration.init) {
            changes.push({
              text: "(",
              start: declaration.start,
              end: declaration.start,
            });
            changes.push({
              text: "=undefined)",
              start: declaration.end,
              end: declaration.end,
            });
            continue;
          }
          changes.push({
            text: "(",
            start: declaration.start,
            end: declaration.start,
          });
          changes.push({
            text: ")",
            start: declaration.end,
            end: declaration.end,
          });
        }
        if (!onlyOneDeclaration) {
          const last = node.declarations[node.declarations.length - 1];
          changes.push({ text: ")", start: last.end, end: last.end });
        }
      },
    };
  
    const walk = simple(visitors);
    walk(root, undefined);
  
    const last = body.body[body.body.length - 1];
    if (last === undefined) {
      return content;
    }
  
    if (last.type === "ExpressionStatement" && !content.match(/;\s*$/)) {
      changes.push({
        text: "return {returnValue: (",
        start: last.start,
        end: last.start,
      });
      if (wrapped[last.end - 1] !== ";") {
        changes.push({ text: ")}", start: last.end, end: last.end });
      } else changes.push({ text: ")}", start: last.end - 1, end: last.end - 1 });
  
      // We need to offset changes in the final expression with 22, the length of
      // `return {returnValue: (`
      changes.forEach((change, i) => {
        if (i >= changes.length - 2) return;
        if (change.start >= last.start && change.start < last.end) {
          change.start += 22;
          change.end += 22;
        }
      });
    }
  
    while (changes.length) {
      const change = changes.pop();
      wrapped = wrapped.substr(0, change.start) + change.text + wrapped.substr(change.end);
    }
  
    return wrapped;
  }
  
  
  