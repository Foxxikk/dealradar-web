import Link from "next/link";
import * as repo from "../../../lib/repo.js";
import { CATEGORY_LABEL, fmtDate, fmtPrice } from "../../../lib/format.js";
import AdminNav from "../_nav.js";

export const dynamic = "force-dynamic";

export default async function FrontaPage() {
  const items = await repo.reviewQueue();
  return (
    <>
      <h1 className="page">Fronta ke kontrole</h1>
      <p className="lead">Položky s nízkým confidence score (&lt; 60) nebo chybějícími údaji čekají na ruční ověření.</p>
      <AdminNav active="queue" />
      {items.length ? (
        <table className="adm">
          <thead><tr><th>Nabídka</th><th>Kategorie</th><th>Confidence</th><th>Důvod</th><th>Cena</th><th>Termín</th></tr></thead>
          <tbody>
            {items.map((l: any) => (
              <tr key={l.id}>
                <td><Link href={`/nabidka/${l.slug}`}>{l.title}</Link></td>
                <td>{CATEGORY_LABEL[l.category]}</td>
                <td><span className="pill pill-rev">{l.confidenceScore}</span></td>
                <td>{l.reviewReason ?? "—"}</td>
                <td>{fmtPrice(l.startingPrice, l.currency)}</td>
                <td>{fmtDate(l.deadlineAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="empty">Fronta je prázdná — všechny nabídky prošly automatickou publikací.</div>}
    </>
  );
}
