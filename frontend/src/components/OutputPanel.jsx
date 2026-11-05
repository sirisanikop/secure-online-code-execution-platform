import StatusBadge from "./StatusBadge";

export default function OutputPanel({ result, running }) {
  if (running) {
    return <section className="panel" aria-live="polite"><div className="spinner" role="status">Running...</div></section>;
  }
  if (!result) {
    return <section className="panel muted" aria-live="polite">Run your program to see the output here.</section>;
  }
  const mem = result.peak_mem_kb ? `${(result.peak_mem_kb / 1024).toFixed(1)} MB` : "n/a";
  return (
    <section className="panel" aria-live="polite" aria-label="Execution result">
      <div className="meta">
        <StatusBadge status={result.status} />
        <span>Runtime: <b>{result.runtime_ms} ms</b></span>
        <span>Memory: <b>{mem}</b></span>
        <span>Exit code: <b>{result.exit_code ?? "-"}</b></span>
      </div>
      <h3>Output</h3>
      <pre className="out" aria-label="Standard output">{result.stdout || <span className="muted">(no output)</span>}</pre>
      {result.stderr ? (<><h3>Errors</h3><pre className="out error" aria-label="Standard error">{result.stderr}</pre></>) : null}
    </section>
  );
}
