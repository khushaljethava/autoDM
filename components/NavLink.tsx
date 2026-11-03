"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 whitespace-nowrap rounded-lg border px-3 py-2 text-sm transition ${
        active ? "border-accent/30 bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-white/5 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
