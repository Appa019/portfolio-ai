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
  Save,
  AlertTriangle,
} from "lucide-react";
import {
  fetchSchedulerJobs,
  fetchAllocationTargets,
  saveAllocationTargets,
  triggerJob,
  API_BASE,
  type SchedulerJob,
  type AllocationTargets,
} from "@/lib/api";

function ConfiguracoesPage() {
  const [targets, setTargets] = useState<AllocationTargets>({
    fixed_income: 35,
    stocks: 40,
    crypto: 25,
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saved" | "error"
  >("idle");
  const [loadingTargets, setLoadingTargets] = useState(true);

  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  const [healthStatus, setHealthStatus] = useState<
    "loading" | "healthy" | "unhealthy"
  >("loading");
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(
    null
  );

  // Load targets from Supabase via backend
  useEffect(() => {
    fetchAllocationTargets()
      .then((data) => setTargets(data))
      .catch(() => {})
      .finally(() => setLoadingTargets(false));
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await fetchSchedulerJobs());
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setHealthStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setHealthData((await res.json()) as Record<string, unknown>);
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

  const total = targets.fixed_income + targets.stocks + targets.crypto;
  const isValid = Math.abs(total - 100) < 0.5;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      await saveAllocationTargets(targets);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTriggerJob(jobId: string) {
    setTriggeringJob(jobId);
    try {
      await triggerJob(jobId);
      await loadJobs();
    } catch {
      // silent
    } finally {
      setTriggeringJob(null);
    }
  }

  return (
    <div className="space-y-12">
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
        <div className="flex items-center gap-3 mb-8">
          <Sliders size={18} style={{ color: "var(--accent)" }} />
          <h3
            className="font-serif text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            Alocacao Alvo
          </h3>
        </div>

        {loadingTargets ? (
          <div
            className="animate-pulse h-40 rounded"
            style={{ background: "var(--bg-secondary)" }}
          />
        ) : (
          <div className="max-w-xl space-y-8">
            {/* Independent sliders */}
            <SliderField
              label="Renda Fixa"
              value={targets.fixed_income}
              onChange={(v) =>
                setTargets((prev) => ({ ...prev, fixed_income: v }))
              }
              color="var(--accent)"
            />
            <SliderField
              label="Acoes"
              value={targets.stocks}
              onChange={(v) =>
                setTargets((prev) => ({ ...prev, stocks: v }))
              }
              color="var(--success)"
            />
            <SliderField
              label="Crypto"
              value={targets.crypto}
              onChange={(v) =>
                setTargets((prev) => ({ ...prev, crypto: v }))
              }
              color="var(--warning)"
            />

            {/* Visual bar */}
            <div>
              <div
                className="h-3 rounded-full overflow-hidden flex"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${targets.fixed_income}%`,
                    background: "var(--accent)",
                  }}
                />
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${targets.stocks}%`,
                    background: "var(--success)",
                  }}
                />
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${targets.crypto}%`,
                    background: "var(--warning)",
                  }}
                />
              </div>

              {/* Total indicator */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-4">
                  <LegendDot color="var(--accent)" label="RF" />
                  <LegendDot color="var(--success)" label="Acoes" />
                  <LegendDot color="var(--warning)" label="Crypto" />
                </div>
                <div className="flex items-center gap-2">
                  {!isValid && (
                    <AlertTriangle
                      size={14}
                      style={{ color: "var(--danger)" }}
                    />
                  )}
                  <span
                    className="font-sans text-sm font-semibold tabular-nums"
                    style={{
                      color: isValid
                        ? "var(--success)"
                        : "var(--danger)",
                    }}
                  >
                    {total}%
                  </span>
                  <span
                    className="font-sans text-xs"
                    style={{
                      color: isValid
                        ? "var(--text-muted)"
                        : "var(--danger)",
                    }}
                  >
                    {isValid ? "OK" : "deve ser 100%"}
                  </span>
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={!isValid || saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-sans text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                style={{ background: "var(--accent)", color: "white" }}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : saveStatus === "saved" ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Save size={14} />
                )}
                {saving
                  ? "Salvando..."
                  : saveStatus === "saved"
                    ? "Salvo!"
                    : "Salvar"}
              </button>
              {saveStatus === "error" && (
                <span
                  className="font-sans text-xs"
                  style={{ color: "var(--danger)" }}
                >
                  Erro ao salvar. Backend online?
                </span>
              )}
            </div>
          </div>
        )}
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
                      {job.trigger}
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
              {healthData?.version ? String(healthData.version) : "—"}
            </span>
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

function SliderField({
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
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 0 && v <= 100) onChange(v);
            }}
            className="w-14 text-right font-sans text-sm font-semibold tabular-nums rounded px-2 py-1"
            style={{
              color,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          />
          <span
            className="font-sans text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            %
          </span>
        </div>
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
