"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Inbox,
} from "lucide-react";
import { fetchWeeklyReports, triggerJob, type WeeklyReport } from "@/lib/api";

function RelatoriosPage() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchWeeklyReports();
      setReports(data);
    } catch {
      setReports([]);
      setError("Falha ao carregar relatorios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await triggerJob("weekly_report");
      // Wait briefly then reload
      setTimeout(() => {
        loadReports();
      }, 2000);
    } catch {
      setError("Falha ao iniciar geracao do relatorio");
    } finally {
      setGenerating(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="font-serif text-4xl tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Relatorios
          </h2>
          <p
            className="font-sans text-sm mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            Relatorios semanais gerados automaticamente toda sexta-feira
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity disabled:opacity-40 cursor-pointer"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <RefreshCw
            size={16}
            className={generating ? "animate-spin" : ""}
          />
          {generating ? "Gerando..." : "Gerar Agora"}
        </button>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-4 rounded-lg font-sans text-sm"
            style={{
              background: "oklch(0.95 0.04 25)",
              color: "var(--danger)",
            }}
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports list */}
      {loading ? (
        <div
          className="p-8 rounded-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="animate-pulse h-32 rounded"
            style={{ background: "var(--bg-secondary)" }}
          />
        </div>
      ) : reports.length === 0 ? (
        <div
          className="rounded-lg text-center py-20"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <Inbox
            size={44}
            className="mx-auto mb-4"
            style={{ color: "var(--border-strong)" }}
          />
          <p
            className="font-sans text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Nenhum relatorio gerado ainda
          </p>
          <p
            className="font-sans text-xs mt-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            O primeiro sera gerado automaticamente na proxima sexta-feira ou
            clique em &quot;Gerar Agora&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isExpanded = expandedId === report.id;
            const content = report.content as ReportContent;

            return (
              <motion.div
                key={report.id}
                layout
                className="rounded-lg overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Report header — clickable */}
                <button
                  onClick={() => toggleExpand(report.id)}
                  className="w-full flex items-center justify-between p-6 text-left cursor-pointer transition-colors"
                  style={{
                    background: isExpanded
                      ? "var(--bg-secondary)"
                      : "transparent",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <FileText
                      size={18}
                      style={{ color: "var(--accent)" }}
                    />
                    <div>
                      <p
                        className="font-sans text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatDate(report.period_start)} &mdash;{" "}
                        {formatDate(report.period_end)}
                      </p>
                      <div
                        className="flex items-center gap-3 mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="inline-flex items-center gap-1 font-sans text-xs">
                          <Clock size={11} />
                          {formatDateTime(report.generated_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown
                      size={18}
                      style={{ color: "var(--text-muted)" }}
                    />
                  ) : (
                    <ChevronRight
                      size={18}
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </button>

                {/* Expandable content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-6 pb-6 space-y-6"
                        style={{
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        {/* Summary */}
                        {(report.summary || Boolean(content?.summary)) && (
                          <ReportSection
                            title="Resumo"
                            icon={
                              <FileText
                                size={14}
                                style={{ color: "var(--accent)" }}
                              />
                            }
                          >
                            <p
                              className="font-sans text-sm leading-relaxed"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {report.summary ||
                                (typeof content?.summary === "string"
                                  ? content.summary
                                  : JSON.stringify(content?.summary))}
                            </p>
                          </ReportSection>
                        )}

                        {/* Performance */}
                        {Boolean(content?.performance) && (
                          <ReportSection
                            title="Performance"
                            icon={
                              <TrendingUp
                                size={14}
                                style={{ color: "var(--success)" }}
                              />
                            }
                          >
                            <RenderContentBlock
                              data={content.performance}
                            />
                          </ReportSection>
                        )}

                        {/* Alerts */}
                        {Boolean(content?.alerts) && (
                          <ReportSection
                            title="Alertas"
                            icon={
                              <AlertCircle
                                size={14}
                                style={{ color: "var(--warning)" }}
                              />
                            }
                          >
                            <RenderContentBlock data={content.alerts} />
                          </ReportSection>
                        )}

                        {/* Macro */}
                        {Boolean(content?.macro) && (
                          <ReportSection
                            title="Macro"
                            icon={
                              <BarChart3
                                size={14}
                                style={{ color: "var(--text-secondary)" }}
                              />
                            }
                          >
                            <RenderContentBlock data={content.macro} />
                          </ReportSection>
                        )}

                        {/* Fallback if no known sections */}
                        {!content?.summary &&
                          !report.summary &&
                          !content?.performance &&
                          !content?.alerts &&
                          !content?.macro && (
                            <div className="pt-4">
                              <pre
                                className="font-sans text-xs overflow-auto p-4 rounded-lg max-h-96"
                                style={{
                                  background: "var(--bg-secondary)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {JSON.stringify(report.content, null, 2)}
                              </pre>
                            </div>
                          )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Expected report content shape
interface ReportContent {
  summary?: string | Record<string, unknown>;
  performance?: unknown;
  alerts?: unknown;
  macro?: unknown;
}

function ReportSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4
          className="font-sans text-xs uppercase tracking-wider font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

// Render content blocks as readable text
function RenderContentBlock({ data }: { data: unknown }) {
  if (typeof data === "string") {
    return (
      <p
        className="font-sans text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {data}
      </p>
    );
  }

  if (Array.isArray(data)) {
    return (
      <ul className="space-y-1.5">
        {data.map((item, i) => (
          <li
            key={i}
            className="font-sans text-sm leading-relaxed flex items-start gap-2"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "var(--border-strong)" }}
            />
            {typeof item === "string" ? item : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div
            key={key}
            className="flex items-baseline justify-between py-1.5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span
              className="font-sans text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {key.replace(/_/g, " ")}
            </span>
            <span
              className="font-sans text-sm font-medium tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {typeof val === "string" || typeof val === "number"
                ? String(val)
                : JSON.stringify(val)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export { RelatoriosPage as default };
