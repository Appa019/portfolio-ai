export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// Portfolio
export function fetchPortfolio(signal?: AbortSignal) {
  return request<PortfolioSummary>("/api/portfolio", { signal });
}

export function fetchAllocation() {
  return request<AllocationBreakdown>("/api/portfolio/allocation");
}

export function fetchAssets() {
  return request<Asset[]>("/api/portfolio/assets");
}

export function addAsset(data: AssetCreate) {
  return request<Asset>("/api/portfolio/assets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function removeAsset(id: string) {
  return request<Asset>(`/api/portfolio/assets/${id}`, {
    method: "DELETE",
  });
}

export function sellAsset(id: string) {
  return request<SaleResult>(`/api/portfolio/assets/${id}/sell`, {
    method: "POST",
  });
}

export interface SaleResult {
  ticker: string;
  quantity: number;
  price: number;
  sale_value: number;
  asset_class: string;
  message: string;
}

// Prices
export function updatePrices() {
  return request<{ updated: number; results: Record<string, string> }>("/api/prices/update", {
    method: "POST",
  });
}

export function fetchPriceHistory(ticker: string, limit = 168) {
  return request<PriceSnapshot[]>(`/api/prices/history/${ticker}?limit=${limit}`);
}

// Contributions
export function createContribution(amountBrl: number) {
  return request<ContributionResponse>("/api/aporte", {
    method: "POST",
    body: JSON.stringify({ amount_brl: amountBrl }),
  });
}

export function fetchContribution(id: string) {
  return request<Contribution>(`/api/aporte/${id}`);
}

export function fetchContributionAgents(id: string) {
  return request<AgentRun[]>(`/api/aporte/${id}/agents`);
}

// Research
export function fetchResearchAnalyses(contributionId: string, assetClass?: string) {
  const params = assetClass ? `?asset_class=${assetClass}` : "";
  return request<{ analyses: ResearchAnalysis[] }>(
    `/api/research/${contributionId}/analyses${params}`
  );
}

export function fetchTickerAnalysis(contributionId: string, ticker: string) {
  return request<ResearchAnalysis>(`/api/research/${contributionId}/analyses/${ticker}`);
}

export function fetchRiskAssessment(contributionId: string) {
  return request<RiskAssessment>(`/api/research/${contributionId}/risk`);
}

export function fetchSentimentAssessment(contributionId: string) {
  return request<SentimentAssessment>(`/api/research/${contributionId}/sentiment`);
}

export function fetchMacroContext(contributionId: string) {
  return request<MacroSnapshot>(`/api/research/${contributionId}/macro`);
}

export function fetchResearchAgents(contributionId: string) {
  return request<{ agents: AgentRun[] }>(`/api/research/${contributionId}/agents`);
}

// Scheduler
export function fetchSchedulerJobs() {
  return request<SchedulerJob[]>("/api/scheduler/jobs");
}

export function triggerJob(jobId: string) {
  return request<{ status: string }>(`/api/scheduler/trigger/${jobId}`, {
    method: "POST",
  });
}

// Reports
export function fetchWeeklyReports() {
  return request<WeeklyReport[]>("/api/reports");
}

// Settings
export function fetchAllocationTargets() {
  return request<AllocationTargets>("/api/settings/allocation");
}

export function saveAllocationTargets(data: AllocationTargets) {
  return request<AllocationTargets>("/api/settings/allocation", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export interface AllocationTargets {
  fixed_income: number;
  stocks: number;
  crypto: number;
}

// Contributions list
export function fetchContributions() {
  return request<Contribution[]>("/api/aporte");
}

// WebSocket
export function createPipelineSocket(contributionId: string): WebSocket {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return new WebSocket(`${wsBase}/api/ws/pipeline/${contributionId}`);
}

// Types
export interface Asset {
  id: string;
  ticker: string;
  name: string | null;
  asset_class: "fixed_income" | "stocks" | "crypto";
  quantity: number;
  avg_price: number;
  current_price: number | null;
  entry_date: string;
  locked_until: string | null;
  status: "locked" | "free" | "under_review";
  created_at: string;
  updated_at: string;
}

export interface AssetCreate {
  ticker: string;
  name?: string;
  asset_class: "fixed_income" | "stocks" | "crypto";
  quantity: number;
  avg_price: number;
  entry_date?: string;
}

export interface AllocationBreakdown {
  total_value: number;
  fixed_income: number;
  stocks: number;
  crypto: number;
  fixed_income_pct: number;
  stocks_pct: number;
  crypto_pct: number;
}

export interface PortfolioSummary {
  total_value: number;
  allocation: AllocationBreakdown;
  target_allocation: Record<string, number>;
  deviation: Record<string, number>;
  assets: Asset[];
}

export interface Contribution {
  id: string;
  amount_brl: number;
  status: "pending" | "processing" | "completed" | "failed";
  distribution: Record<string, unknown> | null;
  final_recommendation: Record<string, unknown> | null;
  pipeline_log: Record<string, unknown>[];
  created_at: string;
  completed_at: string | null;
}

export interface ContributionResponse {
  id: string;
  status: string;
  message: string;
  ws_url: string;
}

export interface AgentRun {
  id: string;
  contribution_id: string;
  agent_name: string;
  agent_order: number;
  status: "pending" | "running" | "completed" | "failed" | "timeout" | "skipped";
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  round_number: number | null;
  round_outputs: RoundOutput[] | null;
}

export interface RoundOutput {
  round: number;
  output: Record<string, unknown>;
}

export interface RoundInfo {
  round_number: number;
  total_rounds: number;
}

export interface PipelineEvent {
  agent: string;
  status: string;
  data?: Record<string, unknown>;
  error?: string;
  type?: string;
  round_info?: RoundInfo;
}

export interface ResearchAnalysis {
  id: string;
  contribution_id: string;
  agent_name: string;
  ticker: string;
  asset_class: "fixed_income" | "stocks" | "crypto";
  analysis_data: Record<string, unknown>;
  risk_score: number | null;
  sentiment_score: number | null;
  confidence: string | null;
  created_at: string;
}

export interface RiskAssessment {
  riscos_acoes: RiskEntry[];
  riscos_crypto: RiskEntry[];
  riscos_portfolio: Record<string, unknown>;
  eliminados: string[];
  alertas_criticos: string[];
}

export interface RiskEntry {
  ticker: string;
  red_flags: string[];
  risk_score: number;
  veredito: string;
}

export interface SentimentAssessment {
  sentimento_acoes: SentimentEntry[];
  sentimento_crypto: SentimentEntry[];
  sentimento_macro: Record<string, unknown>;
}

export interface SentimentEntry {
  ticker: string;
  sentiment_score: number;
  classificacao: string;
  noticias_relevantes: NewsItem[];
}

export interface NewsItem {
  titulo: string;
  fonte: string;
  data: string;
  impacto: string;
}

export interface MacroSnapshot {
  id: string;
  contribution_id: string;
  selic: number | null;
  ipca_12m: number | null;
  cdi: number | null;
  usd_brl: number | null;
  ibovespa_level: number | null;
  ibovespa_30d_return: number | null;
  btc_dominance: number | null;
  fear_greed_index: number | null;
  raw_data: Record<string, unknown>;
  captured_at: string;
}

export interface PriceSnapshot {
  price_brl: number;
  captured_at: string;
  source: string;
}

export interface SchedulerJob {
  id: string;
  name: string;
  next_run: string | null;
  trigger: string;
}

export interface WeeklyReport {
  id: string;
  period_start: string;
  period_end: string;
  content: Record<string, unknown>;
  summary: string | null;
  generated_at: string;
}
