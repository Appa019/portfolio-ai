"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  FileQuestion,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import {
  fetchContributions,
  fetchResearchAnalyses,
  fetchMacroContext,
} from "@/lib/api";
import type { Contribution, ResearchAnalysis, MacroSnapshot } from "@/lib/api";

// --- Helpers ---

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function riskColor(score: number): string {
  if (score <= 3) return "var(--success)";
  if (score <= 6) return "var(--warning)";
  return "var(--danger)";
}

function sentimentLabel(score: number): {
  text: string;
  color: string;
} {
  if (score >= 0.3) return { text: "Positivo", color: "var(--success)" };
  if (score <= -0.3) return { text: "Negativo", color: "var(--danger)" };
  return { text: "Neutro", color: "var(--text-muted)" };
}

function confidenceVariant(
  confidence: string | null
): "success" | "warning" | "danger" | "neutral" {
  if (!confidence) return "neutral";
  const lower = confidence.toLowerCase();
  if (lower === "high" || lower === "alta") return "success";
  if (lower === "medium" || lower === "media") return "warning";
  if (lower === "low" || lower === "baixa") return "danger";
  return "neutral";
}

// --- Animation ---

const fadeUp: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.05 } },
};

const expandVariants: import("framer-motion").Variants = {
  collapsed: { height: 0, opacity: 0, overflow: "hidden" },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "hidden",
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

// --- Tab config ---

const TAB_ITEMS = [
  { key: "all", label: "Todos" },
  { key: "stocks", label: "Acoes" },
  { key: "crypto", label: "Crypto" },
];

// --- Macro card labels ---

interface MacroCardConfig {
  key: keyof MacroSnapshot;
  label: string;
  format: (v: number) => string;
  suffix?: string;
}

const MACRO_CARDS: MacroCardConfig[] = [
  {
    key: "selic",
    label: "Selic",
    format: (v) => `${formatNumber(v)}%`,
  },
  {
    key: "ipca_12m",
    label: "IPCA 12m",
    format: (v) => `${formatNumber(v)}%`,
  },
  {
    key: "usd_brl",
    label: "USD/BRL",
    format: (v) => formatNumber(v, 4),
  },
  {
    key: "ibovespa_level",
    label: "Ibovespa",
    format: (v) =>
      new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v),
  },
  {
    key: "fear_greed_index",
    label: "Fear & Greed",
    format: (v) => String(Math.round(v)),
  },
];

// --- JSON formatter ---

