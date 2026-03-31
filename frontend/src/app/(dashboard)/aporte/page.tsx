"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  BarChart3,
  TrendingUp,
  Shield,
  Brain,
  Database,
  Search,
  LineChart,
  Layers,
  Bitcoin,
  AlertTriangle,
  MessageSquare,
  Gavel,
} from "lucide-react";
import {
  createContribution,
  fetchContribution,
  API_BASE,
  type Contribution,
  type PipelineEvent,
} from "@/lib/api";
import { usePipelineWs, type AgentStatusMap } from "@/hooks/use-pipeline-ws";

// Full pipeline agent definitions with all 12 steps
const PIPELINE_AGENTS = [
  { key: "market_data", label: "Dados de Mercado", icon: Database },
  { key: "macro_analyst", label: "Analise Macro", icon: TrendingUp },
  { key: "sector_analyst", label: "Rotacao Setorial", icon: BarChart3 },
  { key: "portfolio_balancer", label: "Balanceamento", icon: Layers },
  { key: "b3_screener", label: "Screening B3", icon: Search },
  { key: "crypto_screener", label: "Screening Crypto", icon: Bitcoin },
  { key: "candidate_data", label: "Dados dos Candidatos", icon: LineChart },
  { key: "deep_research_b3", label: "Deep Research B3", icon: Brain },
  { key: "deep_research_crypto", label: "Deep Research Crypto", icon: Brain },
  { key: "risk_analyst", label: "Analise de Riscos", icon: Shield },
  { key: "sentiment_analyst", label: "Sentimento", icon: MessageSquare },
  { key: "consolidator", label: "Decisao Final", icon: Gavel },
] as const;

