import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "DealRadar – výhodné nabídky z dražeb a aukcí",
  description: "Dražby, aukce a prodeje majetku z veřejných zdrojů přehledně na jednom místě.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <header className="topbar">
          <Link className="logo" href="/">📡 DealRadar <span className="poc">živě</span></Link>
          <nav className="mainnav">
            <Link href="/katalog">Katalog</Link>
            <Link href="/katalog?category=vehicle">Vozidla</Link>
            <Link href="/katalog?category=real_estate">Nemovitosti</Link>
            <Link href="/katalog?category=movable_asset">Movité věci</Link>
            <Link href="/admin">Administrace</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="foot">
          <div><strong>DealRadar</strong> — agregátor veřejných dražeb. Zdroj dat: Dražby Finanční správy.</div>
          <div className="disclaimer">Informace pocházejí z veřejně dostupných zdrojů a slouží k orientaci. Před účastí v dražbě si vždy ověřte aktuální podmínky na původním zdroji. Platforma není organizátorem dražby ani garantem výsledku.</div>
        </footer>
      </body>
    </html>
  );
}
