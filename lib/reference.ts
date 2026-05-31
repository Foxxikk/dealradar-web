import { stripDiacritics } from "./util.js";

// Kanonické kraje ČR + aliasy (sjednocení dle sekce 9.4 PRD).
export const REGIONS: { canonical: string; aliases: string[] }[] = [
  { canonical: "Hlavní město Praha", aliases: ["praha", "hl m praha", "hlavni mesto praha", "pha"] },
  { canonical: "Středočeský kraj", aliases: ["stredocesky", "stc", "stredocesky kraj"] },
  { canonical: "Jihočeský kraj", aliases: ["jihocesky", "jhc", "jihocesky kraj"] },
  { canonical: "Plzeňský kraj", aliases: ["plzensky", "plk", "plzensky kraj"] },
  { canonical: "Karlovarský kraj", aliases: ["karlovarsky", "kvk", "karlovarsky kraj"] },
  { canonical: "Ústecký kraj", aliases: ["ustecky", "ulk", "ustecky kraj"] },
  { canonical: "Liberecký kraj", aliases: ["liberecky", "lbk", "liberecky kraj"] },
  { canonical: "Královéhradecký kraj", aliases: ["kralovehradecky", "hkk", "kralovehradecky kraj"] },
  { canonical: "Pardubický kraj", aliases: ["pardubicky", "pak", "pardubicky kraj"] },
  { canonical: "Kraj Vysočina", aliases: ["vysocina", "vys", "kraj vysocina"] },
  { canonical: "Jihomoravský kraj", aliases: ["jihomoravsky", "jmk", "jihomoravsky kraj", "brno"] },
  { canonical: "Olomoucký kraj", aliases: ["olomoucky", "olk", "olomoucky kraj"] },
  { canonical: "Zlínský kraj", aliases: ["zlinsky", "zlk", "zlinsky kraj"] },
  { canonical: "Moravskoslezský kraj", aliases: ["moravskoslezsky", "msk", "moravskoslezsky kraj", "ostrava"] },
];

export function normalizeRegion(input?: string): string | undefined {
  if (!input) return undefined;
  const key = stripDiacritics(input).toLowerCase().trim();
  for (const r of REGIONS) {
    if (stripDiacritics(r.canonical).toLowerCase() === key) return r.canonical;
    if (r.aliases.some((a) => key === a || key.includes(a))) return r.canonical;
  }
  return undefined;
}

// Sjednocení názvů značek vozidel (diakritika + překlepy).
const BRAND_MAP: Record<string, string> = {
  skoda: "Škoda",
  "škoda": "Škoda",
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  mb: "Mercedes-Benz",
  bmw: "BMW",
  audi: "Audi",
  ford: "Ford",
  peugeot: "Peugeot",
  renault: "Renault",
  citroen: "Citroën",
  "citroën": "Citroën",
  toyota: "Toyota",
  hyundai: "Hyundai",
  kia: "Kia",
  fiat: "Fiat",
  opel: "Opel",
  iveco: "Iveco",
  man: "MAN",
  tatra: "Tatra",
};

export function normalizeBrand(input?: string): string | undefined {
  if (!input) return undefined;
  const key = stripDiacritics(input).toLowerCase().trim();
  return BRAND_MAP[key] ?? capitalize(input.trim());
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export const SALE_TYPE_MAP: Record<string, string> = {
  drazba: "auction",
  "dražba": "auction",
  "verejna drazba": "auction",
  "elektronicka drazba": "electronic_auction",
  "e-drazba": "electronic_auction",
  eaukce: "electronic_auction",
  "elektronicka aukce": "electronic_auction",
  aukce: "electronic_auction",
  vyberove_rizeni: "tender",
  "vyberove rizeni": "tender",
  vrtr: "tender",
  prodej: "direct_sale",
  "primy prodej": "direct_sale",
  "primy prodej majetku": "direct_sale",
};

export function normalizeSaleType(input?: string): string | undefined {
  if (!input) return undefined;
  const key = stripDiacritics(input).toLowerCase().trim();
  return SALE_TYPE_MAP[key];
}
