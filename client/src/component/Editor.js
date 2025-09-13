// src/component/Editor.js
import React, { useEffect, useRef, useState } from "react";
import CodeMirror from "codemirror";

// Base + Theme
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";

// Languages
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike";   // C, C++, Java
import "codemirror/mode/htmlmixed/htmlmixed";
import "codemirror/mode/markdown/markdown";

// Addons
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/edit/matchbrackets";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/matchtags";

function Editor({ socketRef, roomId, activeFile }) {
  const editorRef = useRef(null);
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  // ==========================
  // Hello World templates
  // ==========================
  const templates = {
    javascript: `console.log("Hello, World!");`,
    python: `print("Hello, World!")`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
    c: `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`,
    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
    html: `<!DOCTYPE html>
<html>
  <head><title>Hello</title></head>
  <body><h1>Hello, World!</h1></body>
</html>`,
    markdown: `# Hello, World!`,
  };

  // ==========================
  // File extension → language
  // ==========================
  const extensionMap = {
    js: "javascript",
    py: "python",
    cpp: "cpp",
    c: "c",
    java: "java",
    html: "html",
    md: "markdown",
  };

  // Language → CodeMirror mode + backend mapping
  const modeMap = {
    javascript: { mode: "javascript", serverName: "javascript" },
    python: { mode: "python", serverName: "python" },
    cpp: { mode: "text/x-c++src", serverName: "cpp" },
    c: { mode: "text/x-csrc", serverName: "c" },
    java: { mode: "text/x-java", serverName: "java" },
    html: { mode: "htmlmixed", serverName: "html" },
    markdown: { mode: "markdown", serverName: "markdown" },
  };

  const detectLanguage = (fileName = "") => {
    const ext = fileName.split(".").pop().toLowerCase();
    return extensionMap[ext] || "javascript";
  };

  // ==========================
  // Init CodeMirror once
  // ==========================
  useEffect(() => {
    const cm = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
      mode: modeMap[language].mode,
      theme: "dracula",
      lineNumbers: true,
      tabSize: 2,
      autoCloseBrackets: true,
      matchBrackets: true,
      autoCloseTags: true,
      matchTags: { bothTags: true },
    });

    cm.setSize("100%", "100%");
    editorRef.current = cm;

    const onChangeHandler = (instance, changes) => {
      if (changes.origin === "setValue") return; // avoid echo
      const code = instance.getValue();
      if (socketRef?.current) {
        socketRef.current.emit("code-change", {
          roomId,
          code,
          language,
          path: activeFile?.path,
        });
      }
    };

    cm.on("change", onChangeHandler);

    return () => {
      cm.off("change", onChangeHandler);
      try {
        cm.toTextArea();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================
  // Load new active file
  // ==========================
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    const detectedLang = detectLanguage(activeFile.name);
    setLanguage(detectedLang);
    editorRef.current.setOption("mode", modeMap[detectedLang]?.mode || "javascript");

    if (!activeFile.code || activeFile.code.trim() === "") {
      editorRef.current.setValue(templates[detectedLang] || "");
    } else {
      editorRef.current.setValue(activeFile.code);
    }
  }, [activeFile]);

  // ==========================
  // Listen for socket changes
  // ==========================
  useEffect(() => {
    if (!socketRef?.current) return;

    const handler = ({ code, language: incomingLang, path }) => {
      if (!editorRef.current) return;
      if (path !== activeFile?.path) return;

      if (incomingLang && incomingLang !== language) {
        setLanguage(incomingLang);
        editorRef.current.setOption("mode", modeMap[incomingLang]?.mode || "javascript");
      }

      if (code != null && code !== editorRef.current.getValue()) {
        editorRef.current.setValue(code);
      }
    };

    socketRef.current.on("code-change", handler);
    return () => {
      socketRef.current.off("code-change", handler);
    };
  }, [socketRef, language, activeFile]);

  // ==========================
  // Language change (dropdown)
  // ==========================
  const onLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    if (editorRef.current) {
      editorRef.current.setOption("mode", modeMap[newLang].mode);
      editorRef.current.setValue(templates[newLang]);
    }
    if (socketRef?.current) {
      socketRef.current.emit("code-change", {
        roomId,
        code: templates[newLang],
        language: newLang,
        path: activeFile?.path,
      });
    }
  };

  // ==========================
  // Run code
  // ==========================
  const runCode = async () => {
    if (!editorRef.current) return;
    setRunning(true);
    setOutput("");
    try {
      const code = editorRef.current.getValue();
      const resp = await fetch(
        `${"https://collaborative-editor-coral.vercel.app/"}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: modeMap[language].serverName,
            code,
          }),
        }
      );
      const data = await resp.json();
      setOutput(data.output || "No output");
    } catch (err) {
      setOutput("Execution failed: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, padding: 8, alignItems: "center", background: "#1e1e1e" }}>
        <label style={{ color: "white" }}>Language:</label>
        <select value={language} onChange={onLanguageChange}>
          <option value="javascript">JavaScript (Node)</option>
          <option value="python">Python 3</option>
          <option value="cpp">C++</option>
          <option value="c">C</option>
          <option value="java">Java</option>
          <option value="html">HTML</option>
          <option value="markdown">Markdown</option>
        </select>

        <button onClick={runCode} disabled={running} style={{ marginLeft: "auto" }}>
          {running ? "Running..." : "Run ▶"}
        </button>
      </div>

      {/* Code Editor */}
      <div style={{ flex: 1, minHeight: 300 }}>
        <textarea id="codeEditor" />
      </div>

      {/* Output Console */}
      <div style={{ height: 150, overflow: "auto", background: "#0b0b0b", color: "white", padding: 8, fontFamily: "monospace" }}>
        <strong>Output:</strong>
        <pre style={{ whiteSpace: "pre-wrap" }}>{output}</pre>
      </div>

      {/* Status Bar */}
      <div style={{ background: "#1e1e1e", color: "#bbb", padding: "4px 8px", fontSize: "12px", fontFamily: "monospace" }}>
        {activeFile?.name || "No File"} — {language.toUpperCase()}
      </div>
    </div>
  );
}

export default Editor;
