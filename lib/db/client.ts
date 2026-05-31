import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

export type DB = PgliteDatabase<typeof schema>;

let _db: DB | undefined;

// Lokálně (bez DATABASE_URL) → pglite (Postgres ve WASM, soubor v ./.pgdata).
// Na Vercelu (s DATABASE_URL z Neonu) → postgres.js. Stejné Drizzle API.
export function getDb(): DB {
  if (_db) return _db;
  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
    _db = drizzlePg(client, { schema }) as unknown as DB;
  } else {
    const dir = process.env.PGLITE_DIR ?? "./.pgdata";
    _db = drizzlePglite(new PGlite(dir), { schema });
  }
  return _db;
}

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS connectors (
    id text PRIMARY KEY, name text NOT NULL, source_type text NOT NULL, source_url text NOT NULL,
    schedule text NOT NULL, is_active boolean NOT NULL DEFAULT true, parser_version text NOT NULL,
    last_successful_run_at text, last_failure_at text, failure_count integer NOT NULL DEFAULT 0,
    priority text NOT NULL DEFAULT 'medium')`,
  `CREATE TABLE IF NOT EXISTS listings (
    id text PRIMARY KEY, slug text NOT NULL, title text NOT NULL, description text, summary text,
    category text NOT NULL, subcategory text, sale_type text, status text NOT NULL,
    starting_price double precision, estimated_price double precision, currency text NOT NULL DEFAULT 'CZK',
    deposit_amount double precision, published_at text, deadline_at text, auction_at text, inspection_at text,
    source_first_seen_at text NOT NULL, source_last_checked_at text NOT NULL, confidence_score integer NOT NULL DEFAULT 0,
    review_reason text, is_premium boolean NOT NULL DEFAULT true, has_photo boolean NOT NULL DEFAULT false,
    region text, district text, municipality text, address text, latitude double precision, longitude double precision,
    external_url text, contact text, attractiveness_score integer, attractiveness_reason text,
    created_at text NOT NULL, updated_at text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS vehicle_listings (
    listing_id text PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    make text, model text, year integer, mileage_km integer, fuel text, transmission text,
    body_type text, vin text, power_kw integer, first_registration_at text, condition text)`,
  `CREATE TABLE IF NOT EXISTS real_estate_listings (
    listing_id text PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    property_type text, area_sqm double precision, land_area_sqm double precision, ownership_type text,
    ownership_share text, cadastral_area text, title_deed_number text, parcel_numbers text, occupancy_status text)`,
  `CREATE TABLE IF NOT EXISTS movable_listings (
    listing_id text PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    item_type text, condition text, quantity integer, is_bundle boolean, pickup_location text, inspection_possible boolean)`,
  `CREATE TABLE IF NOT EXISTS listing_documents (
    id text PRIMARY KEY, listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    type text, title text NOT NULL, file_url text NOT NULL, original_source_url text, sha256 text,
    extracted_text text, created_at text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS listing_sources (
    id text PRIMARY KEY, listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    source_connector_id text NOT NULL, source_url text NOT NULL, source_external_id text,
    first_seen_at text NOT NULL, last_seen_at text NOT NULL, raw_snapshot_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS listing_changes (
    id text PRIMARY KEY, listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    field text NOT NULL, old_value text, new_value text, detected_at text NOT NULL, source_url text,
    actor text NOT NULL DEFAULT 'system', connector_id text)`,
  `CREATE TABLE IF NOT EXISTS dedup_keys (
    listing_id text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    key_type text NOT NULL, key_value text NOT NULL, PRIMARY KEY (key_type, key_value, listing_id))`,
  `CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)`,
  `CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)`,
  `CREATE INDEX IF NOT EXISTS idx_listings_region ON listings(region)`,
  `CREATE INDEX IF NOT EXISTS idx_vehicle_vin ON vehicle_listings(vin)`,
  `CREATE INDEX IF NOT EXISTS idx_re_deed ON real_estate_listings(title_deed_number)`,
  `CREATE INDEX IF NOT EXISTS idx_docs_listing ON listing_documents(listing_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sources_listing ON listing_sources(listing_id)`,
];

export async function ensureSchema(): Promise<void> {
  const db = getDb();
  for (const stmt of DDL) await db.execute(sql.raw(stmt));
}
