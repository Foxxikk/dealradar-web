import { and, eq } from "drizzle-orm";
import type { DB } from "./db/client.js";
import * as s from "./db/schema.js";
import type { Listing, NormalizedListing } from "./types.js";
import { uuid } from "./util.js";
import { computeAttractiveness, computeConfidence, publishDecision } from "./pipeline/confidence.js";

export type IngestResult = { action: "created" | "merged"; listingId: string };

function dedupEntries(n: NormalizedListing): { type: string; value: string }[] {
  const d = n.dedupSignals;
  const out: { type: string; value: string }[] = [];
  if (d.vin) out.push({ type: "vin", value: d.vin });
  if (d.titleDeedKey) out.push({ type: "titleDeed", value: d.titleDeedKey });
  if (d.externalId) out.push({ type: "notice", value: d.externalId });
  if (d.fuzzyKey) out.push({ type: "fuzzy", value: d.fuzzyKey });
  return out;
}

async function findDuplicate(db: DB, n: NormalizedListing): Promise<string | null> {
  for (const e of dedupEntries(n)) {
    if (e.type === "fuzzy" && (n.dedupSignals.vin || n.dedupSignals.titleDeedKey)) continue;
    const rows = await db.select({ id: s.dedupKeys.listingId }).from(s.dedupKeys)
      .where(and(eq(s.dedupKeys.keyType, e.type), eq(s.dedupKeys.keyValue, e.value))).limit(1);
    if (rows.length) return rows[0].id;
  }
  return null;
}

async function insertDedupKeys(db: DB, listingId: string, n: NormalizedListing): Promise<void> {
  for (const e of dedupEntries(n)) {
    await db.insert(s.dedupKeys).values({ listingId, keyType: e.type, keyValue: e.value }).onConflictDoNothing();
  }
}

async function addSourceRef(db: DB, listingId: string, n: NormalizedListing): Promise<void> {
  const existing = await db.select({ id: s.listingSources.id }).from(s.listingSources)
    .where(and(eq(s.listingSources.listingId, listingId), eq(s.listingSources.sourceConnectorId, n.sourceRef.sourceConnectorId))).limit(1);
  if (existing.length) {
    await db.update(s.listingSources).set({ lastSeenAt: n.sourceRef.lastSeenAt }).where(eq(s.listingSources.id, existing[0].id));
    return;
  }
  await db.insert(s.listingSources).values({
    id: uuid(), listingId, sourceConnectorId: n.sourceRef.sourceConnectorId, sourceUrl: n.sourceRef.sourceUrl,
    sourceExternalId: n.sourceRef.sourceExternalId, firstSeenAt: n.sourceRef.firstSeenAt,
    lastSeenAt: n.sourceRef.lastSeenAt, rawSnapshotId: n.sourceRef.rawSnapshotId,
  });
}

async function insertSpecialization(db: DB, n: NormalizedListing, listingId: string): Promise<void> {
  if (n.vehicle) {
    const v = n.vehicle;
    await db.insert(s.vehicleListings).values({ listingId, make: v.make, model: v.model, year: v.year, mileageKm: v.mileageKm, fuel: v.fuel, transmission: v.transmission, bodyType: v.bodyType, vin: v.vin, powerKw: v.powerKw, firstRegistrationAt: v.firstRegistrationAt, condition: v.condition }).onConflictDoNothing();
  }
  if (n.realEstate) {
    const r = n.realEstate;
    await db.insert(s.realEstateListings).values({ listingId, propertyType: r.propertyType, areaSqm: r.areaSqm, landAreaSqm: r.landAreaSqm, ownershipType: r.ownershipType, ownershipShare: r.ownershipShare, cadastralArea: r.cadastralArea, titleDeedNumber: r.titleDeedNumber, parcelNumbers: r.parcelNumbers?.join(", "), occupancyStatus: r.occupancyStatus }).onConflictDoNothing();
  }
  if (n.movable) {
    const m = n.movable;
    await db.insert(s.movableListings).values({ listingId, itemType: m.itemType, condition: m.condition, quantity: m.quantity, isBundle: m.isBundle, pickupLocation: m.pickupLocation, inspectionPossible: m.inspectionPossible }).onConflictDoNothing();
  }
}

