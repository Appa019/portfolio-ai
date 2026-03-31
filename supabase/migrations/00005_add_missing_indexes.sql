-- Index for querying transactions by contribution
create index if not exists idx_transactions_contribution on transactions(contribution_id);
