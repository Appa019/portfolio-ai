import pytest

from app.services.price_service import (
    fetch_b3_price,
    fetch_cdi_rate,
    fetch_crypto_price,
    fetch_usd_brl,
)


@pytest.mark.slow
@pytest.mark.asyncio
async def test_fetch_b3_price():
    price = await fetch_b3_price("PETR4")
    assert price is not None
    assert price > 0


@pytest.mark.slow
@pytest.mark.asyncio
async def test_fetch_crypto_price():
    price = await fetch_crypto_price("bitcoin")
    assert price is not None
    assert price > 0


@pytest.mark.slow
@pytest.mark.asyncio
async def test_fetch_cdi_rate():
    rate = await fetch_cdi_rate()
    assert rate is not None
    assert rate > 0


@pytest.mark.slow
@pytest.mark.asyncio
async def test_fetch_usd_brl():
    rate = await fetch_usd_brl()
    assert rate is not None
    assert rate > 0