async function insertDocuments(db: DB, listingId: string, n: NormalizedListing): Promise<void> {
  for (const d of n.documents) {
    // idempotence: nepřidávej stejný dokument/fotku znovu (opakovaný běh cronu)
    const exists = await db.select({ id: s.listingDocuments.id }).from(s.listingDocuments)
      .where(and(eq(s.listingDocuments.listingId, listingId), eq(s.listingDocuments.fileUrl, d.fileUrl))).limit(1);
    if (exists.length) continue;
    await db.insert(s.listingDocuments).values({ id: uuid(), listingId, type: d.type, title: d.title, fileUrl: d.fileUrl, originalSourceUrl: d.fileUrl, extractedText: d.extractedText, createdAt: new Date().toISOString() });
  }
}

export async function ingest(db: DB, norm: NormalizedListing): Promise<IngestResult> {
  const conf = computeConfidence(norm);
  norm.listing.confidenceScore = conf.score;
  const attr = computeAttractiveness(norm);
  if (attr) { norm.listing.attractivenessScore = attr.score; norm.listing.attractivenessReason = attr.reason; }

  const dupId = await findDuplicate(db, norm);
  if (dupId) {
    await mergeInto(db, dupId, norm);
    await addSourceRef(db, dupId, norm);
    await insertDedupKeys(db, dupId, norm);
    return { action: "merged", listingId: dupId };
  }

  const decision = publishDecision(conf.score, conf.missing);
  norm.listing.status = decision.status;
  norm.listing.reviewReason = decision.reviewReason;

  const l = norm.listing;
  await db.insert(s.listings).values({
    id: l.id, slug: l.slug, title: l.title, description: l.description, summary: l.summary, category: l.category,
    subcategory: l.subcategory, saleType: l.saleType, status: l.status, startingPrice: l.startingPrice,
    estimatedPrice: l.estimatedPrice, currency: l.currency, depositAmount: l.depositAmount, publishedAt: l.publishedAt,
    deadlineAt: l.deadlineAt, auctionAt: l.auctionAt, inspectionAt: l.inspectionAt, sourceFirstSeenAt: l.sourceFirstSeenAt,
    sourceLastCheckedAt: l.sourceLastCheckedAt, confidenceScore: l.confidenceScore, reviewReason: l.reviewReason,
    isPremium: l.isPremium, hasPhoto: l.hasPhoto ?? false, region: l.region, district: l.district, municipality: l.municipality,
    address: l.address, latitude: l.latitude, longitude: l.longitude, externalUrl: l.externalUrl, contact: l.contact,
    attractivenessScore: l.attractivenessScore, attractivenessReason: l.attractivenessReason, createdAt: l.createdAt, updatedAt: l.updatedAt,
  });
  await insertSpecialization(db, norm, l.id);
  await insertDocuments(db, l.id, norm);
  await insertDedupKeys(db, l.id, norm);
  await addSourceRef(db, l.id, norm);
  return { action: "created", listingId: l.id };
}

async function mergeInto(db: DB, listingId: string, norm: NormalizedListing): Promise<void> {
  const rows = await db.select().from(s.listings).where(eq(s.listings.id, listingId)).limit(1);
  const existing = rows[0] as any;
  if (!existing) return;
  const fillable: (keyof Listing)[] = ["description", "summary", "subcategory", "saleType", "startingPrice", "estimatedPrice", "depositAmount", "deadlineAt", "auctionAt", "inspectionAt", "region", "district", "municipality", "externalUrl", "contact"];
  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();
  for (const f of fillable) {
    const cur = existing[f];
    const inc = (norm.listing as any)[f];
    if ((cur === null || cur === undefined || cur === "") && inc != null) {
      updates[f] = inc;
      await db.insert(s.listingChanges).values({ id: uuid(), listingId, field: String(f), oldValue: cur != null ? String(cur) : null, newValue: String(inc), detectedAt: now, sourceUrl: norm.sourceRef.sourceUrl, actor: "system", connectorId: norm.sourceRef.sourceConnectorId });
    }
  }
  if (norm.listing.confidenceScore > (existing.confidenceScore ?? 0)) {
    updates.confidenceScore = norm.listing.confidenceScore;
    if (existing.status === "review" && norm.listing.confidenceScore >= 60) { updates.status = "active"; updates.reviewReason = null; }
  }
  if (norm.hasPhoto && !existing.hasPhoto) updates.hasPhoto = true;
  updates.sourceLastCheckedAt = now;
  updates.updatedAt = now;
  await db.update(s.listings).set(updates).where(eq(s.listings.id, listingId));

  // doplň chybějící specializaci + dokumenty (fotky z dalšího zdroje)
  await insertSpecialization(db, norm, listingId);
  await insertDocuments(db, listingId, norm);
}
