import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { api } from "../api";
import OutputPanel from "../components/OutputPanel";

const SAMPLE = `name = input("Name? ")\nprint("Hello,", name)\n`;

export default function EditorPage() {
  const loc = useLocation();
  const [code, setCode] = useState(loc.state?.code ?? SAMPLE);
  const [stdin, setStdin] = useState(loc.state?.stdin ?? "Ada");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [limits, setLimits] = useState(null);
  const busy = useRef(false);

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
        <h2>main.py</h2>
        {limits && <span className="muted">Limits: {limits.timeout_seconds} s | {limits.memory_limit_mb} MB | {Math.round(limits.output_limit_bytes / 1024)} KB output</span>}
      </div>
      <div className="split">
        <div className="editor-box" aria-label="Code editor">
          <CodeMirror value={code} height="320px" extensions={[python()]} onChange={setCode}
                      basicSetup={{ lineNumbers: true, foldGutter: false }} aria-label="Python code" />
        </div>
        <div className="stdin-box">
          <label htmlFor="stdin">Standard input</label>
          <textarea id="stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} rows={12} spellCheck={false} />
        </div>
      </div>
      <div className="actions">
        <button className="primary" onClick={run} disabled={running}>{running ? "Running..." : "Run"}</button>
        <span className="muted">Ctrl+Enter</span>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {result?.status === "BLOCKED" && <p className="muted">Blocked code never ran. See the reason below.</p>}
      <OutputPanel result={result} running={running} />
    </div>
  );
}
