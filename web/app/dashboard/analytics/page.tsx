"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all", label: "All Time" },
];

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-5 rounded-xl flex flex-col gap-1" style={{ background: "var(--sf-card-alt)", border: "1px solid var(--sf-border)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--sf-text-muted)" }}>{label}</p>
      <p className="text-3xl font-extrabold" style={{ color: color || "var(--sf-text)" }}>{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [period, setPeriod] = useState("weekly");
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.listAllRules().then(setRules); }, []);

  const load = async (rule: any, p: string) => {
    if (!rule) return;
    setLoading(true);
    setSummary(null);
    const data = await api.getRulePerformance(rule.id, p).catch(() => null);
    setSummary(data);
    setLoading(false);
  };

  const selectRule = (r: any) => { setSelected(r); load(r, period); };
  const selectPeriod = (p: string) => { setPeriod(p); load(selected, p); };

  const chartData = summary ? [
    { name: "Buy", value: summary.buy_signals, fill: "var(--sf-buy)" },
    { name: "Sell", value: summary.sell_signals, fill: "var(--sf-sell)" },
  ] : [];

  const avgColor = summary?.avg_return_pct > 0 ? "var(--sf-buy)" : summary?.avg_return_pct < 0 ? "var(--sf-sell)" : undefined;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold mb-1">Analytics</h1>
      <p className="text-sm mb-8" style={{ color: "var(--sf-text-secondary)" }}>
        Signal performance by rule and period
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Rule list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--sf-text-muted)" }}>Rules</p>
          {rules.map(r => (
            <button key={r.id} onClick={() => selectRule(r)}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: selected?.id === r.id ? "var(--sf-accent)18" : "var(--sf-card)",
                border: `1px solid ${selected?.id === r.id ? "var(--sf-accent)55" : "var(--sf-border)"}`,
                color: selected?.id === r.id ? "var(--sf-accent)" : "var(--sf-text)",
              }}>
              {r.name}
            </button>
          ))}
          {rules.length === 0 && <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>No rules yet</p>}
        </div>

        {/* Performance */}
        <div className="lg:col-span-3 space-y-6">
          {selected && (
            <>
              {/* Period tabs */}
              <div className="flex gap-2">
                {PERIODS.map(p => (
                  <button key={p.key} onClick={() => selectPeriod(p.key)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: period === p.key ? "var(--sf-accent)" : "var(--sf-card)",
                      color: period === p.key ? "#000" : "var(--sf-text-secondary)",
                      border: `1px solid ${period === p.key ? "var(--sf-accent)" : "var(--sf-border)"}`,
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {loading && <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>Loading…</p>}

              {summary && !loading && (
                <>
                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Metric label="Total Signals" value={String(summary.total_signals)} />
                    <Metric label="Win Rate"
                      value={summary.win_rate !== null ? `${(summary.win_rate * 100).toFixed(1)}%` : "—"}
                      color={summary.win_rate > 0.5 ? "var(--sf-buy)" : summary.win_rate !== null ? "var(--sf-sell)" : undefined} />
                    <Metric label="Avg Return"
                      value={summary.avg_return_pct !== null ? `${summary.avg_return_pct >= 0 ? "+" : ""}${summary.avg_return_pct.toFixed(2)}%` : "—"}
                      color={avgColor} />
                    <Metric label="Best Signal"
                      value={summary.best_return !== null ? `+${summary.best_return.toFixed(2)}%` : "—"}
                      color="var(--sf-buy)" />
                    <Metric label="Worst Signal"
                      value={summary.worst_return !== null ? `${summary.worst_return.toFixed(2)}%` : "—"}
                      color="var(--sf-sell)" />
                    <Metric label="Buy / Sell"
                      value={`${summary.buy_signals} / ${summary.sell_signals}`} />
                  </div>

                  {/* Chart */}
                  {summary.total_signals > 0 && (
                    <div className="p-5 rounded-xl" style={{ background: "var(--sf-card)", border: "1px solid var(--sf-border)" }}>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--sf-text-muted)" }}>
                        Signal Distribution
                      </p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} barSize={48}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false}
                            tick={{ fill: "var(--sf-text-secondary)", fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false}
                            tick={{ fill: "var(--sf-text-muted)", fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{ background: "var(--sf-card-alt)", border: "1px solid var(--sf-border)", borderRadius: 8 }}
                            labelStyle={{ color: "var(--sf-text)" }}
                            itemStyle={{ color: "var(--sf-text-secondary)" }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {!selected && (
            <div className="flex items-center justify-center h-48 rounded-xl"
              style={{ border: "1px dashed var(--sf-border)", color: "var(--sf-text-muted)" }}>
              Select a rule to see performance
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
