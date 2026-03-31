"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Lock,
  Unlock,
  AlertTriangle,
  PackageOpen,
} from "lucide-react";
import {
  addAsset,
  removeAsset,
  type Asset,
  type AssetCreate,
} from "@/lib/api";
import { usePortfolio } from "@/hooks/use-portfolio";

const ASSET_CLASSES = [
  { value: "fixed_income", label: "Renda Fixa" },
  { value: "stocks", label: "Acoes" },
  { value: "crypto", label: "Crypto" },
] as const;

const CLASS_LABELS: Record<string, string> = {
  fixed_income: "RF",
  stocks: "Acoes",
  crypto: "Crypto",
};

const FILTER_TABS = [
  { value: "all", label: "Todos" },
  { value: "stocks", label: "Acoes" },
  { value: "crypto", label: "Crypto" },
  { value: "fixed_income", label: "Renda Fixa" },
] as const;

type SortField =
  | "ticker"
  | "asset_class"
  | "quantity"
  | "avg_price"
  | "current_price"
  | "pnl"
  | "total_value"
  | "status";
type SortDirection = "asc" | "desc";

function AtivosPage() {
  const { data, loading, refresh } = usePortfolio();
  const [showAddForm, setShowAddForm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Asset | null>(null);
  const [formData, setFormData] = useState<Partial<AssetCreate>>({
    asset_class: "stocks",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("ticker");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (removeTarget) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [removeTarget]);

  // Clear message after 4 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const filteredAndSorted = useMemo(() => {
    const assets = data?.assets || [];
    const filtered =
      filter === "all"
        ? assets
        : assets.filter((a) => a.asset_class === filter);

    return [...filtered].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      const currentA = a.current_price ?? a.avg_price;
      const currentB = b.current_price ?? b.avg_price;

      switch (sortField) {
        case "ticker":
          return dir * a.ticker.localeCompare(b.ticker);
        case "asset_class":
          return dir * a.asset_class.localeCompare(b.asset_class);
        case "quantity":
          return dir * (a.quantity - b.quantity);
        case "avg_price":
          return dir * (a.avg_price - b.avg_price);
        case "current_price":
          return dir * (currentA - currentB);
        case "pnl": {
          const pnlA =
            a.avg_price > 0
              ? ((currentA - a.avg_price) / a.avg_price) * 100
              : 0;
          const pnlB =
            b.avg_price > 0
              ? ((currentB - b.avg_price) / b.avg_price) * 100
              : 0;
          return dir * (pnlA - pnlB);
        }
        case "total_value":
          return dir * (a.quantity * currentA - b.quantity * currentB);
        case "status":
          return dir * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }, [data?.assets, filter, sortField, sortDirection]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (
      !formData.ticker ||
      !formData.quantity ||
      !formData.avg_price ||
      !formData.asset_class
    ) {
      setMessage({
        type: "error",
        text: "Preencha todos os campos obrigatorios",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addAsset(formData as AssetCreate);
      setMessage({
        type: "success",
        text: `${formData.ticker} adicionado com sucesso`,
      });
      setFormData({ asset_class: "stocks" });
      setShowAddForm(false);
      await refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao adicionar",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setIsSubmitting(true);
    try {
      await removeAsset(removeTarget.id);
      setMessage({ type: "success", text: `${removeTarget.ticker} removido` });
      setRemoveTarget(null);
      await refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao remover",
      });
    } finally {
      setIsSubmitting(false);
    }
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
            Ativos
          </h2>
          <p
            className="font-sans text-sm mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            Gerencie os ativos da sua carteira
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {showAddForm ? (
            <ChevronUp size={16} />
          ) : (
            <Plus size={16} />
          )}
          {showAddForm ? "Fechar" : "Adicionar"}
        </button>
      </div>

      {/* Message toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-lg font-sans text-sm font-medium"
            style={{
              background:
                message.type === "success"
                  ? "var(--accent-light)"
                  : "oklch(0.95 0.04 25)",
              color:
                message.type === "success"
                  ? "var(--accent)"
                  : "var(--danger)",
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Form — Collapsible */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="p-8 rounded-lg"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <h3
                className="font-serif text-lg mb-6"
                style={{ color: "var(--text-primary)" }}
              >
                Adicionar Ativo
              </h3>
              <form
                onSubmit={handleAdd}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl"
              >
                <InputField
                  label="Ticker"
                  value={formData.ticker || ""}
                  onChange={(v) =>
                    setFormData({ ...formData, ticker: v.toUpperCase() })
                  }
                  placeholder="PETR4"
                />
                <InputField
                  label="Nome (opcional)"
                  value={formData.name || ""}
                  onChange={(v) => setFormData({ ...formData, name: v })}
                  placeholder="Petrobras PN"
                />
                <div>
                  <label
                    htmlFor="asset-class-select"
                    className="font-sans text-xs uppercase tracking-wider font-medium block mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Classe
                  </label>
                  <select
                    id="asset-class-select"
                    value={formData.asset_class}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        asset_class:
                          e.target.value as AssetCreate["asset_class"],
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-lg font-sans text-sm outline-none"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {ASSET_CLASSES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Quantidade"
                  value={formData.quantity?.toString() || ""}
                  onChange={(v) =>
                    setFormData({ ...formData, quantity: parseFloat(v) || 0 })
                  }
                  placeholder="100"
                  type="number"
                />
                <InputField
                  label="Preco Medio (R$)"
                  value={formData.avg_price?.toString() || ""}
                  onChange={(v) =>
                    setFormData({ ...formData, avg_price: parseFloat(v) || 0 })
                  }
                  placeholder="38.50"
                  type="number"
                />
                <InputField
                  label="Data Entrada"
                  value={formData.entry_date || ""}
                  onChange={(v) =>
                    setFormData({ ...formData, entry_date: v })
                  }
                  type="date"
                />
                <div className="sm:col-span-2 lg:col-span-3 flex gap-3 mt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity disabled:opacity-40 cursor-pointer"
                    style={{ background: "var(--accent)", color: "white" }}
                  >
                    {isSubmitting ? "Adicionando..." : "Adicionar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-2.5 rounded-lg font-sans text-sm font-medium cursor-pointer"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className="px-4 py-2 rounded-lg font-sans text-sm font-medium transition-colors cursor-pointer"
            style={{
              background:
                filter === tab.value
                  ? "var(--accent)"
                  : "var(--bg-secondary)",
              color: filter === tab.value ? "white" : "var(--text-secondary)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        {loading ? (
          <div className="p-8">
            <div
              className="animate-pulse h-48 rounded"
              style={{ background: "var(--bg-secondary)" }}
            />
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="text-center py-16">
            <PackageOpen
              size={40}
              className="mx-auto mb-4"
              style={{ color: "var(--border-strong)" }}
            />
            <p
              className="font-sans text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Nenhum ativo encontrado
            </p>
            <p
              className="font-sans text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              {filter !== "all"
                ? "Tente outro filtro ou adicione um ativo"
                : "Clique em Adicionar para comecar"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-sans text-sm">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wider"
                  style={{
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <SortableHeader
                    label="Ativo"
                    field="ticker"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Classe"
                    field="asset_class"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Qtd"
                    field="quantity"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="PM"
                    field="avg_price"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Atual"
                    field="current_price"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="P&L"
                    field="pnl"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Valor"
                    field="total_value"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Status"
                    field="status"
                    current={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="center"
                  />
                  <th className="px-4 pb-3 font-medium w-12" />
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((asset) => {
                  const currentPrice = asset.current_price ?? asset.avg_price;
                  const totalValue = asset.quantity * currentPrice;
                  const pnl =
                    asset.avg_price > 0
                      ? ((currentPrice - asset.avg_price) / asset.avg_price) *
                        100
                      : 0;
                  const lockDays = computeLockDays(asset.locked_until);

                  return (
                    <tr
                      key={asset.id}
                      className="group transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td className="px-4 py-3.5">
                        <span
                          className="font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {asset.ticker}
                        </span>
                        {asset.name && (
                          <span
                            className="block text-xs mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {asset.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            background: "var(--bg-secondary)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {CLASS_LABELS[asset.asset_class]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatNumber(asset.quantity)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatBRL(asset.avg_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatBRL(currentPrice)}
                      </td>
                      <td
                        className="px-4 py-3.5 text-right tabular-nums font-medium"
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
                      <td
                        className="px-4 py-3.5 text-right tabular-nums font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatBRL(totalValue)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {asset.status === "locked" ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: "var(--warning)" }}
                          >
                            <Lock size={12} />
                            {lockDays}d
                          </span>
                        ) : asset.status === "under_review" ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: "var(--accent)" }}
                          >
                            <AlertTriangle size={12} />
                            Review
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: "var(--success)" }}
                          >
                            <Unlock size={12} />
                            Livre
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {asset.status === "free" && (
                          <button
                            onClick={() => setRemoveTarget(asset)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-[var(--bg-secondary)] cursor-pointer"
                            title={`Remover ${asset.ticker}`}
                          >
                            <Trash2
                              size={14}
                              style={{ color: "var(--danger)" }}
                            />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Remove Confirmation Modal */}
      <dialog
        ref={dialogRef}
        onClose={() => setRemoveTarget(null)}
        className="p-8 rounded-lg max-w-md w-full backdrop:bg-black/30"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        {removeTarget && (
          <>
            <h3
              className="font-serif text-lg mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Remover {removeTarget.ticker}?
            </h3>
            <p
              className="font-sans text-sm mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              Esta acao nao pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRemove}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity disabled:opacity-40 cursor-pointer"
                style={{ background: "var(--danger)", color: "white" }}
              >
                {isSubmitting ? "Removendo..." : "Remover"}
              </button>
              <button
                onClick={() => setRemoveTarget(null)}
                className="px-6 py-2.5 rounded-lg font-sans text-sm font-medium cursor-pointer"
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

// Sortable table header
function SortableHeader({
  label,
  field,
  current,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortField;
  current: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  align?: "left" | "right" | "center";
}) {
  const isActive = current === field;
  const textAlign =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";
  const justify =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <th className={`px-4 pb-3 font-medium ${textAlign}`}>
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 cursor-pointer ${justify}`}
        style={{ color: isActive ? "var(--text-primary)" : undefined }}
      >
        {label}
        {isActive ? (
          direction === "asc" ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )
        ) : (
          <ArrowUpDown size={10} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return (
    <div>
      <label
        htmlFor={id}
        className="font-sans text-xs uppercase tracking-wider font-medium block mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === "number" ? "any" : undefined}
        className="w-full px-4 py-2.5 rounded-lg font-sans text-sm outline-none"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      />
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
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 8,
  }).format(value);
}

function computeLockDays(lockedUntil: string | null): number {
  if (!lockedUntil) return 0;
  const lockDate = new Date(lockedUntil);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lockDate.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (lockDate.getTime() - today.getTime()) / 86400000
  );
  return Math.max(0, diff);
}

export { AtivosPage as default };
