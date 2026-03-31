"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { usePortfolio } from "@/hooks/use-portfolio";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Asset, Contribution } from "@/lib/api";
import { fetchContributions } from "@/lib/api";
import { useState, useEffect } from "react";

// --- Helpers ---

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function computePnlPct(asset: Asset): number {
  const current = asset.current_price ?? asset.avg_price;
  if (asset.avg_price <= 0) return 0;
  return ((current - asset.avg_price) / asset.avg_price) * 100;
}

function getNextLockup(assets: Asset[]): string {
  const locked = assets
    .filter((a) => a.locked_until)
    .map((a) => new Date(a.locked_until as string))
    .filter((d) => d.getTime() > Date.now())
    .sort((a, b) => a.getTime() - b.getTime());

  if (locked.length === 0) return "Nenhum";
  return locked[0].toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getAllocationHealth(deviation: Record<string, number>): {
  label: string;
  variant: "success" | "warning" | "danger";
} {
  const maxDev = Math.max(...Object.values(deviation).map(Math.abs));
  if (maxDev <= 3) return { label: "Saudavel", variant: "success" };
  if (maxDev <= 7) return { label: "Atencao", variant: "warning" };
  return { label: "Desbalanceada", variant: "danger" };
}

// --- Chart colors ---

const CHART_COLORS: Record<string, string> = {
  fixed_income: "oklch(0.55 0.12 195)",
  stocks: "oklch(0.50 0.14 260)",
  crypto: "oklch(0.60 0.16 75)",
};

const CLASS_LABELS: Record<string, string> = {
  fixed_income: "Renda Fixa",
  stocks: "Acoes",
  crypto: "Crypto",
};

// --- Animation variants ---

const fadeUp: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" },
  }),
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

// --- Status badge mapping ---

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  completed: { label: "Concluido", variant: "success" },
  processing: { label: "Processando", variant: "warning" },
  pending: { label: "Pendente", variant: "neutral" },
  failed: { label: "Falhou", variant: "danger" },
};

// --- Main page component ---

