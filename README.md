# DealRadar – produkční web (Next.js + Postgres + Vercel)

Produkční verze agregátoru dražeb. Oproti PoC běží na cílové architektuře z PRD:

| Vrstva | Řešení |
|---|---|
| Frontend + backend | **Next.js 14** (App Router, server components) |
| Databáze | **PostgreSQL** – lokálně vestavěný **pglite**, v produkci **Neon** (přes `DATABASE_URL`) |
| ORM | **Drizzle** (stejné schéma pro pglite i Postgres) |
| Úložiště fotek | **Vercel Blob** v produkci, lokálně `public/media` |
| Scraper | **Vercel Cron** → `/api/cron/import` (FS konektor + PDF parser + pipeline) |
| Datová pipeline | přenesena z PoC: normalizace, dedup, confidence, PDF (mupdf) |

Jeden reálný zdroj: **Dražby Finanční správy** (server-rendered HTML + PDF vyhlášky → cena, odhad, jistota, kontakt, fotky).

---

## Lokální spuštění (bez jakékoli databáze)

Vyžaduje Node ≥ 20. Lokálně se použije **pglite** (Postgres ve WASM, data v `./.pgdata`) – netřeba nic instalovat ani nastavovat.

```bash
npm install
npm run db:push        # vytvoří schéma
npm run import:rich    # stáhne reálné dražby z Finanční správy + PDF (cena, kontakt, fotky)
npm run dev            # http://localhost:3000
```

`npm run import` (bez `:rich`) je rychlejší – jen seznam dražeb bez stahování PDF.

---

## Nasazení na Vercel

### 1) GitHub
```bash
git init && git add . && git commit -m "DealRadar web"
git branch -M main
# pak buď: gh repo create dealradar-web --private --source=. --push
# nebo přidej remote a: git push -u origin main
```

### 2) Databáze – Neon (zdarma)
1. Na [neon.tech](https://neon.tech) založ projekt → zkopíruj **pooled** connection string (`postgresql://…?sslmode=require`).
2. Ve Vercelu (Project → Settings → Environment Variables) nastav `DATABASE_URL` na tento string.
   - Případně použij integraci **Vercel → Storage → Neon**, která `DATABASE_URL` nastaví sama.

### 3) Úložiště fotek – Vercel Blob
1. Vercel → Storage → **Blob** → Create. Vercel přidá `BLOB_READ_WRITE_TOKEN` do env.

### 4) Cron + secret
1. Nastav env `CRON_SECRET` na libovolný náhodný řetězec. Vercel jím automaticky podepisuje volání cronu.
2. `vercel.json` už obsahuje plán `0 */2 * * *` (každé 2 h) pro `/api/cron/import`.

### 5) Import na Vercelu
- Po prvním deployi databáze ještě nemá data. Schéma se vytvoří automaticky při prvním běhu importu (`ensureSchema`).
- Spusť import ručně (jednorázově) zavoláním cronu, nebo počkej na naplánovaný běh:
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<tvuj-projekt>.vercel.app/api/cron/import
  ```

### Poznámka k limitům
- **PDF parsing je náročný.** Na tarifu Hobby má funkce limit 60 s; stahování mnoha PDF se nemusí vejít. Pro cron drž `FS_PDF_LIMIT` nízko (např. 6–10), nebo zapni `FS_PARSE_PDF` až na vyšším tarifu (kde lze `maxDuration` zvednout). Bez PDF (`FS_PARSE_PDF` nenastaveno) import zvládne i Hobby.
- Scraping veřejného webu má právní mantinely (podmínky služby, frekvence) – konektor posílá identifikující se chování a má prodlevy. Frekvenci a objem řiď přes env (`FS_MAX_ITEMS`, `FS_DELAY_MS`).

---

## Konfigurace (env)

Viz `.env.example`. Lokálně stačí nechat prázdné (pglite + lokální fotky). V produkci nastav `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`.

## Struktura

```
app/                  Next.js stránky (homepage, katalog, detail, admin) + /api/cron/import
lib/db/               Drizzle schéma + klient (pglite/Neon) + ensureSchema
lib/pipeline/         parse, normalize, confidence (přeneseno z PoC)
lib/pdf.ts            dokumentový parser (mupdf) – text + fotky z PDF vyhlášek
lib/connectors/       konektor Finanční správy (HTML + PDF → storage)
lib/ingest.ts         dedup + ukládání (Drizzle)
lib/repo.ts           čtecí dotazy + vyhledávání přirozeným jazykem
lib/storage.ts        fotky: Vercel Blob / public/media
scripts/              migrate.ts, import.ts (CLI)
```

## Co bylo ověřeno
- Kompilace Next (`✓ Compiled successfully`) a TypeScript type-check.
- Datová vrstva proti reálnému Postgresu (pglite): schéma, ingest, **deduplikace**, čtení katalogu/detailu, PDF extrakce (cena, kontakt, fotky), vyhledávání přirozeným jazykem.

## Další kroky (roadmapa)
- Druhý reálný zdroj (ISIR – open data / SOAP) přes stejné rozhraní konektoru.
- Uživatelské účty, sledované nabídky, alerty (e-mail přes Resend), předplatné (Stripe).
- Fulltext/geo vyhledávání (Postgres `pg_trgm` / PostGIS nebo Meilisearch).
