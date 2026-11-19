import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { api } from "../api";
import OutputPanel from "../components/OutputPanel";
import Icon from "../components/Icon";

// Follows the operating-system colour scheme so the code editor matches the rest of the UI.
function usePrefersDark() {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const [dark, setDark] = useState(!!query?.matches);
  useEffect(() => {
    if (!query) return undefined;
    const on = (e) => setDark(e.matches);
    query.addEventListener?.("change", on);
    return () => query.removeEventListener?.("change", on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return dark;
}

const SAMPLE = `name = input("Name? ")\nprint("Hello,", name)\n`;

// Matches the backend default MAX_CODE_BYTES (backend/app/config.py).
export const MAX_UPLOAD_BYTES = 51200;
const ALLOWED_TYPES = ["", "text/plain", "text/x-python", "text/x-python-script", "application/x-python-code"];

// Returns an error message, or "" if the file may be read.
export function checkUpload(file) {
  if (!/\.py$/i.test(file.name) || !ALLOWED_TYPES.includes(file.type)) {
    return `${file.name} is not a Python file. Only .py files can be uploaded.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name} is ${(file.size / 1024).toFixed(1)} KB; the limit is ${MAX_UPLOAD_BYTES / 1024} KB.`;
  }
  return "";
}

export default function EditorPage() {
  const loc = useLocation();
  const dark = usePrefersDark();
  const [code, setCode] = useState(loc.state?.code ?? SAMPLE);
  const [stdin, setStdin] = useState(loc.state?.stdin ?? "Ada");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [limits, setLimits] = useState(null);
  const [fileName, setFileName] = useState("main.py");
  const [uploadError, setUploadError] = useState("");
  const busy = useRef(false);
  const fileInput = useRef(null);

  // Upload only fills the editor; Run still goes through POST /api/executions,
  // so sandbox limits and audit logging apply exactly as for typed code.
  const onFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploadError("");
    const problem = checkUpload(file);
    if (problem) { setUploadError(problem); return; } // file is never read
    const reader = new FileReader();
    reader.onload = () => {
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(reader.result);
      } catch {
        setUploadError(`${file.name} is not valid UTF-8 text. Save it as UTF-8 and try again.`);
        return;
      }
      if (text.includes("\u0000")) {
        setUploadError(`${file.name} looks like a binary file, not Python source.`);
        return;
      }
      setCode(text.replace(/^﻿/, ""));
      setFileName(file.name);
      setResult(null);
      setError("");
    };
    reader.onerror = () => setUploadError(`Could not read ${file.name}.`);
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => { api.limits().then(setLimits).catch(() => {}); }, []);

  const run = useCallback(async () => {
    if (busy.current) return; // prevents duplicate submission
    busy.current = true;
    setRunning(true);
    setError("");
    try {
      setResult(await api.run(code, stdin));
    } catch (e) {
      setResult(null);
      setError(e.retryAfter ? `${e.message} (retry in ${e.retryAfter} s)` : e.message);
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, [code, stdin]);

  return (
    <div className="editor-page" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); } }}>
      <div className="toolbar">
        <h2 className="file-chip" data-testid="file-name"><Icon name="file" />{fileName}</h2>
        <button type="button" className="small" onClick={() => fileInput.current?.click()}><Icon name="upload" />Upload file</button>
        <input ref={fileInput} type="file" accept=".py,text/x-python,text/plain" hidden
               aria-label="Upload Python file" onChange={onFileChosen} />
        {limits && <span className="limits"><Icon name="gauge" />Limits: {limits.timeout_seconds} s | {limits.memory_limit_mb} MB | {Math.round(limits.output_limit_bytes / 1024)} KB output</span>}
      </div>
      {uploadError && <div className="form-error" role="alert" data-testid="upload-error"><Icon name="alert" />{uploadError}</div>}
      <div className="split">
        <div className="pane">
          <div className="pane-head"><span className="dots" aria-hidden="true"><i /><i /><i /></span>Python</div>
          <div className="editor-box" aria-label="Code editor">
            <CodeMirror value={code} height="100%" theme={dark ? "dark" : "light"} extensions={[python()]} onChange={setCode}
                        basicSetup={{ lineNumbers: true, foldGutter: false }} aria-label="Python code" />
          </div>
        </div>
        <div className="pane stdin-box">
          <label htmlFor="stdin">Standard input</label>
          <textarea id="stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} rows={12} spellCheck={false} />
        </div>
      </div>
      <div className="actions">
        <button className="primary" onClick={run} disabled={running}><Icon name="play" />{running ? "Running..." : "Run"}</button>
        <span className="hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run</span>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {result?.status === "BLOCKED" && <p className="muted">Blocked code never ran. See the reason below.</p>}
      <OutputPanel result={result} running={running} />
    </div>
  );
}
