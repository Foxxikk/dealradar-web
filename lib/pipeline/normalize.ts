import type { Category, ExtractedRecord, NormalizedListing, SaleType } from "../types.js";
import { clean, parseBool, parseDate, parseFloatSafe, parseIntSafe, parsePrice } from "./parse.js";
import { normalizeBrand, normalizeRegion, normalizeSaleType } from "../reference.js";
import { slugify, stripDiacritics, uuid } from "../util.js";

function inferCategory(hint?: string, f?: Record<string, string | undefined>): Category {
  if (hint === "vehicle" || hint === "real_estate" || hint === "movable_asset") return hint;
  if (f?.vin || f?.make) return "vehicle";
  if (f?.lv || f?.cadastralArea || f?.propertyType) return "real_estate";
  if (f?.itemType) return "movable_asset";
  return "other";
}

function digits(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function normalize(rec: ExtractedRecord): NormalizedListing {
  const f = rec.fields;
  const now = new Date().toISOString();
  const category = inferCategory(f.categoryHint, f);

  const title = clean(f.title) ?? "Nabídka bez názvu";
  const startingPrice = parsePrice(f.startingPrice);
  const estimatedPrice = parsePrice(f.estimatedPrice);
  const deposit = parsePrice(f.deposit);
  const deadlineAt = parseDate(f.deadline);
  const inspectionAt = parseDate(f.inspection);
  const region = normalizeRegion(f.region);
  const saleType = (normalizeSaleType(f.saleType) as SaleType | undefined) ?? undefined;

  const listingId = uuid();
  const subcategory = clean(f.propertyType) ?? clean(f.itemType) ?? clean(f.bodyType);

  const listing: NormalizedListing["listing"] = {
    id: listingId,
    slug: `${slugify(title)}-${listingId.slice(0, 6)}`,
    title,
    description: clean(f.description),
    category,
    subcategory,
    saleType,
    status: "draft",
    startingPrice,
    estimatedPrice,
    currency: (f.currency === "EUR" ? "EUR" : "CZK"),
    depositAmount: deposit,
    deadlineAt,
    auctionAt: deadlineAt,
    inspectionAt,
    sourceFirstSeenAt: rec.meta.fetchedAt,
    sourceLastCheckedAt: rec.meta.fetchedAt,
    confidenceScore: 0,
    isPremium: true,
    region,
    district: clean(f.district),
    municipality: clean(f.municipality),
    externalUrl: clean(f.externalUrl),
    contact: clean(f.contact),
    hasPhoto: rec.meta.hasPhoto === true,
    createdAt: now,
    updatedAt: now,
  };

  const out: NormalizedListing = {
    listing,
    documents: rec.meta.documents ?? [],
    hasPhoto: rec.meta.hasPhoto === true,
    sourceRef: {
      sourceConnectorId: rec.meta.sourceConnectorId,
      sourceUrl: rec.meta.sourceUrl,
      sourceExternalId: rec.meta.sourceExternalId,
      firstSeenAt: rec.meta.fetchedAt,
      lastSeenAt: rec.meta.fetchedAt,
      rawSnapshotId: rec.meta.rawSnapshotId,
    },
    dedupSignals: {},
  };

  if (category === "vehicle") {
    const vin = clean(f.vin)?.toUpperCase();
    out.vehicle = {
      listingId,
      make: normalizeBrand(f.make),
      model: clean(f.model),
      year: parseIntSafe(f.year),
      mileageKm: parseIntSafe(f.mileageKm),
      fuel: clean(f.fuel)?.toLowerCase(),
      transmission: clean(f.transmission)?.toLowerCase(),
      bodyType: clean(f.bodyType)?.toLowerCase(),
      vin,
      powerKw: parseIntSafe(f.powerKw),
    };
    out.dedupSignals.vin = vin && vin.length >= 11 ? vin : undefined;
  } else if (category === "real_estate") {
    const parcels = (f.parcels ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    out.realEstate = {
      listingId,
      propertyType: clean(f.propertyType),
      areaSqm: parseFloatSafe(f.areaSqm),
      landAreaSqm: parseFloatSafe(f.landAreaSqm),
      ownershipType: clean(f.ownershipType),
      ownershipShare: clean(f.ownershipShare),
      cadastralArea: clean(f.cadastralArea),
      titleDeedNumber: clean(f.lv),
      parcelNumbers: parcels.length ? parcels : undefined,
    };
    if (f.cadastralArea && f.lv) {
      out.dedupSignals.titleDeedKey = `${stripDiacritics(f.cadastralArea).toLowerCase().replace(/\s+/g, "")}|${digits(f.lv)}|${digits(f.parcels)}`;
    }
  } else if (category === "movable_asset") {
    out.movable = {
      listingId,
      itemType: clean(f.itemType),
      condition: clean(f.condition)?.toLowerCase(),
      quantity: parseIntSafe(f.quantity),
      isBundle: parseBool(f.isBundle),
      pickupLocation: clean(f.municipality) ?? clean(f.pickupLocation),
    };
  }

  // číslo dražební vyhlášky – silný cross-source signál
  if (f.noticeNo) out.dedupSignals.externalId = stripDiacritics(f.noticeNo).toUpperCase().replace(/[^A-Z0-9]/g, "");
  // fuzzy klíč – pro případy bez silného ID
  const core = stripDiacritics(title).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const bucket = startingPrice ? Math.round(startingPrice / 10000) : "x";
  const day = deadlineAt ? deadlineAt.slice(0, 10) : "x";
  out.dedupSignals.fuzzyKey = `${core}|${bucket}|${day}|${region ?? "x"}`;

  // shrnutí (reprezentuje krok „AI shrnutí"; zde deterministická šablona)
  out.listing.summary = buildSummary(out);
  return out;
}

function buildSummary(n: NormalizedListing): string {
  const l = n.listing;
  const parts: string[] = [];
  if (n.vehicle) {
    const v = n.vehicle;
    parts.push([v.make, v.model, v.year ? `(${v.year})` : "", v.fuel, v.mileageKm ? `${v.mileageKm.toLocaleString("cs-CZ")} km` : ""].filter(Boolean).join(" "));
  } else if (n.realEstate) {
    const r = n.realEstate;
    parts.push([r.propertyType, r.areaSqm ? `${r.areaSqm} m²` : "", r.ownershipShare && r.ownershipShare !== "1/1" ? `podíl ${r.ownershipShare}` : ""].filter(Boolean).join(", "));
  } else if (n.movable) {
    parts.push([n.movable.itemType, n.movable.quantity ? `${n.movable.quantity} ks` : "", n.movable.condition].filter(Boolean).join(", "));
  }
  if (l.startingPrice) {
    let p = `Vyvolávací cena ${l.startingPrice.toLocaleString("cs-CZ")} ${l.currency}`;
    if (l.estimatedPrice && l.estimatedPrice > l.startingPrice) {
      p += `, o ${Math.round((1 - l.startingPrice / l.estimatedPrice) * 100)} % pod odhadem`;
    }
    parts.push(p);
  }
  if (l.deadlineAt) parts.push(`termín ${l.deadlineAt.slice(0, 10)}`);
  if (l.region) parts.push(l.region);
  return parts.filter(Boolean).join(". ") + ".";
}
