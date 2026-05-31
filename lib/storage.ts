import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Úložiště fotek: v produkci Vercel Blob (token v env), lokálně public/media.
// Vrací veřejnou URL obrázku.
export async function saveImage(key: string, bytes: Uint8Array, contentType = "image/png"): Promise<string> {
  const cleanKey = key.replace(/^\/+/, "");
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(cleanKey, Buffer.from(bytes), {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
    } as any);
    return url;
  }
  // na Vercelu je disk read-only – nepadej tiše na zápis na disk, řekni jasně proč
  if (process.env.VERCEL) {
    throw new Error("BLOB_READ_WRITE_TOKEN není nastaven – připoj Vercel Blob store a udělej Redeploy.");
  }
  // lokálně: public/media/... → Next servíruje na /media/...
  const path = join(process.cwd(), "public", cleanKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(bytes));
  return "/" + cleanKey;
}
