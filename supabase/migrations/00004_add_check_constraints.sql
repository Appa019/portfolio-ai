-- Enforce positive/non-negative values on numeric columns
alter table portfolio_assets add constraint chk_quantity_positive check (quantity >= 0);
alter table portfolio_assets add constraint chk_avg_price_positive check (avg_price >= 0);
alter table portfolio_assets add constraint chk_current_price_positive check (current_price is null or current_price >= 0);
alter table contributions add constraint chk_amount_positive check (amount_brl > 0);
alter table transactions add constraint chk_txn_quantity_positive check (quantity >= 0);
alter table transactions add constraint chk_txn_price_positive check (price_brl >= 0);
alter table price_snapshots add constraint chk_snapshot_price_positive check (price_brl >= 0);
