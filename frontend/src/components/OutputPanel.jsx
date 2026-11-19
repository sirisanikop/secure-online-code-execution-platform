import Icon from "./Icon";
import StatusBadge from "./StatusBadge";

export default function OutputPanel({ result, running }) {
  if (running) {
    return <section className="panel" aria-live="polite"><div className="spinner" role="status">Running...</div></section>;
  }
  if (!result) {
    return (
      <section className="panel" aria-live="polite">
        <div className="empty">
          <span className="ei"><Icon name="terminal" /></span>
          <p>Run your program to see the output here.</p>
        </div>
      </section>
    );
  }
  const mem = result.peak_mem_kb ? `${(result.peak_mem_kb / 1024).toFixed(1)} MB` : "n/a";
  return (
    <section className="panel" aria-live="polite" aria-label="Execution result">
      <div className="meta">
        <span className="status-slot"><StatusBadge status={result.status} /></span>
        <span className="metric"><small>Runtime</small><b>{result.runtime_ms} ms</b></span>
        <span className="metric"><small>Memory</small><b>{mem}</b></span>
        <span className="metric"><small>Exit code</small><b>{result.exit_code ?? "-"}</b></span>
      </div>
      <h3>Output</h3>
      <pre className="out" aria-label="Standard output">{result.stdout || <span className="muted">(no output)</span>}</pre>
      {result.stderr ? (<><h3>Errors</h3><pre className="out error" aria-label="Standard error">{result.stderr}</pre></>) : null}
    </section>
  );
}
