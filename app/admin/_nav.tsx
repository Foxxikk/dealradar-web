import Link from "next/link";

export default function AdminNav({ active }: { active: string }) {
  const a = (href: string, label: string, key: string) => (
    <Link href={href} className={active === key ? "active" : ""}>{label}</Link>
  );
  return (
    <div className="subnav">
      {a("/admin", "Dashboard", "dash")}
      {a("/admin/fronta", "Fronta ke kontrole", "queue")}
      {a("/admin/konektory", "Konektory", "conn")}
    </div>
  );
}
