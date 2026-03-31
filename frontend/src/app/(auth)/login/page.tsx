"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email ou senha inválidos.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="w-full max-w-md"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "48px 40px",
      }}
    >
      <div className="mb-10">
        <h1
          className="text-3xl tracking-tight mb-2"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
        >
          PortfolioAI
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Acesse sua conta para continuar
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="seu@email.com"
            className="w-full px-4 py-3 text-sm rounded-lg outline-none transition-colors"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="********"
            className="w-full px-4 py-3 text-sm rounded-lg outline-none transition-colors"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 text-sm px-4 py-3 rounded-lg"
            style={{
              background: "var(--danger-light)",
              color: "var(--danger)",
            }}
          >
            <AlertCircle size={16} strokeWidth={1.8} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold rounded-lg transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "var(--accent)",
            color: "white",
          }}
        >
          {loading ? (
            "Entrando..."
          ) : (
            <>
              <Lock size={16} strokeWidth={1.8} />
              Entrar
              <ArrowRight size={16} strokeWidth={1.8} />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/forgot-password"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          Esqueci minha senha
        </Link>
      </div>
    </div>
  );
}

// Next.js App Router requires default export for pages
export { LoginPage as default };
