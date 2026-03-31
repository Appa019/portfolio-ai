"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Server,
  Sliders,
} from "lucide-react";
import {
  fetchSchedulerJobs,
  triggerJob,
  API_BASE,
  type SchedulerJob,
} from "@/lib/api";

// Allocation targets stored in localStorage
interface AllocationTargets {
  fixed_income: number;
  stocks: number;
  crypto: number;
}

const STORAGE_KEY = "portfolio_allocation_targets";
const DEFAULT_TARGETS: AllocationTargets = {
  fixed_income: 40,
  stocks: 40,
  crypto: 20,
};

function loadTargets(): AllocationTargets {
  if (typeof window === "undefined") return DEFAULT_TARGETS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AllocationTargets;
      const sum = parsed.fixed_income + parsed.stocks + parsed.crypto;
      if (Math.abs(sum - 100) < 0.5) return parsed;
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_TARGETS;
}

function saveTargets(targets: AllocationTargets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
}

function ConfiguracoesPage() {
  // Allocation state
  const [targets, setTargets] = useState<AllocationTargets>(DEFAULT_TARGETS);
  const [targetsSaved, setTargetsSaved] = useState(false);

  // Scheduler state
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  // Health state
  const [healthStatus, setHealthStatus] = useState<
    "loading" | "healthy" | "unhealthy"
  >("loading");
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(
    null
  );

  // Load allocation targets from localStorage
  useEffect(() => {
    setTargets(loadTargets());
  }, []);

  // Fetch scheduler jobs
  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchSchedulerJobs();
      setJobs(data);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // Health check
  const checkHealth = useCallback(async () => {
    setHealthStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data as Record<string, unknown>);
        setHealthStatus("healthy");
      } else {
        setHealthStatus("unhealthy");
      }
    } catch {
      setHealthStatus("unhealthy");
    }
  }, []);

  useEffect(() => {
    loadJobs();
    checkHealth();
  }, [loadJobs, checkHealth]);

  // Allocation handlers
  function handleSliderChange(
    field: keyof AllocationTargets,
    value: number
  ) {
    setTargetsSaved(false);
    setTargets((prev) => {
      const updated = { ...prev, [field]: value };
      const otherFields = (
        Object.keys(prev) as Array<keyof AllocationTargets>
      ).filter((k) => k !== field);
      const remaining = 100 - value;
      const otherTotal = otherFields.reduce((sum, k) => sum + prev[k], 0);

      if (otherTotal === 0) {
        const each = Math.round(remaining / otherFields.length);
        otherFields.forEach((k, i) => {
          updated[k] =
            i === otherFields.length - 1
              ? remaining - each * (otherFields.length - 1)
              : each;
        });
      } else {
        let distributed = 0;
        otherFields.forEach((k, i) => {
          if (i === otherFields.length - 1) {
            updated[k] = Math.max(0, remaining - distributed);
          } else {
            const proportion = prev[k] / otherTotal;
            const share = Math.round(remaining * proportion);
            updated[k] = Math.max(0, share);
            distributed += updated[k];
          }
        });
      }

      return updated;
    });
  }

  function handleSaveTargets() {
    saveTargets(targets);
    setTargetsSaved(true);
    setTimeout(() => setTargetsSaved(false), 2000);
  }

  async function handleTriggerJob(jobId: string) {
    setTriggeringJob(jobId);
    try {
      await triggerJob(jobId);
      await loadJobs();
    } catch {
      // Silent fail
    } finally {
      setTriggeringJob(null);
    }
  }

  const allocationSum = targets.fixed_income + targets.stocks + targets.crypto;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h2
          className="font-serif text-4xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Configuracoes
        </h2>
        <p
          className="font-sans text-sm mt-2"
          style={{ color: "var(--text-muted)" }}
        >
          Ajustes da carteira, scheduler e sistema
        </p>
      </div>

      {/* Allocation targets */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="p-8 rounded-lg"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Sliders size={18} style={{ color: "var(--accent)" }} />
          <h3
            className="font-serif text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            Alocacao Alvo
          </h3>
        </div>

        <div className="max-w-xl space-y-6">
          <AllocationSlider
            label="Renda Fixa"
            value={targets.fixed_income}
            onChange={(v) => handleSliderChange("fixed_income", v)}
            color="var(--accent)"
          />
          <AllocationSlider
            label="Acoes"
            value={targets.stocks}
            onChange={(v) => handleSliderChange("stocks", v)}
            color="var(--success)"
          />
          <AllocationSlider
            label="Crypto"
            value={targets.crypto}
            onChange={(v) => handleSliderChange("crypto", v)}
            color="var(--warning)"
          />

          {/* Visual distribution bar */}
          <div className="pt-2">
            <div
              className="h-3 rounded-full overflow-hidden flex"
              style={{ background: "var(--bg-secondary)" }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${targets.fixed_income}%`,
                  background: "var(--accent)",
                }}
              />
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${targets.stocks}%`,
                  background: "var(--success)",
                }}
              />
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${targets.crypto}%`,
                  background: "var(--warning)",
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-4">
                <LegendDot color="var(--accent)" label="RF" />
                <LegendDot color="var(--success)" label="Acoes" />
                <LegendDot color="var(--warning)" label="Crypto" />
              </div>
              <span
                className="font-sans text-xs tabular-nums font-medium"
                style={{
                  color:
                    Math.abs(allocationSum - 100) < 0.5
                      ? "var(--text-muted)"
                      : "var(--danger)",
                }}
              >
                Total: {allocationSum}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveTargets}
              disabled={Math.abs(allocationSum - 100) > 0.5}
              className="px-5 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              style={{ background: "var(--accent)", color: "white" }}
            >
              {targetsSaved ? "Salvo" : "Salvar"}
            </button>
            <span
              className="font-sans text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Salvar localmente
            </span>
          </div>
        </div>
      </motion.section>

      {/* Scheduler */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="p-8 rounded-lg"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Clock size={18} style={{ color: "var(--accent)" }} />
          <h3
            className="font-serif text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            Scheduler Status
          </h3>
        </div>

        {jobsLoading ? (
          <div
            className="animate-pulse h-20 rounded"
            style={{ background: "var(--bg-secondary)" }}
          />
        ) : jobs.length === 0 ? (
          <p
            className="font-sans text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhum job agendado encontrado
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <p
                    className="font-sans text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {job.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className="font-sans text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Trigger: {job.trigger}
                    </span>
                    {job.next_run && (
                      <span
                        className="font-sans text-xs tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Proximo:{" "}
                        {new Date(job.next_run).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleTriggerJob(job.id)}
                  disabled={triggeringJob === job.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-medium transition-opacity disabled:opacity-40 cursor-pointer"
                  style={{
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                  }}
                >
                  {triggeringJob === job.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  Executar
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* System */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="p-8 rounded-lg"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Server size={18} style={{ color: "var(--accent)" }} />
          <h3
            className="font-serif text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            Sistema
          </h3>
        </div>

        <div className="space-y-4 max-w-lg">
          {/* Health status */}
          <div
            className="flex items-center justify-between p-4 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              {healthStatus === "loading" ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                  style={{ color: "var(--text-muted)" }}
                />
              ) : healthStatus === "healthy" ? (
                <CheckCircle2
                  size={16}
                  style={{ color: "var(--success)" }}
                />
              ) : (
                <XCircle size={16} style={{ color: "var(--danger)" }} />
              )}
              <span
                className="font-sans text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Backend
              </span>
            </div>
            <span
              className="font-sans text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background:
                  healthStatus === "healthy"
                    ? "oklch(0.95 0.12 145)"
                    : healthStatus === "unhealthy"
                      ? "oklch(0.95 0.04 25)"
                      : "var(--bg-secondary)",
                color:
                  healthStatus === "healthy"
                    ? "var(--success)"
                    : healthStatus === "unhealthy"
                      ? "var(--danger)"
                      : "var(--text-muted)",
              }}
            >
              {healthStatus === "loading"
                ? "Verificando..."
                : healthStatus === "healthy"
                  ? "Online"
                  : "Offline"}
            </span>
          </div>

          {/* Version */}
          <div
            className="flex items-center justify-between p-4 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="font-sans text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Versao
            </span>
            <span
              className="font-sans text-xs font-medium tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {healthData?.version
                ? String(healthData.version)
                : "1.0.0"}
            </span>
          </div>

          {/* API URL */}
          <div
            className="flex items-center justify-between p-4 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="font-sans text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              API URL
            </span>
            <code
              className="font-sans text-xs px-2 py-0.5 rounded"
              style={{
                background: "var(--bg-primary)",
                color: "var(--text-muted)",
              }}
            >
              {API_BASE}
            </code>
          </div>

          <button
            onClick={checkHealth}
            className="font-sans text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 cursor-pointer"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            Verificar novamente
          </button>
        </div>
      </motion.section>
    </div>
  );
}

function AllocationSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const id = `slider-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={id}
          className="font-sans text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </label>
        <span
          className="font-sans text-sm font-semibold tabular-nums"
          style={{ color }}
        >
          {value}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${value}%, var(--bg-secondary) ${value}%)`,
          accentColor: color,
        }}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      <span
        className="font-sans text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

export { ConfiguracoesPage as default };
