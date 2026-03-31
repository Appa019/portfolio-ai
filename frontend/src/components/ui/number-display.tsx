"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

type NumberFormat = "currency" | "percent" | "number";
type NumberSize = "sm" | "md" | "lg";

interface NumberDisplayProps {
  value: number;
  format?: NumberFormat;
  delta?: number;
  size?: NumberSize;
}

const sizeStyles: Record<NumberSize, { fontSize: string; deltaSize: string }> =
  {
    sm: { fontSize: "16px", deltaSize: "11px" },
    md: { fontSize: "24px", deltaSize: "13px" },
    lg: { fontSize: "36px", deltaSize: "14px" },
  };

function formatValue(value: number, format: NumberFormat): string {
  switch (format) {
    case "currency":
      return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "percent":
      return value.toLocaleString("pt-BR", {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "number":
      return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  }
}

export function NumberDisplay({
  value,
  format = "currency",
  delta,
  size = "md",
}: NumberDisplayProps) {
  const styles = sizeStyles[size];
  const deltaColor =
    delta !== undefined && delta >= 0 ? "var(--success)" : "var(--danger)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: "8px",
      }}
    >
      <span
        style={{
          fontSize: styles.fontSize,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {formatValue(value, format)}
      </span>

      {delta !== undefined && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "2px",
            fontSize: styles.deltaSize,
            fontWeight: 600,
            color: deltaColor,
          }}
        >
          {delta >= 0 ? (
            <TrendingUp size={parseInt(styles.deltaSize) - 1} />
          ) : (
            <TrendingDown size={parseInt(styles.deltaSize) - 1} />
          )}
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(2)}%
        </span>
      )}
    </span>
  );
}
