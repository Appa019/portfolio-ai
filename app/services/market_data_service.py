import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
import structlog
import yfinance as yf

from app.config import settings
from app.core.database import get_supabase

logger = structlog.get_logger()

# BCB API series codes
BCB_SELIC_META = 432
BCB_IPCA_12M = 13522
BCB_CDI = 4391
BCB_USD_BRL = 1


async def _fetch_bcb_series(series_id: int) -> Decimal | None:
    """Fetch latest value from BCB time series API."""
    try:
        url = (
            f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}"
            "/dados/ultimos/1?formato=json"
        )
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            if data:
                value = data[-1].get("valor", "0").replace(",", ".")
                return Decimal(value)
    except Exception:
        logger.warning("bcb_fetch_failed", series=series_id)
    return None


async def get_macro_data() -> dict[str, Any]:
    """Fetch all macro indicators from BCB in parallel."""
    selic, ipca, cdi, usd_brl = await asyncio.gather(
        _fetch_bcb_series(BCB_SELIC_META),
        _fetch_bcb_series(BCB_IPCA_12M),
        _fetch_bcb_series(BCB_CDI),
        _fetch_bcb_series(BCB_USD_BRL),
        return_exceptions=True,
    )

    return {
        "selic": str(selic) if isinstance(selic, Decimal) else None,
        "ipca_12m": str(ipca) if isinstance(ipca, Decimal) else None,
        "cdi": str(cdi) if isinstance(cdi, Decimal) else None,
        "usd_brl": str(usd_brl) if isinstance(usd_brl, Decimal) else None,
        "captured_at": datetime.now(UTC).isoformat(),
    }


async def get_ibovespa_snapshot() -> dict[str, Any]:
    """Fetch Ibovespa index data via yfinance."""
    try:

        def _fetch() -> dict[str, Any]:
            ticker = yf.Ticker("^BVSP")
            info = ticker.info
            hist = ticker.history(period="1mo")

            current = info.get("regularMarketPrice", 0)
            prev_close = info.get("regularMarketPreviousClose", 0)
            day_change = ((current - prev_close) / prev_close * 100) if prev_close else 0

            month_return = 0.0
            if len(hist) >= 2:
                first = float(hist["Close"].iloc[0])
                last = float(hist["Close"].iloc[-1])
                month_return = ((last - first) / first * 100) if first else 0

            return {
                "level": current,
                "day_change_pct": round(day_change, 2),
                "month_return_pct": round(month_return, 2),
                "volume": info.get("regularMarketVolume", 0),
            }

        return await asyncio.to_thread(_fetch)
    except Exception:
        logger.warning("ibovespa_fetch_failed")
        return {}


async def get_stock_fundamentals(ticker: str) -> dict[str, Any]:
    """Fetch fundamental data for a B3 stock via yfinance."""
    try:

        def _fetch() -> dict[str, Any]:
            symbol = f"{ticker}.SA" if not ticker.endswith(".SA") else ticker
            stock = yf.Ticker(symbol)
            info = stock.info
            hist = stock.history(period="3mo")

            # Calculate RSI-14
            rsi = _calculate_rsi(hist["Close"]) if len(hist) > 14 else None

            # 30-day return
            return_30d = None
            if len(hist) >= 22:
                recent = float(hist["Close"].iloc[-1])
                past = float(hist["Close"].iloc[-22])
                return_30d = round(((recent - past) / past * 100), 2) if past else None

            return {
                "ticker": ticker,
                "price": info.get("currentPrice") or info.get("regularMarketPrice"),
                "pe_ratio": info.get("trailingPE"),
                "forward_pe": info.get("forwardPE"),
                "roe": _pct(info.get("returnOnEquity")),
                "ebitda_margin": _pct(info.get("ebitdaMargins")),
                "profit_margin": _pct(info.get("profitMargins")),
                "debt_to_equity": info.get("debtToEquity"),
                "dividend_yield": _pct(info.get("dividendYield")),
                "market_cap": info.get("marketCap"),
                "avg_volume_20d": info.get("averageVolume"),
                "52w_high": info.get("fiftyTwoWeekHigh"),
                "52w_low": info.get("fiftyTwoWeekLow"),
                "rsi_14": rsi,
                "return_30d": return_30d,
                "sector": info.get("sector"),
                "industry": info.get("industry"),
            }

        return await asyncio.to_thread(_fetch)
    except Exception:
        logger.warning("stock_fundamentals_failed", ticker=ticker)
        return {"ticker": ticker, "error": "fetch_failed"}


