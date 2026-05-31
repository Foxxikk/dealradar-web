import Link from "next/link";
import { notFound } from "next/navigation";
import * as repo from "../../../lib/repo.js";
import { CATEGORY_LABEL, SALE_TYPE_LABEL, discountPct, fmtDate, fmtDateTime, fmtPrice } from "../../../lib/format.js";
import { DeadlineBadge } from "../../_components/ListingCard.js";

export const dynamic = "force-dynamic";

function KV({ label, value }: { label: string; value: any }) {
  if (value == null || value === "") return null;
  return <><dt>{label}</dt><dd>{String(value)}</dd></>;
}

export default async function DetailPage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const data = await repo.getListing(params.slug);
  if (!data) notFound();
  const { l, vehicle, realEstate, movable, documents, sources, changes } = data as any;
  const photos = (documents as any[]).filter((d) => d.type === "photo");
  const files = (documents as any[]).filter((d) => d.type !== "photo");
  const unlocked = searchParams.unlock === "1";
  const discount = discountPct(l);

  return (
    <>
      <Link href="/katalog" style={{ color: "var(--muted)", fontSize: 14 }}>← Zpět do katalogu</Link>
      <h1 className="page" style={{ marginTop: 8 }}>{l.title}</h1>
      <div className="lead">{CATEGORY_LABEL[l.category]}{l.subcategory ? ` · ${l.subcategory}` : ""} · {SALE_TYPE_LABEL[l.saleType] ?? "—"} <DeadlineBadge iso={l.deadlineAt} /></div>

      <div className="detail">
        <div>
          {photos.length ? (
            <div className="gallery-real">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="gallery-main" src={photos[0].fileUrl} alt={l.title} />
              {photos.length > 1 && (
                <div className="gallery-thumbs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photos.map((p: any) => <img key={p.id} src={p.fileUrl} alt="" loading="lazy" />)}
                </div>
              )}
              <div className="gallery-note">📄 Fotografie automaticky vytěžené z PDF dražební vyhlášky</div>
            </div>
          ) : (
            <div className="gallery">{l.hasPhoto ? (l.category === "vehicle" ? "🚗" : l.category === "real_estate" ? "🏠" : "📦") : "🚫📷"}</div>
          )}

          {l.attractivenessScore != null && (
            <div className="attrbox">
              <div className="score">★ {l.attractivenessScore} / 100</div>
              Atraktivita nabídky — informativní, nikoli investiční doporučení.<br />
              <small>Hlavní důvod: {l.attractivenessReason}.</small>
            </div>
          )}

          {l.summary && <div className="panel"><h2>Automatické shrnutí</h2><p style={{ margin: 0 }}>{l.summary}</p></div>}

          <div className="panel">
            <h2>Veřejné informace</h2>
            <dl className="kv">
              <KV label="Vyvolávací cena" value={fmtPrice(l.startingPrice, l.currency)} />
              <dt>Odhadní cena</dt><dd>{fmtPrice(l.estimatedPrice, l.currency)}{discount != null ? <span className="tag" style={{ marginLeft: 6 }}>−{discount}%</span> : null}</dd>
              <KV label="Lokalita" value={[l.region, l.district].filter(Boolean).join(", ") || "—"} />
              <KV label="Typ prodeje" value={SALE_TYPE_LABEL[l.saleType] ?? "—"} />
              <KV label="Orientační termín" value={fmtDate(l.deadlineAt)} />
              <KV label="Poslední kontrola" value={fmtDateTime(l.sourceLastCheckedAt)} />
            </dl>
          </div>

          {(vehicle || realEstate || movable) && (
            <div className="panel">
              <h2>Parametry</h2>
              <dl className="kv">
                {vehicle && <>
                  <KV label="VIN" value={vehicle.vin} />
                  <KV label="Značka / model" value={[vehicle.make, vehicle.model].filter(Boolean).join(" ")} />
                  <KV label="Rok výroby" value={vehicle.year} />
                  <KV label="Nájezd" value={vehicle.mileage_km ? `${Number(vehicle.mileage_km).toLocaleString("cs-CZ")} km` : null} />
                  <KV label="Palivo" value={vehicle.fuel} />
                  <KV label="Výkon" value={vehicle.power_kw ? `${vehicle.power_kw} kW` : null} />
                </>}
                {realEstate && <>
                  <KV label="Typ nemovitosti" value={realEstate.property_type} />
                  <KV label="Výměra" value={realEstate.area_sqm ? `${realEstate.area_sqm} m²` : null} />
                  <KV label="Katastrální území" value={realEstate.cadastral_area} />
                  <KV label="List vlastnictví" value={realEstate.title_deed_number} />
                  <KV label="Parcela" value={realEstate.parcel_numbers} />
                  <KV label="Podíl" value={realEstate.ownership_share} />
                </>}
                {movable && <>
                  <KV label="Druh věci" value={movable.item_type} />
                  <KV label="Stav" value={movable.condition} />
                  <KV label="Množství" value={movable.quantity} />
                  <KV label="Místo převzetí" value={movable.pickup_location} />
                </>}
              </dl>
            </div>
          )}

          <div className="panel">
            <h2>Placené informace</h2>
            <dl className={`kv ${unlocked ? "" : "locked"}`}>
              <KV label="Přesné datum a čas" value={fmtDateTime(l.auctionAt)} />
              <KV label="Úplná lokalita" value={[l.municipality, l.district, l.region].filter(Boolean).join(", ") || "—"} />
              <KV label="Výše jistoty" value={fmtPrice(l.depositAmount, l.currency)} />
              <dt>Kontakt na správce</dt><dd>{unlocked ? (l.contact ?? "Uveden v dražební vyhlášce (viz dokumenty / původní zdroj)") : "skryto"}</dd>
              <dt>Původní zdroj</dt><dd>{unlocked && l.externalUrl ? <a href={l.externalUrl} target="_blank" rel="noopener noreferrer">{l.externalUrl}</a> : "skryto"}</dd>
            </dl>
            {files.length > 0 && (
              <>
                <h3 style={{ marginTop: 16, fontSize: 14 }}>Dokumenty ke stažení</h3>
                <ul className={unlocked ? "" : "locked"}>
                  {files.map((d: any) => <li key={d.id}>📄 {unlocked && /^https?:/.test(d.fileUrl) ? <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">{d.title}</a> : d.title} <span className="tag">{d.type ?? "dokument"}</span></li>)}
                </ul>
              </>
            )}
          </div>

          {changes.length > 0 && (
            <div className="panel">
              <h2>Historie změn</h2>
              <ul className="changes">
                {changes.map((c: any, i: number) => <li key={i}><b>{c.field}</b>: {c.oldValue ?? "—"} → {c.newValue ?? "—"} <span className="tag">{fmtDate(c.detectedAt)}</span></li>)}
              </ul>
            </div>
          )}
        </div>

        <div>
          <div className="pricebox">
            <div className="big">{fmtPrice(l.startingPrice, l.currency)}</div>
            <div className="sub">vyvolávací cena{l.depositAmount ? ` · jistota ${fmtPrice(l.depositAmount, l.currency)}` : ""}</div>
            <div><span className="tag">conf. score {l.confidenceScore}</span> <span className="tag">{l.status === "ended" ? "ukončeno" : "aktivní"}</span></div>
            {!unlocked ? (
              <div className="paywall">
                <h3>Odemkněte plný detail</h3>
                <ul><li>přesný termín a čas dražby</li><li>výše jistoty</li><li>kontakt a odkaz na zdroj</li><li>dokumenty ke stažení</li></ul>
                <Link className="cta" href="?unlock=1">Odemknout (demo)</Link>
              </div>
            ) : (
              <div className="paywall"><h3>✓ Detail odemčen</h3><p style={{ margin: 0, color: "#d1fae5", fontSize: 14 }}>Demo odemčení placené části.</p></div>
            )}
            <div className="panel" style={{ marginTop: 16, boxShadow: "none" }}>
              <h2>Zdroje ({sources.length})</h2>
              <ul className="src-list">
                {sources.map((sc: any, i: number) => <li key={i}><b>{sc.connectorName ?? sc.sourceConnectorId}</b> <span className="tag">{sc.sourceType ?? ""}</span><br /><small>ext. ID: {sc.sourceExternalId ?? "—"} · {fmtDate(sc.firstSeenAt)}</small></li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
