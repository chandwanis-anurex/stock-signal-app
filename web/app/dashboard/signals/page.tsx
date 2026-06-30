"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Trash2 } from "lucide-react";

export default function SignalsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSignals().then(setSignals).finally(() => setLoading(false));
  }, []);

  const del = async (id: number) => {
    await api.deleteSignal(id);
    setSignals(s => s.filter(x => x.id !== id));
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold mb-1">Signal Feed</h1>
      <p className="text-sm mb-8" style={{ color: "var(--sf-text-secondary)" }}>
        All buy/sell signals fired by your rules
      </p>

      {loading && <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>Loading…</p>}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--sf-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--sf-card)", borderBottom: "1px solid var(--sf-border)" }}>
              {["Signal", "Symbol", "Company", "Rule", "Price", "Date & Time", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--sf-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((s, i) => {
              const isBuy = s.side === "buy";
              const d = new Date(s.fired_at);
              return (
                <tr key={s.id}
                  style={{ background: i % 2 === 0 ? "var(--sf-card)" : "var(--sf-card-alt)",
                    borderBottom: "1px solid var(--sf-border)" }}>
                  <td className="px-4 py-3">
                    <span className="px-3 py-1 rounded-md text-xs font-extrabold"
                      style={{ background: isBuy ? "var(--sf-buy)" : "var(--sf-sell)", color: "#fff" }}>
                      {s.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">{s.symbol}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--sf-text-secondary)" }}>
                    {s.company_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--sf-text-secondary)" }}>
                    {s.rule_name || "—"}
                  </td>
                  <td className="px-4 py-3 font-bold">${s.price_at_signal?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--sf-text-secondary)" }}>
                    <div>{d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                    <div>{d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => del(s.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      style={{ color: "var(--sf-text-muted)" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && signals.length === 0 && (
          <div className="py-16 text-center" style={{ color: "var(--sf-text-muted)" }}>
            No signals yet — rules fire signals when indicator conditions are met.
          </div>
        )}
      </div>
    </div>
  );
}
