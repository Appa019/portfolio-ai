import asyncio
from datetime import UTC, datetime
from decimal import Decimal

import httpx
import structlog
import yfinance as yf

from app.core.database import get_supabase

logger = structlog.get_logger()

# BCB API series
BCB_CDI_SERIES = 4391
BCB_USD_BRL_SERIES = 1


async def fetch_b3_price(ticker: str) -> Decimal | None:
    """Fetch current price for a B3 stock via yfinance."""
    try:
        symbol = f"{ticker}.SA" if not ticker.endswith(".SA") else ticker
        data = await asyncio.to_thread(lambda: yf.Ticker(symbol).info)
        price = data.get("currentPrice") or data.get("regularMarketPrice")
        if price is not None:
            return Decimal(str(price))
        return None
    except Exception:
        logger.warning("failed_to_fetch_b3_price", ticker=ticker)
        return None


async def fetch_crypto_price(ticker: str) -> Decimal | None:
    """Fetch current price in BRL for a crypto asset via CoinGecko."""
    try:
        coin_id = ticker.lower()
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=brl"
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            if coin_id in data and "brl" in data[coin_id]:
                return Decimal(str(data[coin_id]["brl"]))
        return None
    except Exception:
        logger.warning("failed_to_fetch_crypto_price", ticker=ticker)
        return None


async def fetch_cdi_rate() -> Decimal | None:
    """Fetch current CDI rate from BCB API."""
    try:
        url = (
            f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{BCB_CDI_SERIES}"
            "/dados/ultimos/1?formato=json"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            if data:
                value = data[-1].get("valor", "0").replace(",", ".")
                return Decimal(value)
        return None
    except Exception:
        logger.warning("failed_to_fetch_cdi_rate")
        return None


async def fetch_usd_brl() -> Decimal | None:
    """Fetch current USD/BRL exchange rate from BCB API."""
    try:
        url = (
            f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{BCB_USD_BRL_SERIES}"
            "/dados/ultimos/1?formato=json"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            if data:
                value = data[-1].get("valor", "0").replace(",", ".")
                return Decimal(value)
        return None
    except Exception:
        logger.warning("failed_to_fetch_usd_brl")
        return None


async def update_asset_price(ticker: str, asset_class: str) -> Decimal | None:
    """Update price for a single asset based on its class."""
    price: Decimal | None = None

    if asset_class == "stocks":
        price = await fetch_b3_price(ticker)
    elif asset_class == "crypto":
        price = await fetch_crypto_price(ticker)
    elif asset_class == "fixed_income":
        cdi = await fetch_cdi_rate()
        if cdi is not None:
            price = cdi

    if price is not None:
        db = get_supabase()
        # Update current price on asset
        db.table("portfolio_assets").update({"current_price": str(price)}).eq(
            "ticker", ticker
        ).execute()
        # Save snapshot
        db.table("price_snapshots").insert(
            {
                "ticker": ticker,
                "price_brl": str(price),
                "source": _source_for_class(asset_class),
                "captured_at": datetime.now(UTC).isoformat(),
            }
        ).execute()
        logger.info("price_updated", ticker=ticker, price=str(price))

    return price


async def update_all_prices() -> dict[str, str]:
    """Update prices for all portfolio assets."""
    db = get_supabase()
    result = db.table("portfolio_assets").select("ticker, asset_class").execute()
    assets = result.data or []

    results: dict[str, str] = {}
    for i, asset in enumerate(assets):
        if i > 0:
            await asyncio.sleep(1.2)
        ticker = asset["ticker"]
        price = await update_asset_price(ticker, asset["asset_class"])
        results[ticker] = str(price) if price else "failed"

    logger.info("all_prices_updated", count=len(results))
    return results


def _source_for_class(asset_class: str) -> str:
    return {
        "stocks": "yfinance",
        "crypto": "coingecko",
        "fixed_income": "bcb",
    }.get(asset_class, "manual")
