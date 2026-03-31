-- Ultra Research: new tables and columns for multi-turn deep research pipeline

-- Per-ticker analysis storage (denormalized for fast frontend queries)
CREATE TABLE IF NOT EXISTS research_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    agent_name text NOT NULL,
    ticker text NOT NULL,
    asset_class text NOT NULL CHECK (asset_class IN ('fixed_income', 'stocks', 'crypto')),
    analysis_data jsonb NOT NULL,
    risk_score numeric(3, 1),
    sentiment_score numeric(3, 1),
    confidence text CHECK (confidence IN ('alta', 'media', 'baixa')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Macro data snapshots (captured before pipeline runs)
CREATE TABLE IF NOT EXISTS macro_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_id uuid REFERENCES contributions(id) ON DELETE CASCADE,
    selic numeric(6, 2),
    ipca_12m numeric(6, 2),
    cdi numeric(6, 2),
    usd_brl numeric(8, 4),
    ibovespa_level numeric(12, 2),
    ibovespa_30d_return numeric(6, 2),
    btc_dominance numeric(5, 2),
    fear_greed_index int,
    raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    captured_at timestamptz NOT NULL DEFAULT now()
);

-- Enrich contributions with new pipeline outputs
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS macro_context jsonb;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS risk_assessment jsonb;
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS sentiment_assessment jsonb;

-- Multi-turn round tracking in agent_runs
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS round_number int DEFAULT 1;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS round_outputs jsonb DEFAULT '[]'::jsonb;

-- Update agent_runs status check to include 'skipped'
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_status_check;
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout', 'skipped'));

-- Indexes for research_analyses
CREATE INDEX IF NOT EXISTS idx_research_analyses_contribution
    ON research_analyses(contribution_id);
CREATE INDEX IF NOT EXISTS idx_research_analyses_ticker
    ON research_analyses(ticker);
CREATE INDEX IF NOT EXISTS idx_research_analyses_agent
    ON research_analyses(agent_name);

-- Indexes for macro_snapshots
CREATE INDEX IF NOT EXISTS idx_macro_snapshots_contribution
    ON macro_snapshots(contribution_id);

-- RLS policies (personal project - allow all)
ALTER TABLE research_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_research_analyses ON research_analyses
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_macro_snapshots ON macro_snapshots
    FOR ALL USING (true) WITH CHECK (true);
