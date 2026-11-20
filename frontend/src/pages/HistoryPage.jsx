import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Icon from "../components/Icon";
import { formatIST } from "../time";
import StatusBadge from "../components/StatusBadge";
import OutputPanel from "../components/OutputPanel";

const PAGE = 10;

export default function HistoryPage() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const nav = useNavigate();

  const load = useCallback(() => {
    api.history(PAGE, offset).then(setData).catch((e) => setError(e.message));
  }, [offset]);
  useEffect(load, [load]);

  async function open(id) {
    try { setDetail(await api.execution(id)); } catch (e) { setError(e.message); }
  }
  async function remove(id) {
    try { await api.remove(id); if (detail?.id === id) setDetail(null); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Run history</h2>
          <p>Everything you have run, newest first.</p>
        </div>
      </div>
      {error && <div className="form-error" role="alert"><Icon name="alert" />{error}</div>}
      {data.items.length === 0 ? (
        <div className="card empty">
          <span className="ei"><Icon name="inbox" /></span>
          <p>No runs yet. Run some code on the Editor page.</p>
        </div>
      ) : (
        <div className="table-wrap history-table">
          <table>
            <thead><tr><th>Time</th><th>Status</th><th>Runtime</th><th>Code</th><th /></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="when">{formatIST(r.created_at)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num">{r.runtime_ms} ms</td>
                  <td><code>{r.code_preview.replace(/\n/g, " ")}</code></td>
                  <td>
                    <div className="row-actions">
                      <button className="small" onClick={() => open(r.id)}>View</button>
                      <button className="small danger" onClick={() => remove(r.id)} aria-label={`Delete run ${r.id}`}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pager">
        <button className="small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
        <span>{data.total === 0 ? 0 : offset + 1}-{Math.min(offset + PAGE, data.total)} of {data.total}</span>
        <button className="small" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
      </div>
      {detail && (
        <section className="detail" aria-label="Run detail">
          <h3>Run #{detail.id}</h3>
          <pre className="out" aria-label="Source code">{detail.code}</pre>
          {detail.stdin && (<><h3>Standard input</h3><pre className="out">{detail.stdin}</pre></>)}
          <OutputPanel result={detail} />
          <div><button onClick={() => nav("/", { state: { code: detail.code, stdin: detail.stdin } })}>Load into editor</button></div>
        </section>
      )}
    </div>
  );
}
