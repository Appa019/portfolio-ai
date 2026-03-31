from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import structlog

from app.config import settings
from app.core.database import get_supabase
from app.schemas.pipeline import AllocationBreakdown, PortfolioSummary

logger = structlog.get_logger()


async def get_all_assets() -> list[dict[str, Any]]:
    """Fetch all portfolio assets from the database."""
    db = get_supabase()
    result = db.table("portfolio_assets").select("*").order("asset_class").execute()
    return result.data or []


async def get_portfolio_summary() -> PortfolioSummary:
    """Calculate complete portfolio summary with allocation breakdown."""
    assets = await get_all_assets()
    allocation = _calculate_allocation(assets)

    target = {
        "fixed_income": settings.target_fixed_income * 100,
        "stocks": settings.target_stocks * 100,
        "crypto": settings.target_crypto * 100,
    }

    deviation = {
        "fixed_income": allocation.fixed_income_pct - target["fixed_income"],
        "stocks": allocation.stocks_pct - target["stocks"],
        "crypto": allocation.crypto_pct - target["crypto"],
    }

    return PortfolioSummary(
        total_value=allocation.total_value,
        allocation=allocation,
        target_allocation=target,
        deviation=deviation,
        assets=assets,
    )


async def calculate_allocation() -> AllocationBreakdown:
    """Calculate current allocation breakdown."""
    assets = await get_all_assets()
    return _calculate_allocation(assets)


async def add_asset(data: dict[str, Any]) -> dict[str, Any]:
    """Add a new asset to the portfolio."""
    db = get_supabase()
    entry_date = data.get("entry_date") or date.today().isoformat()

    insert_data = {
        "ticker": data["ticker"].upper(),
        "name": data.get("name"),
        "asset_class": data["asset_class"],
        "quantity": str(data["quantity"]),
        "avg_price": str(data["avg_price"]),
        "current_price": str(data.get("current_price", data["avg_price"])),
        "entry_date": str(entry_date),
        "status": "locked",
    }

    result = db.table("portfolio_assets").insert(insert_data).execute()
    asset = result.data[0]

    # Record transaction
    db.table("transactions").insert(
        {
            "asset_id": asset["id"],
            "ticker": asset["ticker"],
            "type": "buy",
            "quantity": str(data["quantity"]),
            "price_brl": str(data["avg_price"]),
        }
    ).execute()

    logger.info("asset_added", ticker=asset["ticker"], asset_class=data["asset_class"])
    return asset


async def remove_asset(asset_id: str) -> dict[str, Any]:
    """Remove an asset from the portfolio. Fails if still locked."""
    db = get_supabase()
    result = db.table("portfolio_assets").select("*").eq("id", asset_id).execute()

    if not result.data:
        raise ValueError(f"Asset {asset_id} not found")

    asset = result.data[0]
    if asset.get("locked_until"):
        lock_date = date.fromisoformat(asset["locked_until"])
        if lock_date > date.today():
            days_left = (lock_date - date.today()).days
            raise ValueError(f"Asset {asset['ticker']} is locked for {days_left} more days")

    # Record sell transaction
    db.table("transactions").insert(
        {
            "asset_id": asset_id,
            "ticker": asset["ticker"],
            "type": "sell",
            "quantity": asset["quantity"],
            "price_brl": asset.get("current_price") or asset["avg_price"],
        }
    ).execute()

    db.table("portfolio_assets").delete().eq("id", asset_id).execute()
    logger.info("asset_removed", ticker=asset["ticker"])
    return asset


async def sell_asset(asset_id: str) -> dict[str, Any]:
    """Sell an asset: record transaction, remove from portfolio, return sale details."""
    db = get_supabase()
    result = db.table("portfolio_assets").select("*").eq("id", asset_id).execute()

    if not result.data:
        raise ValueError(f"Asset {asset_id} not found")

    asset = result.data[0]
    if asset.get("locked_until"):
        lock_date = date.fromisoformat(asset["locked_until"])
        if lock_date > date.today():
            days_left = (lock_date - date.today()).days
            raise ValueError(f"Asset {asset['ticker']} is locked for {days_left} more days")

    qty = Decimal(str(asset.get("quantity", 0)))
    price = Decimal(str(asset.get("current_price") or asset.get("avg_price", 0)))
    sale_value = qty * price

    # Record sell transaction
    db.table("transactions").insert(
        {
            "asset_id": asset_id,
            "ticker": asset["ticker"],
            "type": "sell",
            "quantity": str(qty),
            "price_brl": str(price),
        }
    ).execute()

    # Remove asset
    db.table("portfolio_assets").delete().eq("id", asset_id).execute()
    logger.info("asset_sold", ticker=asset["ticker"], value=str(sale_value))

    return {
        "ticker": asset["ticker"],
        "quantity": float(qty),
        "price": float(price),
        "sale_value": float(sale_value),
        "asset_class": asset["asset_class"],
        "message": f"{asset['ticker']} vendido por R$ {sale_value:,.2f}",
    }


async def check_lockup_expiry() -> list[dict[str, Any]]:
    """Find assets completing 30 days (D+30) for reevaluation."""
    db = get_supabase()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    result = (
        db.table("portfolio_assets")
        .select("*")
        .eq("status", "locked")
        .lte("locked_until", tomorrow)
        .execute()
    )

    expiring = result.data or []

    for asset in expiring:
        db.table("portfolio_assets").update({"status": "under_review"}).eq(
            "id", asset["id"]
        ).execute()
        logger.info("lockup_expiring", ticker=asset["ticker"])

    return expiring


async def update_lockup_statuses() -> int:
    """Update status of assets whose lock has expired."""
    db = get_supabase()
    today = date.today().isoformat()

    result = (
        db.table("portfolio_assets")
        .select("id, ticker")
        .eq("status", "locked")
        .lte("locked_until", today)
        .execute()
    )

    freed = result.data or []
    for asset in freed:
        db.table("portfolio_assets").update({"status": "free"}).eq("id", asset["id"]).execute()

    if freed:
        logger.info("lockup_statuses_updated", count=len(freed))
    return len(freed)


def _calculate_allocation(assets: list[dict[str, Any]]) -> AllocationBreakdown:
    """Calculate allocation breakdown from asset list."""
    fixed_income = Decimal("0")
    stocks = Decimal("0")
    crypto = Decimal("0")

    for asset in assets:
        qty = Decimal(str(asset.get("quantity", 0)))
        price = Decimal(str(asset.get("current_price") or asset.get("avg_price", 0)))
        value = qty * price

        match asset.get("asset_class"):
            case "fixed_income":
                fixed_income += value
            case "stocks":
                stocks += value
            case "crypto":
                crypto += value

    total = fixed_income + stocks + crypto

    return AllocationBreakdown(
        total_value=total,
        fixed_income=fixed_income,
        stocks=stocks,
        crypto=crypto,
    )
