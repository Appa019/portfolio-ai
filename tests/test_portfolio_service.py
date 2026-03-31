from decimal import Decimal

from app.services.portfolio_service import _calculate_allocation


def test_calculate_allocation_empty():
    result = _calculate_allocation([])
    assert result.total_value == Decimal("0")
    assert result.fixed_income_pct == 0.0


def test_calculate_allocation_single_class():
    assets = [{"asset_class": "stocks", "quantity": "10", "avg_price": "50", "current_price": "55"}]
    result = _calculate_allocation(assets)
    assert result.total_value == Decimal("550")
    assert result.stocks == Decimal("550")
    assert result.stocks_pct == 100.0
    assert result.fixed_income_pct == 0.0
    assert result.crypto_pct == 0.0


def test_calculate_allocation_mixed():
    assets = [
        {
            "asset_class": "fixed_income",
            "quantity": "1",
            "avg_price": "3500",
            "current_price": "3500",
        },
        {"asset_class": "stocks", "quantity": "10", "avg_price": "400", "current_price": "400"},
        {
            "asset_class": "crypto",
            "quantity": "0.1",
            "avg_price": "25000",
            "current_price": "25000",
        },
    ]
    result = _calculate_allocation(assets)
    assert result.total_value == Decimal("10000")
    assert result.fixed_income == Decimal("3500")
    assert result.stocks == Decimal("4000")
    assert result.crypto == Decimal("2500")
    assert result.fixed_income_pct == 35.0
    assert result.stocks_pct == 40.0
    assert result.crypto_pct == 25.0


def test_calculate_allocation_uses_avg_price_when_no_current():
    assets = [{"asset_class": "stocks", "quantity": "10", "avg_price": "50", "current_price": None}]
    result = _calculate_allocation(assets)
    assert result.total_value == Decimal("500")
