import { sql, type SQL } from "drizzle-orm";
import { getDb } from "./db/client.js";
import { normalizeBrand, normalizeRegion } from "./reference.js";
import { stripDiacritics } from "./util.js";

// db.execute vrací u různých driverů jiný tvar – sjednotíme na pole.
async function q(expr: SQL): Promise<any[]> {
  const r: any = await getDb().execute(expr);
  return Array.isArray(r) ? r : r.rows ?? [];
}

const L = sql.raw(`
  l.id, l.slug, l.title, l.description, l.summary, l.category, l.subcategory,
  l.sale_type AS "saleType", l.status, l.starting_price AS "startingPrice",
  l.estimated_price AS "estimatedPrice", l.currency, l.deposit_amount AS "depositAmount",
  l.deadline_at AS "deadlineAt", l.auction_at AS "auctionAt", l.inspection_at AS "inspectionAt",
  l.source_last_checked_at AS "sourceLastCheckedAt", l.source_first_seen_at AS "sourceFirstSeenAt",
  l.confidence_score AS "confidenceScore", l.review_reason AS "reviewReason", l.has_photo AS "hasPhoto",
  l.region, l.district, l.municipality, l.external_url AS "externalUrl", l.contact,
  l.attractiveness_score AS "attractivenessScore", l.attractiveness_reason AS "attractivenessReason"
`);
const PHOTO = sql.raw(`(SELECT d2.file_url FROM listing_documents d2 WHERE d2.listing_id=l.id AND d2.type='photo' ORDER BY d2.created_at LIMIT 1) AS "primaryImageUrl"`);

export interface Filters {
  q?: string; category?: string; region?: string; saleType?: string; source?: string;
  priceMin?: number; priceMax?: number; make?: string;
  onlyPhotos?: boolean; onlyDocs?: boolean; onlyVerified?: boolean;
  sort?: string; page?: number;
}

export async function stats() {
  const c = async (cond: string) => Number((await q(sql.raw(`SELECT COUNT(*) c FROM listings ${cond}`)))[0].c);
  const conn = async (cond: string) => Number((await q(sql.raw(`SELECT COUNT(*) c FROM connectors ${cond}`)))[0].c);
  return {
    total: await c(""), active: await c("WHERE status='active'"), ended: await c("WHERE status='ended'"),
    review: await c("WHERE status='review'"),
    new24h: await c("WHERE source_first_seen_at > to_char(now() - interval '1 day','YYYY-MM-DD\"T\"HH24:MI:SS')"),
    autoPublished: await c("WHERE status IN ('active','ended')"),
    vehicles: await c("WHERE category='vehicle'"), realEstate: await c("WHERE category='real_estate'"),
    movable: await c("WHERE category='movable_asset'"),
    withPhoto: await c("WHERE has_photo=true"),
    withDuplicates: Number((await q(sql.raw(`SELECT COUNT(*) c FROM (SELECT listing_id FROM listing_sources GROUP BY listing_id HAVING COUNT(*)>1) t`)))[0].c),
    connectorsOk: await conn("WHERE failure_count=0 AND is_active=true"),
    connectorsErr: await conn("WHERE failure_count>0"),
  };
}

export async function automationRate(): Promise<number> {
  const s = await stats();
  return s.total ? Math.round((s.autoPublished / s.total) * 1000) / 10 : 0;
}

const SORTS: Record<string, string> = {
  novy: "l.source_first_seen_at DESC",
  termin: "(l.deadline_at IS NULL) ASC, l.deadline_at ASC",
  cena_asc: "(l.starting_price IS NULL) ASC, l.starting_price ASC",
  cena_desc: "l.starting_price DESC NULLS LAST",
  sleva: "(CASE WHEN l.estimated_price>0 AND l.starting_price>0 THEN (1.0 - l.starting_price/l.estimated_price) ELSE 0 END) DESC",
  atraktivita: "(l.attractiveness_score IS NULL) ASC, l.attractiveness_score DESC",
};

