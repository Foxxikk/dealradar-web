import Link from "next/link";
import * as repo from "../lib/repo.js";
import { CATEGORY_LABEL } from "../lib/format.js";
import ListingCard from "./_components/ListingCard.js";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [s, deals] = await Promise.all([repo.stats(), repo.topDeals(8)]);
  const auto = s.total ? Math.round((s.autoPublished / s.total) * 1000) / 10 : 0;
  const tiles: [string, string, number][] = [
    ["vehicle", "🚗", s.vehicles], ["real_estate", "🏠", s.realEstate], ["movable_asset", "📦", s.movable],
  ];
  return (
    <>
      <section className="hero">
        <h1>Najděte výhodné nabídky dříve než ostatní.</h1>
        <p>Dražby, aukce a prodeje majetku z veřejných zdrojů přehledně na jednom místě.</p>
        <form className="searchbar" action="/katalog" method="get">
          <input name="q" placeholder="Např. byt Praha do 2 mil nebo Škoda do 150 tis" />
          <button>Hledat</button>
        </form>
        <div className="hero-hint">Vyhledávání rozumí přirozenému jazyku — zkuste „dodávka Ostrava“ nebo „zlaté šperky“.</div>
        <div className="stat-row">
          <div className="s"><b>{s.total.toLocaleString("cs-CZ")}</b> aktuálních nabídek</div>
          <div className="s"><b>{s.new24h}</b> nových za 24 h</div>
          <div className="s"><b>{auto} %</b> publikováno automaticky</div>
          <div className="s"><b>{s.withPhoto}</b> s fotografiemi</div>
        </div>
      </section>

      <div className="cat-tiles">
        {tiles.map(([cat, emoji, count]) => (
          <Link key={cat} href={`/katalog?category=${cat}`}>
            <span className="emoji">{emoji}</span>
            <span><span className="t">{CATEGORY_LABEL[cat]}</span><br /><span className="c">{count} nabídek</span></span>
          </Link>
        ))}
      </div>

      <div className="section-h"><h2>Jak to funguje</h2></div>
      <div className="steps">
        <div className="step"><div className="n">1</div><strong>Sbíráme veřejná data</strong><p>Konektory automaticky stahují nabídky z dražeb (zatím Finanční správa, dále ISIR, exekuce, ÚZSVM).</p></div>
        <div className="step"><div className="n">2</div><strong>Sjednocujeme a čistíme</strong><p>Z HTML i PDF vyhlášek těžíme cenu, odhad, fotky a kontakt, dedukujeme duplicity a hlídáme změny.</p></div>
        <div className="step"><div className="n">3</div><strong>Upozorníme vás</strong><p>Nastavte si alert a dáme vám vědět, jakmile se objeví příležitost podle vašich kritérií.</p></div>
      </div>

      <div className="section-h"><h2>Nejzajímavější příležitosti</h2><Link href="/katalog?sort=atraktivita">Zobrazit vše →</Link></div>
      {deals.length ? <div className="grid">{deals.map((r) => <ListingCard key={r.id} r={r} />)}</div>
        : <div className="empty">Zatím žádné nabídky — spusť import (`npm run import:rich`).</div>}

      <div className="alertbox" style={{ marginTop: 30 }}>
        <strong>Ukázka alertu</strong> — upozorníme vás e-mailem nebo push notifikací, jakmile se objeví:
        <code>{`Upozorni mě, když se objeví:
- Škoda Octavia nebo Superb
- do 180 000 Kč
- maximálně 150 km od Ostravy`}</code>
      </div>
    </>
  );
}
