import { NextResponse } from "next/server";
import { runImport } from "../../../../lib/runImport.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Hobby max 60 s; pro PDF-náročný import zvyš na vyšším tarifu

// Vercel Cron volá tento endpoint dle vercel.json. Pokud je nastaven CRON_SECRET,
// Vercel přidá hlavičku Authorization: Bearer <secret> a my ji ověříme.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await runImport();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
