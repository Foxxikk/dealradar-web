import Link from "next/link";
import { CATEGORY_LABEL, SALE_TYPE_LABEL, daysTo, discountPct, fmtPrice, thumbEmoji } from "../../lib/format.js";

export function DeadlineBadge({ iso }: { iso?: string | null }) {
  const days = daysTo(iso);
  if (days == null) return null;
  if (days < 0) return <span className="badge badge-gray">Po termínu</span>;
  if (days <= 3) return <span className="badge badge-red">Končí za {days} d</span>;
  if (days <= 10) return <span className="badge badge-amber">Za {days} dní</span>;
  return <span className="badge badge-soft">{new Date(iso!).toLocaleDateString("cs-CZ", { timeZone: "UTC" })}</span>;
}

export default function ListingCard({ r }: { r: any }) {
  const discount = discountPct(r);
  const confCls = r.confidenceScore >= 85 ? "conf-hi" : r.confidenceScore >= 60 ? "conf-mid" : "conf-lo";
  return (
    <Link className="card" href={`/nabidka/${r.slug}`}>
      <div className="card-thumb">
        {r.primaryImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card-photo" src={r.primaryImageUrl} alt="" loading="lazy" />
            <span className="thumb-tag">foto z vyhlášky</span>
          </>
        ) : r.hasPhoto ? (
          <><span className="thumb-emoji">{thumbEmoji(r.category)}</span><span className="thumb-tag">foto</span></>
        ) : (
          <span className="thumb-emoji dim">{thumbEmoji(r.category)}</span>
        )}
        <div className="card-badges">
          <DeadlineBadge iso={r.deadlineAt} />
          {discount != null && <span className="badge badge-green">−{discount}%</span>}
        </div>
      </div>
      <div className="card-body">
        <div className="card-cat">{CATEGORY_LABEL[r.category] ?? r.category}{r.subcategory ? ` · ${r.subcategory}` : ""}</div>
        <div className="card-title">{r.title}</div>
        <div className="card-price">
          {fmtPrice(r.startingPrice, r.currency)}
          {r.estimatedPrice ? <span className="est">odhad {fmtPrice(r.estimatedPrice, r.currency)}</span> : null}
        </div>
        <div className="card-meta">
          <span>📍 {r.region ?? "—"}</span>
          <span>{SALE_TYPE_LABEL[r.saleType] ?? "—"}</span>
        </div>
        <div className="card-foot">
          <span className={`conf ${confCls}`}>⚙︎ {r.confidenceScore}</span>
          {Number(r.sourceCount) > 1 && <span className="src-pill">{r.sourceCount} zdroje</span>}
          {r.attractivenessScore != null && <span className="attr">★ {r.attractivenessScore}</span>}
        </div>
      </div>
    </Link>
  );
}
