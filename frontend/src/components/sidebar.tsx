"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Briefcase,
  FileBarChart,
  Search,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pesquisa", label: "Pesquisa", icon: Search },
  { href: "/aporte", label: "Aporte", icon: PlusCircle },
  { href: "/ativos", label: "Ativos", icon: Briefcase },
  { href: "/relatorios", label: "Relatorios", icon: FileBarChart },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      // Network error
    }
  }

  return (
    <aside
      className="w-64 border-r shrink-0 px-6 py-10 flex flex-col"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mb-12">
        <h1
          className="text-2xl tracking-tight"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
          }}
        >
          PortfolioAI
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Ultra Research Engine
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? "var(--accent-light)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div
        className="mt-auto pt-6"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-70 w-full cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          <LogOut size={18} strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  );
}
