"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutList, Zap, BarChart2, LogOut, TrendingUp } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Watchlists", icon: LayoutList },
  { href: "/dashboard/signals", label: "Signals", icon: Zap },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("sf_token")) router.push("/");
    setEmail(localStorage.getItem("sf_email") || "");
  }, [router]);

  const logout = () => {
    localStorage.removeItem("sf_token");
    localStorage.removeItem("sf_email");
    router.push("/");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 border-r"
        style={{ background: "var(--sf-card)", borderColor: "var(--sf-border)" }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "var(--sf-border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: "#FF9F0A22", border: "1px solid var(--sf-accent)" }}>🐂</div>
          <span className="font-extrabold tracking-tight text-lg">SignalFlow</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: active ? "var(--sf-accent)" + "22" : "transparent",
                  color: active ? "var(--sf-accent)" : "var(--sf-text-secondary)",
                  border: active ? "1px solid var(--sf-accent)33" : "1px solid transparent",
                }}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: "var(--sf-border)" }}>
          <p className="px-3 text-xs truncate" style={{ color: "var(--sf-text-muted)" }}>{email}</p>
          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold w-full transition-colors hover:bg-red-500/10"
            style={{ color: "var(--sf-sell)" }}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--sf-bg)" }}>
        {children}
      </main>
    </div>
  );
}
