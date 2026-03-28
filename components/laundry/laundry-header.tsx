"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  { href: "/laundry", label: "Home", exact: true },
  { href: "/laundry/orders", label: "Orders" },
];

export function LaundryHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(item: (typeof nav)[number]) {
    if ("exact" in item && item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">
            BH
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Laundry</p>
            <p className="text-xs text-zinc-500">Processing station</p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item)
                  ? "bg-blue-50 text-blue-800"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-2 border-l border-zinc-200 pl-2">
            <SignOutButton />
          </div>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="border-t border-zinc-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item)
                    ? "bg-blue-50 text-blue-800"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <SignOutButton />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
