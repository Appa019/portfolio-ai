"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Lock,
  Unlock,
  AlertTriangle,
  PackageOpen,
  DollarSign,
} from "lucide-react";
import {
  addAsset,
  sellAsset,
  type Asset,
  type AssetCreate,
  type SaleResult,
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
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [sellTarget, setSellTarget] = useState<Asset | null>(null);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
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
    if (sellTarget) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [sellTarget]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
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

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault();
    if (
      !formData.ticker ||
      !formData.quantity ||
      !formData.avg_price ||
      !formData.asset_class
    ) {
      setMessage({ type: "error", text: "Preencha todos os campos obrigatorios" });
      return;
    }

    setIsSubmitting(true);
    try {
      await addAsset(formData as AssetCreate);
      setMessage({ type: "success", text: `Compra de ${formData.ticker} registrada` });
      setFormData({ asset_class: "stocks" });
      setShowBuyForm(false);
      await refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao comprar",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSell() {
    if (!sellTarget) return;
    setIsSubmitting(true);
    try {
      const result = await sellAsset(sellTarget.id);
      setLastSale(result);
      setMessage({
        type: "success",
        text: `${result.ticker} vendido por ${formatBRL(result.sale_value)}. Redistribua esse valor em um novo aporte.`,
      });
      setSellTarget(null);
      await refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao vender",
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
            Compre e venda ativos da sua carteira
          </p>
        </div>
        <button
          onClick={() => setShowBuyForm(!showBuyForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
          style={{ background: "var(--success)", color: "white" }}
        >
          {showBuyForm ? <ChevronUp size={16} /> : <Plus size={16} />}
          {showBuyForm ? "Fechar" : "Comprar"}
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
                message.type === "success" ? "var(--accent)" : "var(--danger)",
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last sale redistribution banner */}
      <AnimatePresence>
        {lastSale && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-5 rounded-lg flex items-center justify-between"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--accent)",
            }}
          >
            <div className="flex items-center gap-3">
              <DollarSign size={20} style={{ color: "var(--accent)" }} />
              <div>
                <p
                  className="font-sans text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatBRL(lastSale.sale_value)} disponivel para
                  redistribuicao
                </p>
                <p
                  className="font-sans text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Venda de {lastSale.ticker} ({lastSale.quantity} un. a{" "}
                  {formatBRL(lastSale.price)})
                </p>
              </div>
            </div>
            <button
              onClick={() => setLastSale(null)}
              className="font-sans text-xs px-3 py-1.5 rounded cursor-pointer"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-muted)",
              }}
            >
              Dispensar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buy Form */}
      <AnimatePresence>
        {showBuyForm && (
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
                Registrar Compra
              </h3>
              <form
                onSubmit={handleBuy}
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
                  label="Preco (R$)"
                  value={formData.avg_price?.toString() || ""}
                  onChange={(v) =>
                    setFormData({ ...formData, avg_price: parseFloat(v) || 0 })
                  }
                  placeholder="38.50"
                  type="number"
                />
                <InputField
                  label="Data"
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
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity disabled:opacity-40 cursor-pointer"
                    style={{ background: "var(--success)", color: "white" }}
                  >
                    <Plus size={14} />
                    {isSubmitting ? "Comprando..." : "Comprar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBuyForm(false)}
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
                filter === tab.value ? "var(--accent)" : "var(--bg-secondary)",
              color:
                filter === tab.value ? "white" : "var(--text-secondary)",
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
              Clique em Comprar para adicionar
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
                  <SortableHeader label="Ativo" field="ticker" current={sortField} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Classe" field="asset_class" current={sortField} direction={sortDirection} onSort={handleSort} />
                  <SortableHeader label="Qtd" field="quantity" current={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader label="PM" field="avg_price" current={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader label="Atual" field="current_price" current={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader label="P&L" field="pnl" current={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader label="Valor" field="total_value" current={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                  <SortableHeader label="Status" field="status" current={sortField} direction={sortDirection} onSort={handleSort} align="center" />
                  <th className="px-4 pb-3 font-medium w-20" />
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((asset) => {
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
                      className="group transition-colors"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {asset.ticker}
                        </span>
                        {asset.name && (
                          <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {asset.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                        >
                          {CLASS_LABELS[asset.asset_class]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{formatNumber(asset.quantity)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{formatBRL(asset.avg_price)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{formatBRL(currentPrice)}</td>
                      <td
                        className="px-4 py-3.5 text-right tabular-nums font-medium"
                        style={{
                          color: pnl > 0 ? "var(--success)" : pnl < 0 ? "var(--danger)" : "var(--text-secondary)",
                        }}
                      >
                        {pnl > 0 ? "+" : ""}{pnl.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                        {formatBRL(totalValue)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {asset.status === "locked" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--warning)" }}>
                            <Lock size={12} />{lockDays}d
                          </span>
                        ) : asset.status === "under_review" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                            <AlertTriangle size={12} />Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--success)" }}>
                            <Unlock size={12} />Livre
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {asset.status === "free" && (
                          <button
                            onClick={() => setSellTarget(asset)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-sans text-xs font-semibold transition-opacity hover:opacity-80 cursor-pointer"
                            style={{ background: "oklch(0.95 0.04 25)", color: "var(--danger)" }}
                          >
                            <Minus size={12} />
                            Vender
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

      {/* Sell Confirmation Modal */}
      <dialog
        ref={dialogRef}
        onClose={() => setSellTarget(null)}
        className="p-8 rounded-lg max-w-md w-full backdrop:bg-black/30"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {sellTarget && (
          <>
            <h3 className="font-serif text-lg mb-2" style={{ color: "var(--text-primary)" }}>
              Vender {sellTarget.ticker}?
            </h3>
            <div
              className="p-4 rounded-lg mb-4"
              style={{ background: "var(--bg-secondary)" }}
            >
              <div className="flex justify-between mb-2">
                <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>Quantidade</span>
                <span className="font-sans text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatNumber(sellTarget.quantity)}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="font-sans text-xs" style={{ color: "var(--text-muted)" }}>Preco Atual</span>
                <span className="font-sans text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatBRL(sellTarget.current_price ?? sellTarget.avg_price)}
                </span>
              </div>
              <div
                className="flex justify-between pt-2"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="font-sans text-xs font-medium" style={{ color: "var(--text-muted)" }}>Valor Total</span>
                <span className="font-sans text-lg font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                  {formatBRL(sellTarget.quantity * (sellTarget.current_price ?? sellTarget.avg_price))}
                </span>
              </div>
            </div>
            <p className="font-sans text-xs mb-6" style={{ color: "var(--text-muted)" }}>
              O valor da venda ficara disponivel para redistribuicao em novos ativos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSell}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-sans text-sm font-semibold transition-opacity disabled:opacity-40 cursor-pointer"
                style={{ background: "var(--danger)", color: "white" }}
              >
                <Minus size={14} />
                {isSubmitting ? "Vendendo..." : "Confirmar Venda"}
              </button>
              <button
                onClick={() => setSellTarget(null)}
                className="px-6 py-2.5 rounded-lg font-sans text-sm font-medium cursor-pointer"
                style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
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

function SortableHeader({
  label, field, current, direction, onSort, align = "left",
}: {
  label: string; field: SortField; current: SortField; direction: SortDirection;
  onSort: (field: SortField) => void; align?: "left" | "right" | "center";
}) {
  const isActive = current === field;
  const textAlign = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <th className={`px-4 pb-3 font-medium ${textAlign}`}>
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 cursor-pointer ${justify}`}
        style={{ color: isActive ? "var(--text-primary)" : undefined }}
      >
        {label}
        {isActive ? (
          direction === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ArrowUpDown size={10} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

function InputField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return (
    <div>
      <label htmlFor={id} className="font-sans text-xs uppercase tracking-wider font-medium block mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <input
        id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} step={type === "number" ? "any" : undefined}
        className="w-full px-4 py-2.5 rounded-lg font-sans text-sm outline-none"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
      />
    </div>
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return value >= 1
    ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(value);
}

function computeLockDays(lockedUntil: string | null): number {
  if (!lockedUntil) return 0;
  const lockDate = new Date(lockedUntil);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lockDate.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((lockDate.getTime() - today.getTime()) / 86400000));
}

export { AtivosPage as default };
