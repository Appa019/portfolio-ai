-- Enable RLS on all tables
alter table portfolio_assets enable row level security;
alter table contributions enable row level security;
alter table transactions enable row level security;
alter table price_snapshots enable row level security;
alter table weekly_reports enable row level security;
alter table asset_reviews enable row level security;
alter table agent_runs enable row level security;

-- Personal project: allow all via service role key
-- For multi-user, replace with proper user-scoped policies
create policy "allow_all_portfolio_assets" on portfolio_assets for all using (true) with check (true);
create policy "allow_all_contributions" on contributions for all using (true) with check (true);
create policy "allow_all_transactions" on transactions for all using (true) with check (true);
create policy "allow_all_price_snapshots" on price_snapshots for all using (true) with check (true);
create policy "allow_all_weekly_reports" on weekly_reports for all using (true) with check (true);
create policy "allow_all_asset_reviews" on asset_reviews for all using (true) with check (true);
create policy "allow_all_agent_runs" on agent_runs for all using (true) with check (true);