export async function search(f: Filters): Promise<{ rows: any[]; total: number }> {
  const conds: SQL[] = [sql`l.status IN ('active','ended')`];
  if (f.category) conds.push(sql`l.category = ${f.category}`);
  if (f.region) conds.push(sql`l.region = ${f.region}`);
  if (f.saleType) conds.push(sql`l.sale_type = ${f.saleType}`);
  if (f.priceMin != null) conds.push(sql`l.starting_price >= ${f.priceMin}`);
  if (f.priceMax != null) conds.push(sql`l.starting_price <= ${f.priceMax}`);
  if (f.onlyPhotos) conds.push(sql`l.has_photo = true`);
  if (f.onlyVerified) conds.push(sql`l.confidence_score >= 85`);
  if (f.make) conds.push(sql`EXISTS (SELECT 1 FROM vehicle_listings v WHERE v.listing_id=l.id AND v.make = ${normalizeBrand(f.make)})`);
  if (f.onlyDocs) conds.push(sql`EXISTS (SELECT 1 FROM listing_documents d WHERE d.listing_id=l.id AND d.type<>'photo')`);
  if (f.source) conds.push(sql`EXISTS (SELECT 1 FROM listing_sources so WHERE so.listing_id=l.id AND so.source_connector_id = ${f.source})`);
  if (f.q) { const like = `%${f.q}%`; conds.push(sql`(l.title ILIKE ${like} OR l.description ILIKE ${like} OR l.summary ILIKE ${like})`); }
  const where = sql.join(conds, sql` AND `);

  const total = Number((await q(sql`SELECT COUNT(*) c FROM listings l WHERE ${where}`))[0].c);
  const order = sql.raw(SORTS[f.sort ?? "novy"] ?? SORTS.novy);
  const pageSize = 24;
  const page = Math.max(1, f.page ?? 1);
  const rows = await q(sql`
    SELECT ${L},
      (SELECT COUNT(*) FROM listing_sources so WHERE so.listing_id=l.id) AS "sourceCount",
      (SELECT COUNT(*) FROM listing_documents d WHERE d.listing_id=l.id AND d.type<>'photo') AS "docCount",
      ${PHOTO}
    FROM listings l WHERE ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
  return { rows, total };
}

export async function facets() {
  return {
    regions: await q(sql.raw(`SELECT region, COUNT(*) c FROM listings WHERE region IS NOT NULL AND status IN ('active','ended') GROUP BY region ORDER BY c DESC`)),
    saleTypes: await q(sql.raw(`SELECT sale_type AS "saleType", COUNT(*) c FROM listings WHERE sale_type IS NOT NULL AND status IN ('active','ended') GROUP BY sale_type ORDER BY c DESC`)),
    sources: await q(sql.raw(`SELECT c.id, c.name, COUNT(*) cnt FROM connectors c JOIN listing_sources so ON so.source_connector_id=c.id GROUP BY c.id, c.name ORDER BY cnt DESC`)),
  };
}

export async function topDeals(limit = 8): Promise<any[]> {
  return q(sql`SELECT ${L}, ${PHOTO} FROM listings l
    WHERE l.status='active' AND l.attractiveness_score IS NOT NULL
    ORDER BY l.attractiveness_score DESC LIMIT ${limit}`);
}

export async function getListing(slug: string) {
  const lrows = await q(sql`SELECT ${L} FROM listings l WHERE l.slug = ${slug} LIMIT 1`);
  const l = lrows[0];
  if (!l) return null;
  const id = l.id;
  const one = async (table: string) => (await q(sql.raw(`SELECT * FROM ${table} WHERE listing_id='${id.replace(/'/g, "''")}'`)))[0] ?? null;
  const vehicle = await one("vehicle_listings");
  const realEstate = await one("real_estate_listings");
  const movable = await one("movable_listings");
  const documents = await q(sql`SELECT id, type, title, file_url AS "fileUrl", created_at AS "createdAt" FROM listing_documents WHERE listing_id=${id} ORDER BY created_at`);
  const sources = await q(sql`SELECT so.source_connector_id AS "sourceConnectorId", so.source_external_id AS "sourceExternalId", so.first_seen_at AS "firstSeenAt", c.name AS "connectorName", c.source_type AS "sourceType" FROM listing_sources so LEFT JOIN connectors c ON c.id=so.source_connector_id WHERE so.listing_id=${id}`);
  const changes = await q(sql`SELECT field, old_value AS "oldValue", new_value AS "newValue", detected_at AS "detectedAt" FROM listing_changes WHERE listing_id=${id} ORDER BY detected_at DESC LIMIT 20`);
  return { l, vehicle, realEstate, movable, documents, sources, changes };
}

export async function reviewQueue(): Promise<any[]> {
  return q(sql`SELECT ${L} FROM listings l WHERE l.status='review' ORDER BY l.confidence_score ASC`);
}

export async function connectors(): Promise<any[]> {
  return q(sql.raw(`SELECT c.id, c.name, c.source_type AS "sourceType", c.source_url AS "sourceUrl", c.schedule,
    c.parser_version AS "parserVersion", c.priority, c.failure_count AS "failureCount",
    c.last_successful_run_at AS "lastSuccessfulRunAt",
    (SELECT COUNT(*) FROM listing_sources so WHERE so.source_connector_id=c.id) AS records
    FROM connectors c ORDER BY c.priority DESC, c.name`));
}

// Vyhledávání přirozeným jazykem (sekce 14)
export function parseQuery(input: string): Filters {
  const f: Filters = {};
  const raw = input.trim();
  if (!raw) return f;
  const low = stripDiacritics(raw).toLowerCase();
  if (/\b(auto|automobil|vuz|vozidlo|dodavka|skoda|octavia|superb|fabia|passat|bmw|audi|transit|sprinter)\b/.test(low)) f.category = "vehicle";
  else if (/\b(byt|dum|pozemek|nemovitost|garaz|parcela)\b/.test(low)) f.category = "real_estate";
  else if (/\b(stroj|elektronika|notebook|nabytek|material|vozik|sperk|prsten)\b/.test(low)) f.category = "movable_asset";
  for (const b of ["skoda", "volkswagen", "bmw", "audi", "ford", "mercedes", "toyota", "iveco", "renault", "peugeot"])
    if (low.includes(b)) { f.make = normalizeBrand(b); f.category = "vehicle"; break; }
  const m = low.match(/do\s+([\d\s.,]+)\s*(mil|tis)?/);
  if (m) {
    let val = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
    if (m[2] === "mil") val *= 1_000_000; else if (m[2] === "tis") val *= 1000; else if (val < 10000) val *= 1000;
    if (!Number.isNaN(val)) f.priceMax = Math.round(val);
  }
  const reg = normalizeRegion(raw);
  if (reg) f.region = reg;
  else {
    const stems: [string, string][] = [["brn", "Jihomoravský kraj"], ["ostrav", "Moravskoslezský kraj"], ["prah", "Hlavní město Praha"], ["plz", "Plzeňský kraj"], ["zlin", "Zlínský kraj"]];
    for (const [stem, region] of stems) if (low.includes(stem)) { f.region = region; break; }
  }
  if (!f.category && !f.make && !f.region && !f.priceMax) f.q = raw;
  return f;
}
