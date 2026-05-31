export function fmtPrice(n: unknown, currency = "CZK"): string {
  if (n == null || n === "") return "—";
  return `${Number(n).toLocaleString("cs-CZ")} ${currency === "EUR" ? "€" : "Kč"}`;
}
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
}
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}
export function daysTo(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}
export const CATEGORY_LABEL: Record<string, string> = {
  vehicle: "Vozidla", real_estate: "Nemovitosti", movable_asset: "Movité věci", other: "Ostatní",
};
export const SALE_TYPE_LABEL: Record<string, string> = {
  auction: "Dražba", electronic_auction: "Elektronická dražba", tender: "Výběrové řízení", direct_sale: "Přímý prodej", other: "Jiné",
};
export function thumbEmoji(cat: string): string {
  return ({ vehicle: "🚗", real_estate: "🏠", movable_asset: "📦", other: "🔖" } as Record<string, string>)[cat] ?? "🔖";
}
export function discountPct(r: { startingPrice?: number; estimatedPrice?: number }): number | null {
  return r.estimatedPrice && r.startingPrice && r.estimatedPrice > r.startingPrice
    ? Math.round((1 - r.startingPrice / r.estimatedPrice) * 100) : null;
}
