"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Database,
  Globe,
  BarChart3,
  TrendingUp,
  Search,
  Shield,
  MessageSquare,
  Target,
  Layers,
  PieChart,
} from "lucide-react";
import type { AgentStatusMap } from "@/hooks/use-pipeline-ws";

const AGENT_CONFIG: Record<
  string,
  { label: string; description: string; icon: typeof Globe }
> = {
  market_data: {
    label: "Dados de Mercado",
    description: "Coletando Selic, IPCA, Ibovespa, BTC Dominance",
    icon: Database,
  },
  macro_analyst: {
    label: "Analise Macro",
    description: "Cenario macroeconomico Brasil + Global",
    icon: Globe,
  },
  sector_analyst: {
    label: "Rotacao Setorial",
    description: "Identificando setores e segmentos em destaque",
    icon: Layers,
  },
  portfolio_balancer: {
    label: "Balanceamento",
    description: "Calculando distribuicao otima do aporte",
    icon: PieChart,
  },
  b3_screener: {
    label: "Screening B3",
    description: "Selecionando candidatos na bolsa brasileira",
    icon: Search,
  },
  crypto_screener: {
    label: "Screening Crypto",
    description: "Selecionando candidatos em criptoativos",
    icon: Search,
  },
  candidate_data: {
    label: "Dados dos Candidatos",
    description: "Buscando fundamentals e metricas reais",
    icon: Database,
  },
  deep_research_b3: {
    label: "Deep Research B3",
    description: "Pesquisa profunda em 3 rounds",
    icon: BarChart3,
  },
  deep_research_crypto: {
    label: "Deep Research Crypto",
    description: "Pesquisa profunda em 3 rounds",
    icon: TrendingUp,
  },
  risk_analyst: {
    label: "Analise de Riscos",
    description: "Devil's advocate — buscando red flags",
    icon: Shield,
  },
  sentiment_analyst: {
    label: "Sentimento",
    description: "Analisando noticias e sentimento de mercado",
    icon: MessageSquare,
  },
  consolidator: {
    label: "Decisao Final",
    description: "Consolidando analises e montando alocacao",
    icon: Target,
  },
};

const AGENT_ORDER = [
  "market_data",
  "macro_analyst",
  "sector_analyst",
  "portfolio_balancer",
  "b3_screener",
  "crypto_screener",
  "candidate_data",
  "deep_research_b3",
  "deep_research_crypto",
  "risk_analyst",
  "sentiment_analyst",
  "consolidator",
];

interface PipelineTimelineProps {
  agents: AgentStatusMap;
  pipelineStatus: string;
}

export function PipelineTimeline({
  agents,
  pipelineStatus,
}: PipelineTimelineProps) {
  return (
    <div className="relative">
      <div
        className="absolute left-[15px] top-4 bottom-4 w-px"
        style={{ background: "var(--border)" }}
      />

      <div className="flex flex-col gap-3">
        {AGENT_ORDER.map((name, index) => {
          const config = AGENT_CONFIG[name];
          const agent = agents[name] || { status: "pending" };
          if (!config) return null;

          const { status, roundInfo } = agent;
          const Icon = config.icon;

          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="flex items-center gap-4 relative px-2 py-2 rounded-lg"
              style={{
                background:
                  status === "running" ? "var(--accent-light)" : "transparent",
              }}
            >
              <div className="relative z-10 shrink-0">
                <StatusIcon status={status} />
              </div>

              <div
                className="shrink-0"
                style={{ color: statusColor(status) }}
              >
                <Icon size={16} strokeWidth={1.6} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: statusColor(status) }}
                  >
                    {config.label}
                  </span>
                  {roundInfo && roundInfo.total_rounds > 1 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {roundInfo.round_number}/{roundInfo.total_rounds}
                    </span>
                  )}
                </div>
                <p
                  className="text-xs truncate mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {status === "running"
                    ? config.description
                    : status === "completed"
                      ? "Concluido"
                      : status === "failed"
                        ? "Falhou"
                        : "Aguardando"}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {pipelineStatus === "completed" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-lg text-sm font-medium text-center"
          style={{
            background: "var(--accent-light)",
            color: "var(--accent)",
          }}
        >
          Ultra-pesquisa concluida — recomendacao pronta
        </motion.div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const size = 18;

  if (status === "running") {
    return (
      <Loader2
        size={size}
        strokeWidth={2}
        className="animate-spin"
        style={{ color: "var(--accent)" }}
      />
    );
  }

  if (status === "completed") {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <CheckCircle2
          size={size}
          strokeWidth={2}
          style={{ color: "var(--success)" }}
        />
      </motion.div>
    );
  }

  if (status === "failed" || status === "timeout") {
    return (
      <XCircle size={size} strokeWidth={2} style={{ color: "var(--danger)" }} />
    );
  }

  return (
    <Circle
      size={size}
      strokeWidth={1.5}
      style={{ color: "var(--border-strong)" }}
    />
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "var(--success)";
    case "running":
      return "var(--accent)";
    case "failed":
      return "var(--danger)";
    default:
      return "var(--text-secondary)";
  }
}