// Next.js App Router requires default export for pages
export default function DashboardPage() {
  const { data, loading, error } = usePortfolio();
  const [contributions, setContributions] = useState<Contribution[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchContributions();
        setContributions(result);
      } catch {
        // Contributions are supplementary; silently fail
      }
    };
    load();
  }, []);

  const recentContributions = useMemo(
    () =>
      [...contributions]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    [contributions]
  );

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="space-y-10">
        <div
          className="h-10 w-56 rounded animate-pulse"
          style={{ background: "var(--bg-secondary)" }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-md animate-pulse"
              style={{ background: "var(--bg-secondary)" }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="h-72 rounded-md animate-pulse"
            style={{ background: "var(--bg-secondary)" }}
          />
          <div
            className="h-72 rounded-md animate-pulse"
            style={{ background: "var(--bg-secondary)" }}
          />
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <Card padding="lg">
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          Erro ao carregar portfolio: {error}
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Verifique se o backend esta rodando em localhost:8000
        </p>
      </Card>
    );
  }

  if (!data) return null;

  const totalValue = Number(data.total_value);
  const health = getAllocationHealth(data.deviation);
  const nextLockup = getNextLockup(data.assets);

  // Compute pseudo 7d change from asset P&L average (best approximation without price history)
  const assetsWithPrice = data.assets.filter((a) => a.current_price !== null);
  const avgPnl =
    assetsWithPrice.length > 0
      ? assetsWithPrice.reduce((sum, a) => sum + computePnlPct(a), 0) /
        assetsWithPrice.length
      : 0;

  // Chart data
  const allocationData = [
    {
      name: CLASS_LABELS.fixed_income,
      value: Number(data.allocation.fixed_income),
      key: "fixed_income",
    },
    {
      name: CLASS_LABELS.stocks,
      value: Number(data.allocation.stocks),
      key: "stocks",
    },
    {
      name: CLASS_LABELS.crypto,
      value: Number(data.allocation.crypto),
      key: "crypto",
    },
  ].filter((d) => d.value > 0);

  const targetData = Object.entries(data.target_allocation).map(
    ([key, value]) => ({
      name: `${CLASS_LABELS[key]} (target)`,
      value: Number(value),
      key,
    })
  );

  // Performance table data
  const assetRows = data.assets.map((asset) => ({
    ...asset,
    currentPrice: asset.current_price ?? asset.avg_price,
    totalValue: asset.quantity * (asset.current_price ?? asset.avg_price),
    pnl: computePnlPct(asset),
  }));

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
          Portfolio
        </h2>
      </motion.div>

      {/* KPI row */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={stagger}
      >
        {/* Total Value */}
        <motion.div variants={fadeUp} custom={1}>
          <Card padding="md" className="h-full">
            <p
              className="text-xs uppercase tracking-widest font-medium mb-3"
              style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
            >
              Valor Total
            </p>
            <p
              className="font-sans text-2xl font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {formatBRL(totalValue)}
            </p>
          </Card>
        </motion.div>

        {/* 7d Change */}
        <motion.div variants={fadeUp} custom={2}>
          <Card padding="md" className="h-full">
            <p
              className="text-xs uppercase tracking-widest font-medium mb-3"
              style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
            >
              Variacao P&L
            </p>
            <div className="flex items-center gap-2">
              {avgPnl > 0 ? (
                <TrendingUp size={20} style={{ color: "var(--success)" }} />
              ) : avgPnl < 0 ? (
                <TrendingDown size={20} style={{ color: "var(--danger)" }} />
              ) : (
                <Minus size={20} style={{ color: "var(--text-muted)" }} />
              )}
              <p
                className="text-2xl font-bold tabular-nums"
                style={{
                  color:
                    avgPnl > 0
                      ? "var(--success)"
                      : avgPnl < 0
                        ? "var(--danger)"
                        : "var(--text-primary)",
                }}
              >
                {formatPct(avgPnl)}
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Allocation Health */}
        <motion.div variants={fadeUp} custom={3}>
          <Card padding="md" className="h-full">
            <p
              className="text-xs uppercase tracking-widest font-medium mb-3"
              style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
            >
              Saude da Alocacao
            </p>
            <div className="flex items-center gap-2">
              {health.variant === "success" ? (
                <ShieldCheck size={20} style={{ color: "var(--success)" }} />
              ) : (
                <ShieldAlert
                  size={20}
                  style={{
                    color:
                      health.variant === "warning"
                        ? "var(--warning)"
                        : "var(--danger)",
                  }}
                />
              )}
              <Badge variant={health.variant}>{health.label}</Badge>
            </div>
          </Card>
        </motion.div>

        {/* Next Lockup */}
        <motion.div variants={fadeUp} custom={4}>
          <Card padding="md" className="h-full">
            <p
              className="text-xs uppercase tracking-widest font-medium mb-3"
              style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
            >
              Proximo Vencimento
            </p>
            <div className="flex items-center gap-2">
              <CalendarClock
                size={20}
                style={{ color: "var(--text-secondary)" }}
              />
              <p
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {nextLockup}
              </p>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Two-column: Chart + Activity */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        variants={stagger}
      >
        {/* Allocation donut */}
        <motion.div variants={fadeUp} custom={5}>
          <Card padding="lg" className="h-full">
            <h3
              className="font-serif text-xl mb-8"
              style={{ color: "var(--text-primary)" }}
            >
              Alocacao
            </h3>

            <div className="flex flex-col items-center gap-6">
              {allocationData.length > 0 ? (
                <div className="w-full" style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {/* Target ring (outer, faded) */}
                      {targetData.length > 0 && (
                        <Pie
                          data={targetData}
                          cx="50%"
                          cy="50%"
                          innerRadius={95}
                          outerRadius={110}
                          paddingAngle={2}
                          dataKey="value"
                          strokeWidth={0}
                          isAnimationActive={false}
                        >
                          {targetData.map((entry) => (
                            <Cell
                              key={`target-${entry.key}`}
                              fill={CHART_COLORS[entry.key]}
                              opacity={0.25}
                            />
                          ))}
                        </Pie>
                      )}
                      {/* Current ring (inner) */}
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {allocationData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={CHART_COLORS[entry.key]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          fontSize: 13,
                          color: "var(--text-primary)",
                        }}
                        formatter={(value) => formatBRL(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p
                  className="text-sm py-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  Sem alocacao para exibir
                </p>
              )}

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                {(["fixed_income", "stocks", "crypto"] as const).map((key) => {
                  const pct =
                    key === "fixed_income"
                      ? (data.allocation.fixed_income_pct ?? 0)
                      : key === "stocks"
                        ? (data.allocation.stocks_pct ?? 0)
                        : (data.allocation.crypto_pct ?? 0);
                  const tgt = data.target_allocation[key] ?? 0;

                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: CHART_COLORS[key] }}
                      />
                      <span style={{ color: "var(--text-secondary)" }}>
                        {CLASS_LABELS[key]}
                      </span>
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {Number(pct).toFixed(1)}%
                      </span>
                      <span
                        className="text-xs tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        / {tgt}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Recent activity */}
        <motion.div variants={fadeUp} custom={6}>
          <Card padding="lg" className="h-full">
            <h3
              className="font-serif text-xl mb-8"
              style={{ color: "var(--text-primary)" }}
            >
              Atividade Recente
            </h3>

            {recentContributions.length === 0 ? (
              <p
                className="text-sm py-12 text-center"
                style={{ color: "var(--text-muted)" }}
              >
                Nenhum aporte registrado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {recentContributions.map((c) => {
                  const statusInfo = STATUS_MAP[c.status] ?? {
                    label: c.status,
                    variant: "neutral" as const,
                  };
                  const date = new Date(c.created_at).toLocaleDateString(
                    "pt-BR",
                    {
                      day: "2-digit",
                      month: "short",
                    }
                  );

                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-3"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-3">
                        <Activity
                          size={16}
                          style={{ color: "var(--text-muted)" }}
                        />
                        <div>
                          <p
                            className="text-sm font-medium tabular-nums"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {formatBRL(c.amount_brl)}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {date}
                          </p>
                        </div>
                      </div>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* Asset performance table */}
      <motion.div variants={fadeUp} custom={7}>
        <Card padding="lg">
          <h3
            className="font-serif text-xl mb-8"
            style={{ color: "var(--text-primary)" }}
          >
            Performance dos Ativos
          </h3>

          {assetRows.length === 0 ? (
            <p
              className="text-sm py-8 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              Nenhum ativo na carteira.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-left text-xs uppercase tracking-wider"
                    style={{
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <th className="pb-3 font-medium">Ticker</th>
                    <th className="pb-3 font-medium">Classe</th>
                    <th className="pb-3 font-medium text-right">Valor Atual</th>
                    <th className="pb-3 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {assetRows.map((row) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="py-3">
                        <span
                          className="font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {row.ticker}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: "var(--bg-secondary)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {CLASS_LABELS[row.asset_class]}
                        </span>
                      </td>
                      <td
                        className="py-3 text-right tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatBRL(row.totalValue)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className="inline-flex items-center gap-1 tabular-nums font-medium"
                          style={{
                            color:
                              row.pnl > 0
                                ? "var(--success)"
                                : row.pnl < 0
                                  ? "var(--danger)"
                                  : "var(--text-secondary)",
                          }}
                        >
                          {row.pnl > 0 ? (
                            <ArrowUpRight size={14} />
                          ) : row.pnl < 0 ? (
                            <ArrowDownRight size={14} />
                          ) : null}
                          {formatPct(row.pnl)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
