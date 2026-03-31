"use client";

import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

const paddingMap: Record<NonNullable<CardProps["padding"]>, string> = {
  sm: "12px 16px",
  md: "20px 24px",
  lg: "32px 36px",
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: paddingMap[padding],
      }}
    >
      {children}
    </div>
  );
}
