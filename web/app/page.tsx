"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem("sf_token", res.token);
      localStorage.setItem("sf_email", res.email);
      router.push("/dashboard");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: "var(--sf-card)", border: "1px solid var(--sf-border)" }}>
            <span className="text-3xl">🐂</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">SignalFlow</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--sf-text-secondary)" }}>
            Algorithmic stock signals, simplified
          </p>
        </div>

        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--sf-text-secondary)" }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none"
              style={{ background: "var(--sf-card)", border: "1px solid var(--sf-border)", color: "var(--sf-text)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--sf-text-secondary)" }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none"
              style={{ background: "var(--sf-card)", border: "1px solid var(--sf-border)", color: "var(--sf-text)" }} />
          </div>

          {error && <p className="text-sm text-center" style={{ color: "var(--sf-sell)" }}>{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-sm transition-opacity disabled:opacity-60"
            style={{ background: "var(--sf-accent)", color: "#000" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
