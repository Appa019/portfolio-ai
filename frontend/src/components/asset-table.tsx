"use client";

import { Lock, Unlock, AlertTriangle } from "lucide-react";
import type { Asset } from "@/lib/api";

const CLASS_LABELS: Record<string, string> = {
  fixed_income: "RF",
  stocks: "Ações",
  crypto: "Crypto",
};

interface AssetTableProps {
  assets: Asset[];
}

export function AssetTable({ assets }: AssetTableProps) {
  if (assets.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        Nenhum ativo na carteira. Adicione na aba Ativos.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-left text-xs uppercase tracking-wider"
            style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
          >
            <th className="pb-3 font-medium">Ativo</th>
            <th className="pb-3 font-medium">Classe</th>
            <th className="pb-3 font-medium text-right">Qtd</th>
            <th className="pb-3 font-medium text-right">PM</th>
            <th className="pb-3 font-medium text-right">Atual</th>
            <th className="pb-3 font-medium text-right">P&L</th>
            <th className="pb-3 font-medium text-right">Valor</th>
            <th className="pb-3 font-medium text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const currentPrice = asset.current_price ?? asset.avg_price;
            const totalValue = asset.quantity * currentPrice;
            const pnl =
              asset.avg_price > 0
                ? ((currentPrice - asset.avg_price) / asset.avg_price) * 100
                : 0;
            const lockDays = computeLockDays(asset.locked_until);

            return (
              <tr
                key={asset.id}
                className="group"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td className="py-3">
                  <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {asset.ticker}
                  </div>
                  {asset.name && (
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {asset.name}
                    </div>
                  )}
                </td>
                <td className="py-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {CLASS_LABELS[asset.asset_class]}
                  </span>
                </td>
                <td className="py-3 text-right tabular-nums">
                  {formatNumber(asset.quantity)}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {formatBRL(asset.avg_price)}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {formatBRL(currentPrice)}
                </td>
                <td
                  className="py-3 text-right tabular-nums font-medium"
                  style={{
                    color:
                      pnl > 0
                        ? "var(--success)"
                        : pnl < 0
                          ? "var(--danger)"
                          : "var(--text-secondary)",
                  }}
                >
                  {pnl > 0 ? "+" : ""}
                  {pnl.toFixed(2)}%
                </td>
                <td className="py-3 text-right tabular-nums font-semibold">
                  {formatBRL(totalValue)}
                </td>
                <td className="py-3 text-center">
                  {asset.status === "locked" ? (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--warning)" }}>
                      <Lock size={12} />
                      {lockDays}d
                    </span>
                  ) : asset.status === "under_review" ? (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--accent)" }}>
                      <AlertTriangle size={12} />
                      Review
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--success)" }}>
                      <Unlock size={12} />
                      Livre
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function formatNumber(value: number): string {
  if (value >= 1) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(value);
}

function computeLockDays(lockedUntil: string | null): number {
  if (!lockedUntil) return 0;
  const lockDate = new Date(lockedUntil);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lockDate.setHours(0, 0, 0, 0);
  const diff = Math.ceil((lockDate.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}
