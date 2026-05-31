import Link from "next/link";
import * as repo from "../../lib/repo.js";
import type { Filters } from "../../lib/repo.js";
import { CATEGORY_LABEL, SALE_TYPE_LABEL, fmtPrice } from "../../lib/format.js";
import ListingCard from "../_components/ListingCard.js";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function buildQuery(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "" && v !== false) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export default async function KatalogPage({ searchParams }: { searchParams: SP }) {
  const sp = searchParams;
  const q = str(sp.q);
  let f: Filters = {
    category: str(sp.category), region: str(sp.region), saleType: str(sp.saleType), source: str(sp.source),
    make: str(sp.make),
    priceMin: sp.priceMin ? Number(str(sp.priceMin)) : undefined,
    priceMax: sp.priceMax ? Number(str(sp.priceMax)) : undefined,
    onlyPhotos: str(sp.onlyPhotos) === "1", onlyDocs: str(sp.onlyDocs) === "1", onlyVerified: str(sp.onlyVerified) === "1",
    sort: str(sp.sort) ?? "novy", page: sp.page ? Number(str(sp.page)) : 1,
  };
  let parsed: Filters | null = null;
  if (q) {
    parsed = repo.parseQuery(q);
    const explicit = Object.fromEntries(Object.entries(f).filter(([, v]) => v != null && v !== "" && v !== false && v !== "novy"));
    f = { ...parsed, ...explicit, sort: f.sort, page: f.page };
  }

  const [{ rows, total }, fc] = await Promise.all([repo.search(f), repo.facets()]);
  const pageSize = 24;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  const base = { q, category: f.category, region: f.region, saleType: f.saleType, source: f.source, make: f.make, priceMin: f.priceMin, priceMax: f.priceMax, onlyPhotos: f.onlyPhotos ? "1" : "", onlyDocs: f.onlyDocs ? "1" : "", onlyVerified: f.onlyVerified ? "1" : "", sort: f.sort };

  const descParts: string[] = [];
  if (parsed?.category) descParts.push(CATEGORY_LABEL[parsed.category]);
  if (parsed?.make) descParts.push(parsed.make);
  if (parsed?.priceMax) descParts.push(`do ${fmtPrice(parsed.priceMax)}`);
  if (parsed?.region) descParts.push(parsed.region);

  return (
    <div className="layout">
      <form className="filters" method="get" action="/katalog">
        {q && <input type="hidden" name="q" value={q} />}
        <h3>Filtry</h3>
        <label>Kategorie</label>
        <select name="category" defaultValue={f.category ?? ""}>
          <option value="">Vše</option>
          {["vehicle", "real_estate", "movable_asset"].map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <label>Kraj</label>
        <select name="region" defaultValue={f.region ?? ""}>
          <option value="">Všechny kraje</option>
          {fc.regions.map((r: any) => <option key={r.region} value={r.region}>{r.region} ({r.c})</option>)}
        </select>
        <label>Typ prodeje</label>
        <select name="saleType" defaultValue={f.saleType ?? ""}>
          <option value="">Vše</option>
          {fc.saleTypes.map((r: any) => <option key={r.saleType} value={r.saleType}>{SALE_TYPE_LABEL[r.saleType] ?? r.saleType} ({r.c})</option>)}
        </select>
        <label>Cena (Kč)</label>
        <div className="row2">
          <input name="priceMin" type="number" placeholder="od" defaultValue={f.priceMin ?? ""} />
          <input name="priceMax" type="number" placeholder="do" defaultValue={f.priceMax ?? ""} />
        </div>
        {(f.category === "vehicle" || f.make) && <><label>Značka</label><input name="make" placeholder="Škoda" defaultValue={f.make ?? ""} /></>}
        <label className="chk"><input type="checkbox" name="onlyPhotos" value="1" defaultChecked={f.onlyPhotos} /> jen s fotografiemi</label>
        <label className="chk"><input type="checkbox" name="onlyDocs" value="1" defaultChecked={f.onlyDocs} /> jen s dokumentací</label>
        <label className="chk"><input type="checkbox" name="onlyVerified" value="1" defaultChecked={f.onlyVerified} /> jen ověřené (conf ≥ 85)</label>
        <input type="hidden" name="sort" value={f.sort ?? "novy"} />
        <button>Použít filtry</button>
        <Link className="clear" href="/katalog">Zrušit filtry</Link>
      </form>

      <div>
        <div className="toolbar">
          <div className="count">
            {total.toLocaleString("cs-CZ")} nabídek{q ? ` pro „${q}“` : ""}
            {descParts.length ? <span className="tag" style={{ marginLeft: 8 }}>rozpoznáno: {descParts.join(", ")}</span> : null}
          </div>
          <form method="get" action="/katalog">
            {Object.entries(base).filter(([k, v]) => k !== "sort" && v != null && v !== "").map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
            <select name="sort" defaultValue={f.sort ?? "novy"}>
              {[["novy", "Nejnovější"], ["termin", "Nejbližší termín"], ["cena_asc", "Nejnižší cena"], ["cena_desc", "Nejvyšší cena"], ["sleva", "Nejvyšší sleva"], ["atraktivita", "Doporučené"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button style={{ marginLeft: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}>Seřadit</button>
          </form>
        </div>

        {rows.length ? <div className="grid">{rows.map((r) => <ListingCard key={r.id} r={r} />)}</div>
          : <div className="empty">Žádné nabídky neodpovídají filtrům.</div>}

        {pages > 1 && (
          <div className="pager">
            {Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2).map((p) =>
              p === page ? <span key={p} className="cur">{p}</span> : <Link key={p} href={`/katalog${buildQuery({ ...base, page: p })}`}>{p}</Link>)}
          </div>
        )}
      </div>
    </div>
  );
}
