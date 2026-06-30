"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChevronRight, Trash2 } from "lucide-react";

export default function WatchlistsPage() {
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [symbols, setSymbols] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listWatchlists().then(setWatchlists).finally(() => setLoading(false));
  }, []);

  const select = async (wl: any) => {
    setSelected(wl);
    setSymbols([]);
    setRules([]);
    const [syms, rls] = await Promise.all([
      api.getWatchlistSymbols(wl.id),
      api.listRules(wl.id),
    ]);
    setSymbols(syms);
    setRules(rls);
  };

  const deleteWl = async (id: number) => {
    await api.deleteWatchlist(id);
    setWatchlists(w => w.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold mb-1">Watchlists</h1>
      <p className="text-sm mb-8" style={{ color: "var(--sf-text-secondary)" }}>
        Your screener-based and manual watchlists
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="space-y-3">
          {loading && <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>Loading…</p>}
          {watchlists.map(wl => (
            <div key={wl.id}
              onClick={() => select(wl)}
              className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors"
              style={{
                background: selected?.id === wl.id ? "var(--sf-accent)18" : "var(--sf-card)",
                border: `1px solid ${selected?.id === wl.id ? "var(--sf-accent)55" : "var(--sf-border)"}`,
              }}>
              <div>
                <p className="font-bold text-sm">{wl.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--sf-text-muted)" }}>
                  {wl.last_run_at ? new Date(wl.last_run_at).toLocaleString() : "Never run"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); deleteWl(wl.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  style={{ color: "var(--sf-text-muted)" }}>
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} style={{ color: "var(--sf-text-muted)" }} />
              </div>
            </div>
          ))}
          {!loading && watchlists.length === 0 && (
            <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
              No watchlists yet — create one in the mobile app.
            </p>
          )}
        </div>

        {/* Detail */}
        {selected && (
          <div className="lg:col-span-2 space-y-6">
            {/* Symbols */}
            <div className="p-5 rounded-xl" style={{ background: "var(--sf-card)", border: "1px solid var(--sf-border)" }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--sf-text-secondary)" }}>
                Symbols ({symbols.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {symbols.map(s => (
                  <div key={s.symbol} className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: "var(--sf-accent)18", border: "1px solid var(--sf-accent)44", color: "var(--sf-accent)" }}>
                    {s.symbol}
                    {s.company_name && <span className="ml-1 font-normal" style={{ color: "var(--sf-text-secondary)" }}>· {s.company_name}</span>}
                  </div>
                ))}
                {symbols.length === 0 && <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>No symbols yet</p>}
              </div>
            </div>

            {/* Rules */}
            <div className="p-5 rounded-xl" style={{ background: "var(--sf-card)", border: "1px solid var(--sf-border)" }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--sf-text-secondary)" }}>
                Rules ({rules.length})
              </h2>
              <div className="space-y-2">
                {rules.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-lg"
                    style={{ background: "var(--sf-card-alt)", border: "1px solid var(--sf-border)" }}>
                    <span className="text-sm font-semibold">{r.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: r.active ? "var(--sf-buy)22" : "var(--sf-text-muted)22",
                        color: r.active ? "var(--sf-buy)" : "var(--sf-text-muted)" }}>
                      {r.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
                {rules.length === 0 && <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>No rules yet</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
