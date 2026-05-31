import type { ExtractedRecord, SourceConnector } from "../types.js";
import { uuid } from "../util.js";
import { parseAuctionPdf } from "../pdf.js";
import { saveImage } from "../storage.js";

// ŽIVÝ konektor na Dražby Finanční správy (server-rendered HTML, veřejný vládní zdroj).
// Parsuje přes stabilní textové popisky; fotky z PDF ukládá přes storage (Blob/lokálně).

const BASE = "https://financnisprava.gov.cz/cs/financni-sprava/drazby-financni-spravy/drazby-prehled";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const HDRS = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "cs-CZ,cs;q=0.9" };

export const FS_CONFIG: SourceConnector = {
  id: "financni-sprava",
  name: "Dražby Finanční správy (živý HTML)",
  sourceType: "html",
  sourceUrl: BASE,
  schedule: "0 */2 * * *",
  isActive: true,
  parserVersion: "1.0.0",
  failureCount: 0,
  priority: "high",
};

function num(env: string | undefined, def: number): number {
  const n = env ? parseInt(env, 10) : NaN;
  return Number.isFinite(n) ? n : def;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getHtml(url: string, retries = 2): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, { headers: HDRS, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(800 * (attempt + 1));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

const REGION_MAP: [RegExp, string][] = [
  [/hlavní město prahu|hl\. m\. prahu|prahu/i, "Hlavní město Praha"],
  [/středočesk/i, "Středočeský kraj"], [/jihočesk/i, "Jihočeský kraj"], [/plzeňsk/i, "Plzeňský kraj"],
  [/karlovarsk/i, "Karlovarský kraj"], [/ústeck/i, "Ústecký kraj"], [/libereck/i, "Liberecký kraj"],
  [/královéhradeck/i, "Královéhradecký kraj"], [/pardubick/i, "Pardubický kraj"], [/vysočin/i, "Kraj Vysočina"],
  [/jihomoravsk/i, "Jihomoravský kraj"], [/olomouck/i, "Olomoucký kraj"], [/zlínsk/i, "Zlínský kraj"],
  [/moravskoslezsk/i, "Moravskoslezský kraj"],
];
function mapRegion(s?: string): string | undefined {
  if (!s) return undefined;
  for (const [re, canon] of REGION_MAP) if (re.test(s)) return canon;
  return undefined;
}
function detectCategory(title: string): "vehicle" | "real_estate" | "movable_asset" | "other" {
  const t = title.toLowerCase();
  if (/automobil|vozidl|motocykl|přívěs|návěs|traktor|osobní auto|nákladní|autobus|škoda|volkswagen|\bvw\b|bmw|audi|lancia|ford|peugeot|renault|fiat|iveco/.test(t)) return "vehicle";
  if (/pozemek|parcel|dům|byt\b|nemovit|stavb|garáž|jednotk|k\.ú\.|chata|chalup|objekt|spoluvlastnick/.test(t)) return "real_estate";
  return "movable_asset";
}

export function parseListIds(html: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = /app\/detail\/(\d+)\/APED/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (!seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
  return ids;
}

export function parseDetail(html: string, detailUrl: string, externalId: string): ExtractedRecord | null {
  const text = toText(html);
  const titleM = text.match(/Finanční úřad pro (.+?) oznamuje konání (?:veřejné )?dražby\s+(.+?)\s+Číslo jednací/i);
  const regionRaw = titleM?.[1];
  const title = titleM?.[2]?.trim();
  if (!title) return null;
  const cisloJednaci = text.match(/Číslo jednací:\s*([0-9A-Za-z][0-9A-Za-z\/\-]+)/i)?.[1];
  const priceRaw = text.match(/podání:\s*([\d  ., ]+)\s*Kč/i)?.[1];
  const dm = text.match(/Datum a čas:\s*(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})\s*od\s*(\d{1,2}:\d{2})/i);
  const misto = text.match(/Místo (?:vyzvednutí|prohlídky|konání)?:?\s*(.+?)(?:\s*(?:Stručný popis|Dražební vyhláška|Vstup do aplikace|Datum a čas|$))/i)?.[1];
  const electronic = /aplikace elektronických dražeb|Elektronická dražba/i.test(text);
  const pdf = html.match(/https:\/\/drazby\.fs\.gov\.cz\/handlers\/Vyhlaska\/\d+/)?.[0];
  const app = html.match(/https:\/\/drazby\.fs\.gov\.cz\/mwclient[^\s"')]+/)?.[0];
  const cadastral = title.match(/k\.\s*ú\.\s*([A-Za-zÁ-ž\s\-]+?)(?:,|$|\s{2})/i)?.[1]?.trim();

  const fields: Record<string, string | undefined> = {
    categoryHint: detectCategory(title), title,
    saleType: electronic ? "Elektronická dražba" : "Dražba",
    startingPrice: priceRaw, currency: "CZK", region: mapRegion(regionRaw) ?? regionRaw,
    deadline: dm ? `${dm[1]} ${dm[2]}` : undefined, externalUrl: detailUrl, noticeNo: cisloJednaci,
    cadastralArea: cadastral, pickupLocation: misto,
    description: `Dražba Finanční správy – ${title}. Pořadatel: Finanční úřad pro ${regionRaw ?? "?"}.`,
  };
  const documents: NonNullable<ExtractedRecord["meta"]["documents"]> = [];
  if (pdf) documents.push({ title: `Dražební vyhláška ${cisloJednaci ?? externalId}`, fileUrl: pdf, type: "auction_notice" });
  if (app) documents.push({ title: "Aplikace elektronických dražeb", fileUrl: app, type: "terms" });

  return {
    fields,
    meta: {
      sourceConnectorId: "financni-sprava", sourceUrl: detailUrl, sourceExternalId: externalId,
      rawSnapshotId: uuid(), rawText: text.slice(0, 4000), fetchedAt: new Date().toISOString(),
      documents, hasPhoto: false,
    },
  };
}

async function enrichWithPdf(rec: ExtractedRecord, delayMs: number): Promise<void> {
  const pdfDoc = (rec.meta.documents ?? []).find((d) => d.type === "auction_notice" && /Vyhlaska\/\d+|\.pdf/i.test(d.fileUrl));
  if (!pdfDoc) return;
  const res = await fetch(pdfDoc.fileUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`PDF HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const parsed = await parseAuctionPdf(buf, { maxImages: 6 });
  const f = rec.fields;
  if (parsed.fields.estimatedPrice) f.estimatedPrice = String(parsed.fields.estimatedPrice);
  if (parsed.fields.startingPrice) f.startingPrice = String(parsed.fields.startingPrice);
  if (parsed.fields.deposit != null) f.deposit = String(parsed.fields.deposit);
  if (parsed.fields.auctionEndAt) f.deadline = parsed.fields.auctionEndAt;
  const extra = [parsed.fields.designation, parsed.fields.inspection ? `Prohlídka: ${parsed.fields.inspection}` : "", parsed.fields.vatPercent != null ? `DPH ${parsed.fields.vatPercent} %` : ""].filter(Boolean).join(" · ");
  if (extra) f.description = extra;
  const contact = [parsed.fields.contactName, parsed.fields.contactPhone, parsed.fields.contactEmail].filter(Boolean).join(" · ");
  if (contact) f.contact = contact;
  pdfDoc.extractedText = parsed.text.slice(0, 4000);

  const extId = rec.meta.sourceExternalId ?? uuid();
  for (let k = 0; k < parsed.images.length; k++) {
    try {
      const url = await saveImage(`media/${extId}/photo_${k}.png`, parsed.images[k].png);
      rec.meta.documents!.push({ title: `Fotografie ${k + 1}`, fileUrl: url, type: "photo" });
    } catch (e) {
      console.error(`  [financni-sprava] uložení fotky selhalo: ${(e as Error).message}`);
    }
  }
  if (parsed.images.length) rec.meta.hasPhoto = true;
  await sleep(delayMs);
}

export async function runFinancniSprava(): Promise<ExtractedRecord[]> {
  const maxPages = num(process.env.FS_MAX_PAGES, 3);
  const maxItems = num(process.env.FS_MAX_ITEMS, 30);
  const delay = num(process.env.FS_DELAY_MS, 500);

  const ids: string[] = [];
  for (let page = 1; page <= maxPages && ids.length < maxItems; page++) {
    const listHtml = await getHtml(`${BASE}?page=${page}&stav=1`);
    const pageIds = parseListIds(listHtml).filter((id) => !ids.includes(id));
    if (pageIds.length === 0) break;
    ids.push(...pageIds);
    await sleep(delay);
  }
  const todo = ids.slice(0, maxItems);

  const records: ExtractedRecord[] = [];
  for (const id of todo) {
    const url = `${BASE}/app/detail/${id}/APED`;
    try {
      const rec = parseDetail(await getHtml(url), url, id);
      if (rec) records.push(rec);
    } catch (e) {
      console.error(`  [financni-sprava] detail ${id} selhal: ${(e as Error).message}`);
    }
    await sleep(delay);
  }

  if (process.env.FS_PARSE_PDF) {
    const pdfLimit = num(process.env.FS_PDF_LIMIT, 14);
    let done = 0;
    for (const rec of records) {
      if (done >= pdfLimit) break;
      try { await enrichWithPdf(rec, delay); done++; }
      catch (e) { console.error(`  [financni-sprava] PDF ${rec.meta.sourceExternalId} selhal: ${(e as Error).message}`); }
    }
    console.log(`  [financni-sprava] PDF obohaceno: ${done} nabídek`);
  }
  return records;
}
