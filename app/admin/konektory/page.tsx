import * as repo from "../../../lib/repo.js";
import { fmtDateTime } from "../../../lib/format.js";
import AdminNav from "../_nav.js";

export const dynamic = "force-dynamic";

export default async function KonektoryPage() {
  const conns = await repo.connectors();
  return (
    <>
      <h1 className="page">Správa konektorů</h1>
      <p className="lead">Stav importních konektorů a poslední úspěšné běhy.</p>
      <AdminNav active="conn" />
      <table className="adm">
        <thead><tr><th>Konektor</th><th>Typ</th><th>Plán</th><th>Záznamů</th><th>Stav</th><th>Poslední běh</th><th>Priorita</th></tr></thead>
        <tbody>
          {conns.map((c: any) => (
            <tr key={c.id}>
              <td><b>{c.name}</b><br /><small style={{ color: "var(--muted)" }}>{c.sourceUrl}</small></td>
              <td><span className="tag">{c.sourceType}</span></td>
              <td>{c.schedule}</td>
              <td>{c.records}</td>
              <td>{Number(c.failureCount) > 0 ? <span className="pill pill-err">chyba ({c.failureCount})</span> : <span className="pill pill-ok">OK</span>}</td>
              <td>{fmtDateTime(c.lastSuccessfulRunAt)}</td>
              <td><span className="tag">{c.priority}</span> v{c.parserVersion}</td>
            </tr>
          ))}
          {conns.length === 0 && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>Zatím žádné konektory – spusť import.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
