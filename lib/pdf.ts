import { parseDate } from "./pipeline/parse.js";

// Dokumentový parser (PRD typ C) pro dražební vyhlášky Finanční správy.
// Čistě JS/WASM (mupdf) – text i vložené fotografie, žádné nativní závislosti.

export interface PdfFields {
  estimatedPrice?: number; // Zjištěná cena (znalecký odhad)
  startingPrice?: number; // Nejnižší dražební podání
  minBid?: number; // Minimální příhoz
  deposit?: number; // Dražební jistota (0 = se nepožaduje)
  vatPercent?: number;
  inspection?: string; // termín/místo prohlídky
  auctionStartAt?: string; // ISO
  auctionEndAt?: string; // ISO
  designation?: string; // Označení dražené věci
  description?: string; // Popis dražené věci
  contactName?: string; // Vyřizuje
  contactPhone?: string; // Telefon
  contactEmail?: string; // Email
}

export interface PdfImage {
  png: Uint8Array;
  w: number;
  h: number;
}

export interface PdfResult {
  text: string;
  fields: PdfFields;
  images: PdfImage[];
}

function cleanNum(s?: string): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s.replace(/[\s   .]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}
function norm(s: string): string {
  return s.replace(/ /g, " ").replace(/[ \t]+/g, " ");
}

export async function parseAuctionPdf(buf: Uint8Array, opts: { maxImages?: number; minW?: number; minH?: number } = {}): Promise<PdfResult> {
  const mupdf: any = await import("mupdf");
  const doc = mupdf.Document.openDocument(buf, "application/pdf");
  const pages = doc.countPages();
  const maxImages = opts.maxImages ?? 6;
  const minW = opts.minW ?? 220;
  const minH = opts.minH ?? 150;

  let text = "";
  const images: PdfImage[] = [];
  for (let i = 0; i < pages; i++) {
    const page = doc.loadPage(i);
    const st = page.toStructuredText("preserve-whitespace,preserve-images");
    text += st.asText() + "\n";
    st.walk({
      onImageBlock(_bbox: unknown, _ctm: unknown, image: any) {
        if (images.length >= maxImages) return;
        try {
          const pix = image.toPixmap();
          const w = pix.getWidth();
          const h = pix.getHeight();
          if (w >= minW && h >= minH) images.push({ png: pix.asPNG(), w, h });
        } catch {
          /* přeskoč nedekódovatelný obrázek */
        }
      },
    });
  }

  const t = norm(text);
  const grab = (re: RegExp) => re.exec(t)?.[1]?.trim();
  const fields: PdfFields = {
    estimatedPrice: cleanNum(grab(/Zji[sš]t[ěe]n[áa] cena v K[čc]:?\s*([\d  ]+)/i)),
    startingPrice: cleanNum(grab(/Nejni[žz][sš][íi] dra[žz]ebn[íi] pod[áa]n[íi] v K[čc]:?\s*([\d  ]+)/i)),
    minBid: cleanNum(grab(/Minim[áa]ln[íi] p[řr][íi]hoz v K[čc]:?\s*([\d  ]+)/i)),
    vatPercent: cleanNum(grab(/V[čc]etn[ěe] DPH[^:]*:?\s*(\d+)/i)),
    inspection: grab(/prohl[íi]dky[^:]*:?\s*([^\n]+?)(?:\s*Podm[íi]nky|\n)/i),
    designation: grab(/Ozna[čc]en[íi] dra[žz]en[ée] v[ěe]ci:?\s*([^\n]+)/i),
    description: grab(/Popis dra[žz]en[ée] v[ěe]ci[^:]*:?\s*([^\n]+)/i),
    contactName: grab(/Vy[řr]izuje:?\s*([^\n]+?)\s*(?:Telefon|Email|E-mail|$)/i),
    contactPhone: grab(/Telefon:?\s*([+\d  ]{6,})/i)?.replace(/\s+/g, ""),
    contactEmail: grab(/E-?mail:?\s*([^\s,;]+@[^\s,;]+)/i),
  };

  const depNum = cleanNum(grab(/Dra[žz]ebn[íi] jistota v K[čc]:?\s*([\d  ]+)/i));
  if (depNum != null) fields.deposit = depNum;
  else if (/jistota se nepo[žz]aduje/i.test(t)) fields.deposit = 0;

  const sm = t.match(/zah[áa]jen[íi] dra[žz]by:?\s*([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})(?:\s*v?\s*([0-9]{1,2}:[0-9]{2}))?/i);
  if (sm) fields.auctionStartAt = parseDate(`${sm[1]}${sm[2] ? ` ${sm[2]}` : ""}`);
  const em = t.match(/ukon[čc]en[íi] dra[žz]by:?\s*([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})(?:\s*v?\s*([0-9]{1,2}:[0-9]{2}))?/i);
  if (em) fields.auctionEndAt = parseDate(`${em[1]}${em[2] ? ` ${em[2]}` : ""}`);

  return { text: t, fields, images };
}
