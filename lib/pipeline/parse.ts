// Deterministická normalizační pravidla (sekce 9.4 PRD):
// převod ceny na číslo, převod data na ISO, čištění textu.

export function parsePrice(input?: string): number | undefined {
  if (!input) return undefined;
  let s = input.trim().toLowerCase();
  if (!s) return undefined;
  // odstranit měnu a balast
  s = s.replace(/kč|czk|eur|€|,-|,–|\bcca\b|od\s+|~/g, " ");
  // odstranit mezery (oddělovač tisíců) a tečky jako oddělovač tisíců
  // formáty: "1 250 000", "1.250.000", "150000", "150 000,50"
  s = s.replace(/\s+/g, "");
  // pokud obsahuje "," jako desetinnou: nahraď tečky (tisíce) prázdným a "," tečkou
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // tečky jsou oddělovače tisíců
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return Math.round(n);
}

const MONTHS: Record<string, number> = {
  ledna: 1, unora: 2, "února": 2, brezna: 3, "března": 3, dubna: 4,
  kvetna: 5, "května": 5, cervna: 6, "června": 6, cervence: 7, "července": 7,
  srpna: 8, zari: 9, "září": 9, rijna: 10, "října": 10, listopadu: 11, prosince: 12,
};

// Vrací ISO 8601 (UTC zjednodušeně) nebo undefined.
export function parseDate(input?: string): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;

  // ISO už: 2026-03-15 nebo 2026-03-15T10:00
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return iso(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);

  // 15.03.2026 nebo 15. 3. 2026 nebo 1.4.2026 10:00
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return iso(+m[3], +m[2], +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);

  // 15. března 2026
  m = s.match(/^(\d{1,2})\.\s*([a-zá-ž]+)\s+(\d{4})/i);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return iso(+m[3], month, +m[1]);
  }
  return undefined;
}

function iso(y: number, mo: number, d: number, h = 0, mi = 0): string | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString();
}

export function parseIntSafe(input?: string): number | undefined {
  if (!input) return undefined;
  const n = parseInt(input.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? undefined : n;
}

export function parseFloatSafe(input?: string): number | undefined {
  if (!input) return undefined;
  const s = input.replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

export function clean(input?: string): string | undefined {
  if (input == null) return undefined;
  const s = input.replace(/\s+/g, " ").trim();
  return s.length ? s : undefined;
}

export function parseBool(input?: string): boolean | undefined {
  if (input == null) return undefined;
  const s = input.toLowerCase().trim();
  if (["ano", "true", "1", "yes", "a"].includes(s)) return true;
  if (["ne", "false", "0", "no", "n"].includes(s)) return false;
  return undefined;
}
