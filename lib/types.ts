// Datový model dle sekce 11 PRD (DealRadar)

export type Category = "vehicle" | "real_estate" | "movable_asset" | "other";

export type SaleType =
  | "auction"
  | "electronic_auction"
  | "tender"
  | "direct_sale"
  | "other";

export type ListingStatus =
  | "draft"
  | "review"
  | "active"
  | "updated"
  | "ended"
  | "cancelled"
  | "archived";

export interface Listing {
  id: string;
  slug: string;
  title: string;
  description?: string;
  summary?: string;
  category: Category;
  subcategory?: string;
  saleType?: SaleType;
  status: ListingStatus;
  startingPrice?: number;
  estimatedPrice?: number;
  currency: "CZK" | "EUR";
  depositAmount?: number;
  publishedAt?: string; // ISO
  deadlineAt?: string; // ISO
  auctionAt?: string; // ISO
  inspectionAt?: string; // ISO
  sourceFirstSeenAt: string;
  sourceLastCheckedAt: string;
  confidenceScore: number;
  reviewReason?: string; // proč je ve frontě / co chybí
  isPremium: boolean;
  region?: string;
  district?: string;
  municipality?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  externalUrl?: string;
  contact?: string;
  hasPhoto?: boolean;
  attractivenessScore?: number;
  attractivenessReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleListing {
  listingId: string;
  make?: string;
  model?: string;
  year?: number;
  mileageKm?: number;
  fuel?: string;
  transmission?: string;
  bodyType?: string;
  vin?: string;
  powerKw?: number;
  firstRegistrationAt?: string;
  condition?: string;
}

export interface RealEstateListing {
  listingId: string;
  propertyType?: string;
  areaSqm?: number;
  landAreaSqm?: number;
  ownershipType?: string;
  ownershipShare?: string;
  cadastralArea?: string;
  titleDeedNumber?: string;
  parcelNumbers?: string[];
  occupancyStatus?: string;
}

export interface MovableAssetListing {
  listingId: string;
  itemType?: string;
  condition?: string;
  quantity?: number;
  isBundle?: boolean;
  pickupLocation?: string;
  inspectionPossible?: boolean;
}

export interface ListingDocument {
  id: string;
  listingId: string;
  type?: "auction_notice" | "expert_opinion" | "photo" | "terms" | "other";
  title: string;
  fileUrl: string;
  originalSourceUrl?: string;
  sha256?: string;
  extractedText?: string;
  createdAt: string;
}

export interface ListingSourceReference {
  id: string;
  listingId: string;
  sourceConnectorId: string;
  sourceUrl: string;
  sourceExternalId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  rawSnapshotId: string;
}

export interface ListingChange {
  id: string;
  listingId: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  detectedAt: string;
  sourceUrl?: string;
  actor: "system" | "human";
  connectorId?: string;
}

export type SourceType = "api" | "csv" | "xlsx" | "html" | "pdf" | "email" | "manual";

export interface SourceConnector {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceUrl: string;
  schedule: string;
  isActive: boolean;
  parserVersion: string;
  lastSuccessfulRunAt?: string;
  lastFailureAt?: string;
  failureCount: number;
  priority: "high" | "medium" | "low";
}

// Záznam vystupující z konektoru – surová, ještě neznormalizovaná data.
export interface ExtractedRecord {
  // libovolná pole, jak je dodá konektor (klíče dle daného zdroje)
  fields: Record<string, string | undefined>;
  meta: {
    sourceConnectorId: string;
    sourceUrl: string;
    sourceExternalId?: string;
    rawSnapshotId: string;
    rawText: string;
    fetchedAt: string;
    documents?: { title: string; fileUrl: string; type?: ListingDocument["type"]; extractedText?: string }[];
    hasPhoto?: boolean;
  };
}

// Normalizovaná nabídka před uložením (Listing + případné specializace).
export interface NormalizedListing {
  listing: Listing;
  vehicle?: VehicleListing;
  realEstate?: RealEstateListing;
  movable?: MovableAssetListing;
  documents: { title: string; fileUrl: string; type?: ListingDocument["type"]; extractedText?: string }[];
  hasPhoto: boolean;
  sourceRef: Omit<ListingSourceReference, "id" | "listingId">;
  // signály pro deduplikaci
  dedupSignals: {
    externalId?: string;
    vin?: string;
    titleDeedKey?: string; // LV + katastr + parcela
    fuzzyKey?: string; // titul+cena+termín
  };
}
