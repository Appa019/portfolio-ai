"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setSessionValid(!!user);
    }
    checkSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError("Erro ao atualizar senha. O link pode ter expirado.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 2000);
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
          Nova senha
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Defina uma nova senha para sua conta
        </p>
      </div>

      {sessionValid === null ? (
        <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
          Verificando sessão...
        </p>
      ) : sessionValid === false ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <AlertCircle size={40} strokeWidth={1.5} style={{ color: "var(--danger)" }} />
          <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
            Link expirado ou inválido. Solicite um novo link de recuperação na{" "}
            <a href="/forgot-password" style={{ color: "var(--accent)" }}>página de recuperação</a>.
          </p>
        </div>
      ) : success ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={40} strokeWidth={1.5} style={{ color: "var(--success)" }} />
          <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
            Senha atualizada com sucesso. Redirecionando...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Nova senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
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
              htmlFor="confirmPassword"
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repita a senha"
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
              "Atualizando..."
            ) : (
              <>
                <KeyRound size={16} strokeWidth={1.8} />
                Atualizar senha
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

// Next.js App Router requires default export for pages
export { ResetPasswordPage as default };
