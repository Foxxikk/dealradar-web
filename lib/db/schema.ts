import { pgTable, text, integer, boolean, doublePrecision, primaryKey } from "drizzle-orm/pg-core";

// Datový model (Postgres / Drizzle) – produkční varianta PoC.
// Časové údaje držíme jako ISO text (stejně jako v PoC) kvůli jednoduchosti portu.

export const connectors = pgTable("connectors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url").notNull(),
  schedule: text("schedule").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  parserVersion: text("parser_version").notNull(),
  lastSuccessfulRunAt: text("last_successful_run_at"),
  lastFailureAt: text("last_failure_at"),
  failureCount: integer("failure_count").notNull().default(0),
  priority: text("priority").notNull().default("medium"),
});

export const listings = pgTable("listings", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  saleType: text("sale_type"),
  status: text("status").notNull(),
  startingPrice: doublePrecision("starting_price"),
  estimatedPrice: doublePrecision("estimated_price"),
  currency: text("currency").notNull().default("CZK"),
  depositAmount: doublePrecision("deposit_amount"),
  publishedAt: text("published_at"),
  deadlineAt: text("deadline_at"),
  auctionAt: text("auction_at"),
  inspectionAt: text("inspection_at"),
  sourceFirstSeenAt: text("source_first_seen_at").notNull(),
  sourceLastCheckedAt: text("source_last_checked_at").notNull(),
  confidenceScore: integer("confidence_score").notNull().default(0),
  reviewReason: text("review_reason"),
  isPremium: boolean("is_premium").notNull().default(true),
  hasPhoto: boolean("has_photo").notNull().default(false),
  region: text("region"),
  district: text("district"),
  municipality: text("municipality"),
  address: text("address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  externalUrl: text("external_url"),
  contact: text("contact"),
  attractivenessScore: integer("attractiveness_score"),
  attractivenessReason: text("attractiveness_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const vehicleListings = pgTable("vehicle_listings", {
  listingId: text("listing_id").primaryKey().references(() => listings.id, { onDelete: "cascade" }),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  mileageKm: integer("mileage_km"),
  fuel: text("fuel"),
  transmission: text("transmission"),
  bodyType: text("body_type"),
  vin: text("vin"),
  powerKw: integer("power_kw"),
  firstRegistrationAt: text("first_registration_at"),
  condition: text("condition"),
});

export const realEstateListings = pgTable("real_estate_listings", {
  listingId: text("listing_id").primaryKey().references(() => listings.id, { onDelete: "cascade" }),
  propertyType: text("property_type"),
  areaSqm: doublePrecision("area_sqm"),
  landAreaSqm: doublePrecision("land_area_sqm"),
  ownershipType: text("ownership_type"),
  ownershipShare: text("ownership_share"),
  cadastralArea: text("cadastral_area"),
  titleDeedNumber: text("title_deed_number"),
  parcelNumbers: text("parcel_numbers"),
  occupancyStatus: text("occupancy_status"),
});

export const movableListings = pgTable("movable_listings", {
  listingId: text("listing_id").primaryKey().references(() => listings.id, { onDelete: "cascade" }),
  itemType: text("item_type"),
  condition: text("condition"),
  quantity: integer("quantity"),
  isBundle: boolean("is_bundle"),
  pickupLocation: text("pickup_location"),
  inspectionPossible: boolean("inspection_possible"),
});

export const listingDocuments = pgTable("listing_documents", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  type: text("type"),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  originalSourceUrl: text("original_source_url"),
  sha256: text("sha256"),
  extractedText: text("extracted_text"),
  createdAt: text("created_at").notNull(),
});

export const listingSources = pgTable("listing_sources", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  sourceConnectorId: text("source_connector_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceExternalId: text("source_external_id"),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  rawSnapshotId: text("raw_snapshot_id").notNull(),
});

export const listingChanges = pgTable("listing_changes", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  detectedAt: text("detected_at").notNull(),
  sourceUrl: text("source_url"),
  actor: text("actor").notNull().default("system"),
  connectorId: text("connector_id"),
});

export const dedupKeys = pgTable("dedup_keys", {
  listingId: text("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  keyType: text("key_type").notNull(),
  keyValue: text("key_value").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.keyType, t.keyValue, t.listingId] }) }));