async def get_crypto_metrics(coin_id: str) -> dict[str, Any]:
    """Fetch comprehensive crypto data from CoinGecko."""
    try:
        url = (
            f"{settings.coingecko_api_url}/coins/{coin_id.lower()}"
            "?localization=false&tickers=false&community_data=false"
            "&developer_data=false&sparkline=false"
        )
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        market = data.get("market_data", {})
        return {
            "ticker": coin_id,
            "name": data.get("name"),
            "price_brl": market.get("current_price", {}).get("brl"),
            "price_usd": market.get("current_price", {}).get("usd"),
            "market_cap_usd": market.get("market_cap", {}).get("usd"),
            "market_cap_rank": data.get("market_cap_rank"),
            "total_volume_24h": market.get("total_volume", {}).get("usd"),
            "circulating_supply": market.get("circulating_supply"),
            "total_supply": market.get("total_supply"),
            "max_supply": market.get("max_supply"),
            "ath_usd": market.get("ath", {}).get("usd"),
            "ath_change_pct": market.get("ath_change_percentage", {}).get("usd"),
            "change_24h_pct": market.get("price_change_percentage_24h"),
            "change_7d_pct": market.get("price_change_percentage_7d"),
            "change_30d_pct": market.get("price_change_percentage_30d"),
            "categories": data.get("categories", []),
        }
    except Exception:
        logger.warning("crypto_metrics_failed", coin_id=coin_id)
        return {"ticker": coin_id, "error": "fetch_failed"}


async def get_btc_dominance() -> dict[str, Any]:
    """Fetch BTC dominance and global crypto data from CoinGecko."""
    try:
        url = f"{settings.coingecko_api_url}/global"
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json().get("data", {})

        return {
            "btc_dominance": round(data.get("market_cap_percentage", {}).get("btc", 0), 2),
            "eth_dominance": round(data.get("market_cap_percentage", {}).get("eth", 0), 2),
            "total_market_cap_usd": data.get("total_market_cap", {}).get("usd"),
            "total_volume_24h_usd": data.get("total_volume", {}).get("usd"),
            "market_cap_change_24h_pct": data.get("market_cap_change_percentage_24h_usd"),
        }
    except Exception:
        logger.warning("btc_dominance_fetch_failed")
        return {}


async def get_fear_greed_index() -> int | None:
    """Fetch crypto Fear & Greed Index."""
    try:
        url = "https://api.alternative.me/fng/?limit=1"
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            if data.get("data"):
                return int(data["data"][0]["value"])
    except Exception:
        logger.warning("fear_greed_fetch_failed")
    return None


async def enrich_stock_candidates(tickers: list[str]) -> list[dict[str, Any]]:
    """Batch-fetch fundamentals for a list of stock tickers."""
    results = []
    for ticker in tickers:
        data = await get_stock_fundamentals(ticker)
        results.append(data)
        await asyncio.sleep(0.5)
    return results


async def enrich_crypto_candidates(coin_ids: list[str]) -> list[dict[str, Any]]:
    """Batch-fetch metrics for a list of crypto coin IDs."""
    results = []
    for coin_id in coin_ids:
        data = await get_crypto_metrics(coin_id)
        results.append(data)
        await asyncio.sleep(1.0)
    return results


async def build_full_context() -> dict[str, Any]:
    """Aggregate all macro data into a single context dict for prompt injection."""
    macro, ibov, btc_dom, fear_greed = await asyncio.gather(
        get_macro_data(),
        get_ibovespa_snapshot(),
        get_btc_dominance(),
        get_fear_greed_index(),
        return_exceptions=True,
    )

    context = {
        "macro": macro if isinstance(macro, dict) else {},
        "ibovespa": ibov if isinstance(ibov, dict) else {},
        "crypto_global": btc_dom if isinstance(btc_dom, dict) else {},
        "fear_greed_index": fear_greed if isinstance(fear_greed, int) else None,
        "captured_at": datetime.now(UTC).isoformat(),
    }

    logger.info("market_data_context_built", keys=list(context.keys()))
    return context


async def save_macro_snapshot(contribution_id: str, context: dict[str, Any]) -> None:
    """Persist macro snapshot to database."""
    db = get_supabase()
    macro = context.get("macro", {})
    ibov = context.get("ibovespa", {})
    crypto = context.get("crypto_global", {})

    db.table("macro_snapshots").insert(
        {
            "contribution_id": contribution_id,
            "selic": macro.get("selic"),
            "ipca_12m": macro.get("ipca_12m"),
            "cdi": macro.get("cdi"),
            "usd_brl": macro.get("usd_brl"),
            "ibovespa_level": ibov.get("level"),
            "ibovespa_30d_return": ibov.get("month_return_pct"),
            "btc_dominance": crypto.get("btc_dominance"),
            "fear_greed_index": context.get("fear_greed_index"),
            "raw_data": context,
            "captured_at": context.get("captured_at", datetime.now(UTC).isoformat()),
        }
    ).execute()


def _calculate_rsi(prices: Any, period: int = 14) -> float | None:
    """Calculate RSI-14 from a pandas Series of closing prices."""
    try:
        delta = prices.diff()
        gain = delta.where(delta > 0, 0).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        value = float(rsi.iloc[-1])
        return round(value, 1) if value == value else None  # NaN check
    except Exception:
        return None


def _pct(value: float | None) -> float | None:
    """Convert decimal ratio to percentage."""
    if value is None:
        return None
    return round(value * 100, 2)
