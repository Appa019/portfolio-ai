from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class AssetClass(StrEnum):
    FIXED_INCOME = "fixed_income"
    STOCKS = "stocks"
    CRYPTO = "crypto"


class AssetStatus(StrEnum):
    LOCKED = "locked"
    FREE = "free"
    UNDER_REVIEW = "under_review"


class AssetCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    name: str | None = None
    asset_class: AssetClass
    quantity: Decimal = Field(..., gt=0)
    avg_price: Decimal = Field(..., gt=0)
    entry_date: date | None = None


class AssetResponse(BaseModel):
    id: UUID
    ticker: str
    name: str | None
    asset_class: AssetClass
    quantity: Decimal
    avg_price: Decimal
    current_price: Decimal | None
    entry_date: date
    locked_until: date | None
    status: AssetStatus
    created_at: datetime
    updated_at: datetime

    @property
    def total_value(self) -> Decimal:
        price = self.current_price or self.avg_price
        return self.quantity * price

    @property
    def pnl_percent(self) -> float | None:
        if self.current_price and self.avg_price > 0:
            return float((self.current_price - self.avg_price) / self.avg_price * 100)
        return None

    @property
    def days_in_portfolio(self) -> int:
        return (date.today() - self.entry_date).days

    @property
    def lock_days_remaining(self) -> int:
        if self.locked_until is None:
            return 0
        remaining = (self.locked_until - date.today()).days
        return max(0, remaining)
