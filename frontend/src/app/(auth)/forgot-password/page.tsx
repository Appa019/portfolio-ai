"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (resetError) {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
          Recuperar senha
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Enviaremos um link para redefinir sua senha
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={40} strokeWidth={1.5} style={{ color: "var(--success)" }} />
          <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
            Email enviado para <strong style={{ color: "var(--text-primary)" }}>{email}</strong>.
            Verifique sua caixa de entrada e clique no link para redefinir sua senha.
          </p>
        </div>
      ) : (
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
              "Enviando..."
            ) : (
              <>
                <Mail size={16} strokeWidth={1.8} />
                Enviar link de recuperação
              </>
            )}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}

// Next.js App Router requires default export for pages
export { ForgotPasswordPage as default };
