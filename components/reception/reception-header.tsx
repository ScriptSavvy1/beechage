import Link from "next/link";

const nav = [
  { href: "/reception", label: "Home" },
  { href: "/reception/orders", label: "My orders" },
  { href: "/reception/orders/new", label: "New order" },
];

export function ReceptionHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Reception</p>
          <p className="text-sm text-zinc-600">Order management</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
