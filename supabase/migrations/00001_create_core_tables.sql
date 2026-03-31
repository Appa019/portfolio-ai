-- Portfolio assets: current positions
create table if not exists portfolio_assets (
    id uuid primary key default gen_random_uuid(),
    ticker text not null unique,
    name text,
    asset_class text not null check (asset_class in ('fixed_income', 'stocks', 'crypto')),
    quantity numeric(18, 8) not null default 0,
    avg_price numeric(18, 8) not null default 0,
    current_price numeric(18, 8),
    entry_date date not null default current_date,
    locked_until date generated always as (entry_date + interval '31 days') stored,
    status text not null default 'locked' check (status in ('locked', 'free', 'under_review')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Contributions (aportes)
create table if not exists contributions (
    id uuid primary key default gen_random_uuid(),
    amount_brl numeric(12, 2) not null,
    status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    distribution jsonb,
    final_recommendation jsonb,
    pipeline_log jsonb default '[]'::jsonb,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

-- Transactions (buy/sell)
create table if not exists transactions (
    id uuid primary key default gen_random_uuid(),
    contribution_id uuid references contributions(id) on delete set null,
    asset_id uuid references portfolio_assets(id) on delete cascade,
    ticker text not null,
    type text not null check (type in ('buy', 'sell')),
    quantity numeric(18, 8) not null,
    price_brl numeric(18, 8) not null,
    total_value numeric(18, 2) generated always as (quantity * price_brl) stored,
    executed_at timestamptz not null default now()
);

-- Price snapshots (hourly granularity)
create table if not exists price_snapshots (
    id uuid primary key default gen_random_uuid(),
    ticker text not null,
    price_brl numeric(18, 8) not null,
    source text not null check (source in ('yfinance', 'coingecko', 'bcb', 'manual')),
    captured_at timestamptz not null default now()
);

-- Weekly reports
create table if not exists weekly_reports (
    id uuid primary key default gen_random_uuid(),
    period_start date not null,
    period_end date not null,
    content jsonb not null,
    summary text,
    generated_at timestamptz not null default now(),
    unique (period_start, period_end)
);

-- Asset reviews (D+30 reevaluations)
create table if not exists asset_reviews (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references portfolio_assets(id) on delete cascade,
    review_type text not null check (review_type in ('d30_reevaluation', 'manual', 'rebalance')),
    recommendation text check (recommendation in ('hold', 'sell', 'increase')),
    reasoning jsonb,
    created_at timestamptz not null default now()
);

-- Agent execution logs (observability)
create table if not exists agent_runs (
    id uuid primary key default gen_random_uuid(),
    contribution_id uuid references contributions(id) on delete cascade,
    agent_name text not null,
    agent_order int not null,
    status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'timeout')),
    input_data jsonb,
    output_data jsonb,
    error_message text,
    started_at timestamptz,
    completed_at timestamptz,
    duration_ms int
);

-- Updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Apply trigger to portfolio_assets
create trigger set_updated_at
    before update on portfolio_assets
    for each row
    execute function update_updated_at();
