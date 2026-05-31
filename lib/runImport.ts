import { sql } from "drizzle-orm";
import { ensureSchema, getDb } from "./db/client.js";
import * as s from "./db/schema.js";
import { FS_CONFIG, runFinancniSprava } from "./connectors/financni-sprava.js";
import { normalize } from "./pipeline/normalize.js";
import { ingest } from "./ingest.js";

export interface ImportSummary {
  ok: boolean;
  fetched: number;
  created: number;
  merged: number;
  archived: number;
  total: number;
  error?: string;
}

async function upsertConnector(ok: boolean) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(s.connectors).values({
    id: FS_CONFIG.id, name: FS_CONFIG.name, sourceType: FS_CONFIG.sourceType, sourceUrl: FS_CONFIG.sourceUrl,
    schedule: FS_CONFIG.schedule, isActive: true, parserVersion: FS_CONFIG.parserVersion,
    lastSuccessfulRunAt: ok ? now : null, lastFailureAt: ok ? null : now, failureCount: ok ? 0 : 1, priority: FS_CONFIG.priority,
  }).onConflictDoUpdate({
    target: s.connectors.id,
    set: { lastSuccessfulRunAt: ok ? now : sql`${s.connectors.lastSuccessfulRunAt}`, lastFailureAt: ok ? sql`${s.connectors.lastFailureAt}` : now, failureCount: ok ? 0 : 1 },
  });
}

export async function runImport(): Promise<ImportSummary> {
  await ensureSchema();
  const db = getDb();

  let records;
  try {
    records = await runFinancniSprava();
  } catch (e) {
    await upsertConnector(false);
    const total = Number((await db.execute(sql`SELECT COUNT(*) c FROM listings`) as any).rows?.[0]?.c ?? 0);
    return { ok: false, fetched: 0, created: 0, merged: 0, archived: 0, total, error: (e as Error).message };
  }

  let created = 0, merged = 0;
  for (const rec of records) {
    try {
      const res = await ingest(db, normalize(rec));
      if (res.action === "merged") merged++; else created++;
    } catch (e) {
      console.error(`ingest selhal: ${(e as Error).message}`);
    }
  }
  await upsertConnector(true);

  // archivace skončených (sekce 9.8) – ISO text porovnání funguje lexikograficky
  const now = new Date().toISOString();
  await db.execute(sql`UPDATE listings SET status='ended', updated_at=${now}
    WHERE deadline_at IS NOT NULL AND deadline_at < ${now} AND status IN ('active','review')`);

  const totalRes: any = await db.execute(sql`SELECT COUNT(*) c FROM listings`);
  const archRes: any = await db.execute(sql`SELECT COUNT(*) c FROM listings WHERE status='ended'`);
  const num = (r: any) => Number((Array.isArray(r) ? r : r.rows)[0].c);
  return { ok: true, fetched: records.length, created, merged, archived: num(archRes), total: num(totalRes) };
}
