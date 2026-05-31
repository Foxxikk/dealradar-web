import { ensureSchema } from "../lib/db/client.js";

async function main() {
  await ensureSchema();
  console.log("✓ Databázové schéma připraveno.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
