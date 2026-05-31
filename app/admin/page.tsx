import * as repo from "../../lib/repo.js";
import AdminNav from "./_nav.js";

export const dynamic = "force-dynamic";

function Metric({ v, l, cls = "" }: { v: string | number; l: string; cls?: string }) {
  return <div className={`metric ${cls}`}><div className="v">{v}</div><div className="l">{l}</div></div>;
}

export default async function AdminPage() {
  const s = await repo.stats();
  const auto = s.total ? Math.round((s.autoPublished / s.total) * 1000) / 10 : 0;
  return (
    <>
      <h1 className="page">Administrace</h1>
      <p className="lead">Nástroj pro kontrolu výjimek, ne pro ruční přepisování nabídek.</p>
      <AdminNav active="dash" />
      <div className="metrics">
        <Metric v={s.total.toLocaleString("cs-CZ")} l="Aktivních nabídek" />
        <Metric v={s.new24h} l="Nových za 24 h" />
        <Metric v={`${auto} %`} l="Podíl automatizace" cls={auto >= 75 ? "good" : "warn"} />
        <Metric v={s.review} l="Ve frontě ke kontrole" cls={s.review > 0 ? "warn" : "good"} />
        <Metric v={s.withDuplicates} l="Sloučených duplicit" />
        <Metric v={s.autoPublished.toLocaleString("cs-CZ")} l="Automaticky publikováno" />
        <Metric v={s.connectorsOk} l="Funkčních konektorů" cls="good" />
        <Metric v={s.connectorsErr} l="Konektorů s chybou" cls={s.connectorsErr > 0 ? "warn" : ""} />
      </div>
      <div className="panel">
        <h2>Podíl automatizace vs. cíl MVP (≥ 75 %)</h2>
        <div className="bar"><i style={{ width: `${Math.min(100, auto)}%` }} /></div>
        <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 14 }}>
          {auto} % nabídek je publikováno bez ručního zásahu. {auto >= 75 ? "Cíl MVP splněn ✓" : "Cíl MVP zatím nesplněn"}.
        </p>
      </div>
    </>
  );
}
