import { runImport } from "../lib/runImport.js";

async function main() {
  console.log("Spouštím import z Finanční správy…");
  const r = await runImport();
  if (!r.ok) {
    console.log(`⚠️  Import se nezdařil: ${r.error}`);
    console.log(`   Katalog ponechán beze změny – v databázi je ${r.total} nabídek.`);
    process.exit(0);
  }
  console.log("\n=== Import dokončen ===");
  console.log(`  Stažených dražeb: ${r.fetched}`);
  console.log(`  Nově vloženo: ${r.created}, sloučeno (duplicity): ${r.merged}`);
  console.log(`  Skončených/archivovaných: ${r.archived}`);
  console.log(`  Celkem nabídek v DB: ${r.total}`);
  console.log("\nHotovo. Spusť `npm run dev` a otevři http://localhost:3000");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