function AportePage() {
  const [mode, setMode] = useState<"aporte" | "retirada">("aporte");
  const [amount, setAmount] = useState("");
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [completedContribution, setCompletedContribution] =
    useState<Contribution | null>(null);

  const { agents, pipelineStatus } = usePipelineWs(contributionId);

  const handleFetchFinal = useCallback(async (id: string) => {
    try {
      const result = await fetchContribution(id);
      setCompletedContribution(result);
    } catch {
      // Silently fail — user can refresh
    }
  }, []);

  // When pipeline completes, fetch the final recommendation
  if (
    pipelineStatus === "completed" &&
    contributionId &&
    !completedContribution
  ) {
    handleFetchFinal(contributionId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (isNaN(value) || value <= 0) {
      setError("Valor invalido");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    if (mode === "retirada") {
      try {
        const res = await fetch(`${API_BASE}/api/aporte/withdraw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount_brl: value }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ detail: "Erro" }));
          throw new Error(data.detail || "Erro ao registrar retirada");
        }
        setSuccessMsg(`Retirada de R$ ${amount} registrada com sucesso`);
        setAmount("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao registrar retirada");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const result = await createContribution(value);
      setContributionId(result.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao registrar aporte"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setAmount("");
      return;
    }
    const cents = parseInt(raw, 10);
    const formatted = (cents / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setAmount(formatted);
  }

  function handleReset() {
    setAmount("");
    setContributionId(null);
    setCompletedContribution(null);
    setError(null);
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h2
          className="font-serif text-4xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {mode === "aporte" ? "Novo Aporte" : "Retirada"}
        </h2>
        <p
          className="font-sans text-sm mt-2"
          style={{ color: "var(--text-muted)" }}
        >
          {mode === "aporte"
            ? "Registre um aporte para iniciar a analise multi-agente"
            : "Registre uma retirada de capital da carteira"}
        </p>
      </div>

      {/* Mode tabs */}
      {!contributionId && (
        <div className="flex gap-1">
          <button
            onClick={() => { setMode("aporte"); setError(null); setSuccessMsg(null); }}
            className="px-5 py-2 rounded-lg font-sans text-sm font-medium transition-colors cursor-pointer"
            style={{
              background: mode === "aporte" ? "var(--success)" : "var(--bg-secondary)",
              color: mode === "aporte" ? "white" : "var(--text-secondary)",
            }}
          >
            + Aporte
          </button>
          <button
            onClick={() => { setMode("retirada"); setError(null); setSuccessMsg(null); }}
            className="px-5 py-2 rounded-lg font-sans text-sm font-medium transition-colors cursor-pointer"
            style={{
              background: mode === "retirada" ? "var(--danger)" : "var(--bg-secondary)",
              color: mode === "retirada" ? "white" : "var(--text-secondary)",
            }}
          >
            - Retirada
          </button>
        </div>
      )}

      {/* Success message for withdrawals */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-lg font-sans text-sm font-medium"
            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
          >
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <div
        className="p-8 rounded-lg max-w-lg"
        style={{
          background: "var(--bg-card)",
          border: `1px solid ${mode === "retirada" ? "var(--danger)" : "var(--border)"}`,
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="aporte-amount"
              className="font-sans text-xs uppercase tracking-wider font-medium block mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              {mode === "aporte" ? "Valor do Aporte" : "Valor da Retirada"}
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium font-sans"
                style={{ color: "var(--text-muted)" }}
              >
                R$
              </span>
              <input
                id="aporte-amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                disabled={!!contributionId}
                className="w-full pl-12 pr-4 py-3.5 rounded-lg text-xl font-semibold tabular-nums outline-none transition-colors font-sans"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="font-sans text-sm"
                style={{ color: "var(--danger)" }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {!contributionId && (
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-semibold font-sans transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "white",
              }}
            >
              <Send size={16} />
              {isSubmitting
                ? "Registrando..."
                : mode === "retirada"
                  ? "Registrar Retirada"
                  : "Iniciar Analise"}
            </button>
          )}
        </form>
      </div>

      {/* Pipeline Timeline */}
      <AnimatePresence>
        {contributionId && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div
              className="p-8 rounded-lg max-w-2xl"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between mb-8">
                <h3
                  className="font-serif text-xl"
                  style={{ color: "var(--text-primary)" }}
                >
                  Pipeline de Agentes
                </h3>
                {pipelineStatus === "running" && (
                  <span
                    className="font-sans text-xs font-medium px-3 py-1 rounded-full"
                    style={{
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                    }}
                  >
                    Em execucao
                  </span>
                )}
                {pipelineStatus === "completed" && (
                  <span
                    className="font-sans text-xs font-medium px-3 py-1 rounded-full"
                    style={{
                      background: "oklch(0.95 0.12 145)",
                      color: "var(--success)",
                    }}
                  >
                    Concluido
                  </span>
                )}
                {pipelineStatus === "error" && (
                  <span
                    className="font-sans text-xs font-medium px-3 py-1 rounded-full"
                    style={{
                      background: "oklch(0.95 0.04 25)",
                      color: "var(--danger)",
                    }}
                  >
                    Erro
                  </span>
                )}
              </div>

              <AgentTimeline agents={agents} />
            </div>

            {/* Final Recommendation */}
            <AnimatePresence>
              {pipelineStatus === "completed" && completedContribution && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="mt-8 p-8 rounded-lg max-w-2xl"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h3
                    className="font-serif text-xl mb-6"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Recomendacao Final
                  </h3>
                  <RecommendationCard contribution={completedContribution} />
                  <button
                    onClick={handleReset}
                    className="mt-6 font-sans text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-80 cursor-pointer"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Novo Aporte
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Pipeline timeline with all 12 agents
function AgentTimeline({ agents }: { agents: AgentStatusMap }) {
  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div
        className="absolute left-[17px] top-5 bottom-5 w-px"
        style={{ background: "var(--border)" }}
      />

      <div className="flex flex-col gap-1">
        {PIPELINE_AGENTS.map((agent, index) => {
          const agentState = agents[agent.key] || { status: "pending" };
          const isMultiTurn =
            agent.key === "deep_research_b3" ||
            agent.key === "deep_research_crypto";
          const roundInfo = agentState.data?.round_info as
            | { round_number: number; total_rounds: number }
            | undefined;

          return (
            <motion.div
              key={agent.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
              className="flex items-center gap-4 relative py-2.5"
            >
              {/* Status icon */}
              <div className="relative z-10 shrink-0">
                <AgentStatusIcon status={agentState.status} />
              </div>

              {/* Label and status */}
              <div className="flex-1 flex items-center justify-between min-w-0">
                <div className="flex items-center gap-2.5">
                  <agent.icon
                    size={14}
                    style={{
                      color:
                        agentState.status === "running"
                          ? "var(--accent)"
                          : agentState.status === "completed"
                            ? "var(--success)"
                            : "var(--text-muted)",
                    }}
                  />
                  <span
                    className="font-sans text-sm font-medium"
                    style={{
                      color:
                        agentState.status === "running"
                          ? "var(--accent)"
                          : agentState.status === "completed"
                            ? "var(--text-primary)"
                            : agentState.status === "failed"
                              ? "var(--danger)"
                              : "var(--text-muted)",
                    }}
                  >
                    {agent.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Round indicator for multi-turn agents */}
                  {isMultiTurn && roundInfo && agentState.status === "running" && (
                    <span
                      className="font-sans text-xs tabular-nums font-medium px-2 py-0.5 rounded"
                      style={{
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                      }}
                    >
                      Round {roundInfo.round_number}/{roundInfo.total_rounds}
                    </span>
                  )}

                  {/* Status text */}
                  <span
                    className="font-sans text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {agentState.status === "running"
                      ? "Processando..."
                      : agentState.status === "completed"
                        ? "Concluido"
                        : agentState.status === "failed"
                          ? "Falhou"
                          : agentState.status === "timeout"
                            ? "Timeout"
                            : ""}
                  </span>
                </div>
              </div>

              {/* Green flash on completion */}
              {agentState.status === "completed" && (
                <motion.div
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{ background: "var(--success)" }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AgentStatusIcon({ status }: { status: string }) {
  const size = 18;

  switch (status) {
    case "running":
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 size={size} style={{ color: "var(--accent)" }} />
        </motion.div>
      );
    case "completed":
      return (
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <CheckCircle2 size={size} style={{ color: "var(--success)" }} />
        </motion.div>
      );
    case "failed":
    case "timeout":
      return <XCircle size={size} style={{ color: "var(--danger)" }} />;
    default:
      return <Circle size={size} style={{ color: "var(--border-strong)" }} />;
  }
}

function RecommendationCard({
  contribution,
}: {
  contribution: Contribution;
}) {
  const recommendation = contribution.final_recommendation;

  if (!recommendation) {
    return (
      <p className="font-sans text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma recomendacao disponivel.
      </p>
    );
  }

  // Try to extract common recommendation fields
  const summary =
    (recommendation.resumo as string) ||
    (recommendation.summary as string) ||
    null;
  const allocations = (recommendation.alocacoes ||
    recommendation.allocations) as Record<string, unknown>[] | undefined;

  return (
    <div className="space-y-4">
      {summary && (
        <p
          className="font-sans text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {summary}
        </p>
      )}

      {allocations && Array.isArray(allocations) && (
        <div className="space-y-2 mt-4">
          {allocations.map((alloc, i) => {
            const ticker =
              (alloc.ticker as string) || (alloc.asset as string) || `Item ${i + 1}`;
            const value =
              (alloc.valor as number) || (alloc.value as number) || 0;
            const reason =
              (alloc.motivo as string) || (alloc.reason as string) || "";

            return (
              <div
                key={ticker}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <span
                    className="font-sans text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {ticker}
                  </span>
                  {reason && (
                    <p
                      className="font-sans text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {reason}
                    </p>
                  )}
                </div>
                <span
                  className="font-sans text-sm font-semibold tabular-nums"
                  style={{ color: "var(--accent)" }}
                >
                  {formatBRL(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback: render raw JSON if no structured data found */}
      {!summary && !allocations && (
        <pre
          className="font-sans text-xs overflow-auto p-4 rounded-lg max-h-96"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          {JSON.stringify(recommendation, null, 2)}
        </pre>
      )}
    </div>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export { AportePage as default };
