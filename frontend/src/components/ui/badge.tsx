"use client";

import type { ReactNode } from "react";

type BadgeVariant =
  | "locked"
  | "free"
  | "under_review"
  | "success"
  | "danger"
  | "warning"
  | "neutral";

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

const variantStyles: Record<
  BadgeVariant,
  { background: string; color: string; border: string }
> = {
  locked: {
    background: "color-mix(in oklch, var(--warning) 15%, transparent)",
    color: "var(--warning)",
    border: "1px solid color-mix(in oklch, var(--warning) 30%, transparent)",
  },
  free: {
    background: "color-mix(in oklch, var(--success) 15%, transparent)",
    color: "var(--success)",
    border: "1px solid color-mix(in oklch, var(--success) 30%, transparent)",
  },
  under_review: {
    background: "color-mix(in oklch, var(--accent) 15%, transparent)",
    color: "var(--accent)",
    border: "1px solid color-mix(in oklch, var(--accent) 30%, transparent)",
  },
  success: {
    background: "color-mix(in oklch, var(--success) 15%, transparent)",
    color: "var(--success)",
    border: "1px solid color-mix(in oklch, var(--success) 30%, transparent)",
  },
  danger: {
    background: "color-mix(in oklch, var(--danger) 15%, transparent)",
    color: "var(--danger)",
    border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
  },
  warning: {
    background: "color-mix(in oklch, var(--warning) 15%, transparent)",
    color: "var(--warning)",
    border: "1px solid color-mix(in oklch, var(--warning) 30%, transparent)",
  },
  neutral: {
    background: "color-mix(in oklch, var(--text-muted) 10%, transparent)",
    color: "var(--text-muted)",
    border: "1px solid color-mix(in oklch, var(--text-muted) 20%, transparent)",
  },
};

export function Badge({ variant, children }: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 10px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: "20px",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        background: styles.background,
        color: styles.color,
        border: styles.border,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
