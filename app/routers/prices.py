from fastapi import APIRouter, HTTPException

from app.core.database import get_supabase
from app.services import price_service

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/{ticker}")
async def get_price(ticker: str):
    """Get the latest price for a ticker."""
    db = get_supabase()
    result = (
        db.table("price_snapshots")
        .select("*")
        .eq("ticker", ticker.upper())
        .order("captured_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"No price data for {ticker}")
    return result.data[0]


@router.post("/update")
async def trigger_price_update():
    """Manually trigger price update for all assets."""
    results = await price_service.update_all_prices()
    return {"updated": len(results), "results": results}


@router.get("/history/{ticker}")
async def get_price_history(ticker: str, limit: int = 168):
    """Get price history for a ticker (default: 1 week at hourly granularity)."""
    db = get_supabase()
    result = (
        db.table("price_snapshots")
        .select("price_brl, captured_at, source")
        .eq("ticker", ticker.upper())
        .order("captured_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
