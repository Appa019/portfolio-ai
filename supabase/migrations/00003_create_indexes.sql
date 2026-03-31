-- Portfolio assets
create index if not exists idx_portfolio_assets_class on portfolio_assets(asset_class);
create index if not exists idx_portfolio_assets_status on portfolio_assets(status);

-- Price snapshots: query by ticker + time range
create index if not exists idx_price_snapshots_ticker_time on price_snapshots(ticker, captured_at desc);

-- Contributions: filter by status
create index if not exists idx_contributions_status on contributions(status, created_at desc);

-- Agent runs: lookup by contribution + order
create index if not exists idx_agent_runs_contribution on agent_runs(contribution_id, agent_order);

-- Transactions: lookup by asset
create index if not exists idx_transactions_asset on transactions(asset_id, executed_at desc);

-- Asset reviews: lookup by asset
create index if not exists idx_asset_reviews_asset on asset_reviews(asset_id, created_at desc);
