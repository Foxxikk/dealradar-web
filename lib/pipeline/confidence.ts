import type { NormalizedListing } from "../types.js";

const STABLE_SOURCES = new Set(["portal-drazeb", "uzsvm-majetek", "exekutorske-drazby", "financni-sprava"]);

// Confidence score dle bodové tabulky v sekci 9.5 PRD.
export function computeConfidence(n: NormalizedListing): { score: number; reasons: string[]; missing: string[] } {
  const l = n.listing;
  let score = 0;
  const reasons: string[] = [];
  const missing: string[] = [];

  if (STABLE_SOURCES.has(n.sourceRef.sourceConnectorId)) { score += 20; reasons.push("známý a stabilní zdroj (+20)"); }
  if (l.deadlineAt) { score += 15; reasons.push("vyplněný termín aukce (+15)"); } else missing.push("termín aukce");
  if (l.startingPrice) { score += 15; reasons.push("vyplněná cena (+15)"); } else missing.push("vyvolávací cena");
  if (l.externalUrl && /^https?:\/\//.test(l.externalUrl)) { score += 10; reasons.push("platný externí odkaz (+10)"); } else missing.push("externí odkaz");
  if (l.category !== "other") { score += 10; reasons.push("kategorie určena jednoznačně (+10)"); } else missing.push("jednoznačná kategorie");
  if (l.region) { score += 10; reasons.push("lokalita nalezena (+10)"); } else missing.push("lokalita (kraj)");
  if (n.documents.length > 0) { score += 10; reasons.push("dokumentace stažena (+10)"); }
  if (n.hasPhoto) { score += 5; reasons.push("fotografie dostupná (+5)"); }
  if (l.deadlineAt) { score += 5; reasons.push("validace data úspěšná (+5)"); }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons, missing };
}

export function publishDecision(score: number, missing: string[]): { status: "active" | "review"; reviewReason?: string; tag?: string } {
  if (score >= 85) return { status: "active" };
  if (score >= 60) return { status: "active", tag: "čeká na doplnění", reviewReason: missing.length ? `Chybí: ${missing.join(", ")}` : "Nižší confidence" };
  return { status: "review", reviewReason: missing.length ? `Chybí: ${missing.join(", ")}` : "Nízké confidence score" };
}

// Skóre atraktivity (sekce 15) – informativní, ne investiční doporučení.
export function computeAttractiveness(n: NormalizedListing): { score: number; reason: string } | null {
  const l = n.listing;
  let score = 40;
  let mainReason = "Orientační hodnocení podle úplnosti a parametrů nabídky.";
  if (l.startingPrice && l.estimatedPrice && l.estimatedPrice > l.startingPrice) {
    const discount = Math.round((1 - l.startingPrice / l.estimatedPrice) * 100);
    score += Math.min(40, discount);
    mainReason = `vyvolávací cena je o ${discount} % nižší než dostupný odhad`;
  }
  if (l.deadlineAt) {
    const days = (new Date(l.deadlineAt).getTime() - Date.now()) / 86400000;
    if (days > 0 && days < 60) score += 8;
  }
  if (n.documents.length > 0) score += 6;
  if (n.hasPhoto) score += 6;
  score = Math.max(0, Math.min(100, score));
  return { score, reason: mainReason };
}
