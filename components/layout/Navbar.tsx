"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

const links = [
  { href: "/search", label: "Buscar residencias" },
  { href: "/for-students", label: "Para estudiantes" },
  { href: "/for-residences", label: "Para residencias" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="EstuRed, inicio">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-petrol-600 font-display text-lg font-extrabold text-white">
            E
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-petrol-800">
            EstuRed
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-petrol-50 text-petrol-700"
                  : "text-ink-soft hover:bg-sand-100 hover:text-petrol-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-3 flex items-center gap-2">
            <Button href="/login" variant="ghost" size="sm">
              Ingresar
            </Button>
            <Button href="/waitlist" size="sm">
              Lista de espera
            </Button>
          </div>
        </div>

        <button
          className="rounded-md p-2 text-ink-soft md:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Abrir menú"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-sand-200 bg-surface px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  pathname === link.href
                    ? "bg-petrol-50 text-petrol-700"
                    : "text-ink-soft"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft"
            >
              Ingresar
            </Link>
            <Button href="/waitlist" size="md" className="mt-3 w-full">
              Sumarme a la lista de espera
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