function JsonDisplay({ data }: { data: Record<string, unknown> }) {
  return (
    <pre
      className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words"
      style={{
        color: "var(--text-secondary)",
        fontFamily: "monospace",
        padding: "16px",
        background: "var(--bg-secondary)",
        borderRadius: 4,
        maxHeight: 400,
        overflowY: "auto",
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// --- Research card ---

function AnalysisCard({
  analysis,
  index,
}: {
  analysis: ResearchAnalysis;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const sentiment = analysis.sentiment_score
    ? sentimentLabel(analysis.sentiment_score)
    : null;

  return (
    <motion.div variants={fadeUp} custom={index}>
      <Card padding="md">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span
                className="font-sans text-lg font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {analysis.ticker}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                {analysis.asset_class === "stocks"
                  ? "Acoes"
                  : analysis.asset_class === "crypto"
                    ? "Crypto"
                    : "RF"}
              </span>
              {analysis.confidence && (
                <Badge variant={confidenceVariant(analysis.confidence)}>
                  {analysis.confidence}
                </Badge>
              )}
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {analysis.agent_name}
            </p>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-5 shrink-0">
            {/* Risk */}
            {analysis.risk_score !== null && (
              <div className="flex flex-col items-center gap-1">
                <ShieldAlert
                  size={16}
                  style={{ color: riskColor(analysis.risk_score) }}
                />
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: riskColor(analysis.risk_score) }}
                >
                  {analysis.risk_score}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Risco
                </span>
              </div>
            )}

            {/* Sentiment */}
            {analysis.sentiment_score !== null && sentiment && (
              <div className="flex flex-col items-center gap-1">
                {analysis.sentiment_score > 0 ? (
                  <TrendingUp size={16} style={{ color: sentiment.color }} />
                ) : analysis.sentiment_score < 0 ? (
                  <TrendingDown size={16} style={{ color: sentiment.color }} />
                ) : (
                  <Minus size={16} style={{ color: sentiment.color }} />
                )}
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: sentiment.color }}
                >
                  {(analysis.sentiment_score ?? 0) > 0 ? "+" : ""}
                  {(analysis.sentiment_score ?? 0).toFixed(2)}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Sent.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1 mt-4 text-xs font-medium cursor-pointer"
          style={{
            color: "var(--accent)",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              Ocultar analise
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Ver analise completa
            </>
          )}
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="content"
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={expandVariants}
            >
              <div className="mt-4">
                <JsonDisplay data={analysis.analysis_data} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// --- Main page ---

// Next.js App Router requires default export for pages
export default function PesquisaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<ResearchAnalysis[]>([]);
  const [macro, setMacro] = useState<MacroSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [latestContribution, setLatestContribution] =
    useState<Contribution | null>(null);

  // Fetch latest contribution, then research data
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const contributions = await fetchContributions();

        if (contributions.length === 0) {
          setLoading(false);
          return;
        }

        // Sort by created_at desc, pick latest
        const sorted = [...contributions].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const latest = sorted[0];
        setLatestContribution(latest);

        // Fetch research + macro in parallel
        const [researchResult, macroResult] = await Promise.allSettled([
          fetchResearchAnalyses(latest.id),
          fetchMacroContext(latest.id),
        ]);

        if (researchResult.status === "fulfilled") {
          setAnalyses(researchResult.value.analyses);
        }

        if (macroResult.status === "fulfilled") {
          setMacro(macroResult.value);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Erro ao carregar pesquisa"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  // Filter analyses by tab
  const filteredAnalyses = useMemo(() => {
    if (activeTab === "all") return analyses;
    return analyses.filter((a) => a.asset_class === activeTab);
  }, [analyses, activeTab]);

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2
          size={28}
          className="animate-spin"
          style={{ color: "var(--text-muted)" }}
        />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Carregando pesquisa...
        </p>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="space-y-6">
        <h2
          className="font-serif text-5xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Pesquisa
        </h2>
        <Card padding="lg">
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Verifique se o backend esta rodando em localhost:8000
          </p>
        </Card>
      </div>
    );
  }

  // --- Empty state ---
  if (!latestContribution || analyses.length === 0) {
    return (
      <div className="space-y-6">
        <h2
          className="font-serif text-5xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Pesquisa
        </h2>
        <Card padding="lg">
          <div className="flex flex-col items-center py-16 gap-4">
            <FileQuestion
              size={40}
              strokeWidth={1.2}
              style={{ color: "var(--text-muted)" }}
            />
            <p
              className="text-sm text-center"
              style={{ color: "var(--text-muted)" }}
            >
              Nenhuma pesquisa disponivel. Faca um aporte para iniciar.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-14"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      {/* Page title */}
      <motion.div variants={fadeUp} custom={0}>
        <h2
          className="font-serif text-5xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Pesquisa
        </h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Analise do aporte de{" "}
          {new Date(latestContribution.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </motion.div>

      {/* Macro banner */}
      {macro && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
          variants={stagger}
        >
          {MACRO_CARDS.map((cfg, i) => {
            const value = macro[cfg.key];
            if (value === null || value === undefined) return null;

            return (
              <motion.div key={cfg.key} variants={fadeUp} custom={i + 1}>
                <Card padding="md">
                  <p
                    className="text-xs uppercase tracking-widest font-medium mb-2"
                    style={{
                      color: "var(--text-muted)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {cfg.label}
                  </p>
                  <p
                    className="text-xl font-bold tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {cfg.format(Number(value))}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div variants={fadeUp} custom={6}>
        <Tabs tabs={TAB_ITEMS} activeTab={activeTab} onChange={setActiveTab} />
      </motion.div>

      {/* Analysis cards grid */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={stagger}
      >
        {filteredAnalyses.length === 0 ? (
          <motion.div
            className="col-span-full"
            variants={fadeUp}
            custom={7}
          >
            <Card padding="lg">
              <p
                className="text-sm text-center py-8"
                style={{ color: "var(--text-muted)" }}
              >
                Nenhuma analise encontrada para este filtro.
              </p>
            </Card>
          </motion.div>
        ) : (
          filteredAnalyses.map((analysis, i) => (
            <AnalysisCard
              key={analysis.id}
              analysis={analysis}
              index={i + 7}
            />
          ))
        )}
      </motion.div>
    </motion.div>
  );
}
