"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationBreakdown } from "@/lib/api";

const COLORS = {
  fixed_income: "oklch(0.55 0.12 195)",
  stocks: "oklch(0.50 0.14 260)",
  crypto: "oklch(0.60 0.16 75)",
};

const LABELS: Record<string, string> = {
  fixed_income: "Renda Fixa",
  stocks: "Ações",
  crypto: "Crypto",
};

interface AllocationChartProps {
  allocation: AllocationBreakdown;
  target: Record<string, number>;
}

export function AllocationChart({ allocation, target }: AllocationChartProps) {
  const data = [
    { name: "Renda Fixa", value: Number(allocation.fixed_income), key: "fixed_income" },
    { name: "Ações", value: Number(allocation.stocks), key: "stocks" },
    { name: "Crypto", value: Number(allocation.crypto), key: "crypto" },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-8">
      <div className="w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={COLORS[entry.key as keyof typeof COLORS]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-3">
        {(["fixed_income", "stocks", "crypto"] as const).map((key) => {
          const pct =
            key === "fixed_income"
              ? (allocation.fixed_income_pct ?? 0)
              : key === "stocks"
                ? (allocation.stocks_pct ?? 0)
                : (allocation.crypto_pct ?? 0);
          const tgt = target[key] || 0;
          const diff = Number(pct) - Number(tgt);

          return (
            <div key={key} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: COLORS[key] }}
              />
              <div className="text-sm min-w-[80px]" style={{ color: "var(--text-primary)" }}>
                {LABELS[key]}
              </div>
              <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {pct.toFixed(1)}%
              </div>
              <div
                className="text-xs tabular-nums"
                style={{
                  color:
                    Math.abs(diff) <= 3
                      ? "var(--text-muted)"
                      : diff > 0
                        ? "var(--danger)"
                        : "var(--success)",
                }}
              >
                ({diff > 0 ? "+" : ""}
                {diff.toFixed(1)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
