"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  icon?: ReactNode;
}

export function KpiCard({ label, value, delta, icon }: KpiCardProps) {
  const deltaColor =
    delta !== undefined && delta >= 0 ? "var(--success)" : "var(--danger)";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {icon && (
          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            {icon}
          </span>
        )}
      </div>

      {/* Value row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
        }}
      >
        <span
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>

        {delta !== undefined && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "13px",
              fontWeight: 600,
              color: deltaColor,
            }}
          >
            {delta >= 0 ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}
