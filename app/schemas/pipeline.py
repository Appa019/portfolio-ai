from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class AgentStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class AgentRunResponse(BaseModel):
    id: UUID
    contribution_id: UUID
    agent_name: str
    agent_order: int
    status: AgentStatus
    output_data: dict[str, Any] | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None


class AllocationBreakdown(BaseModel):
    total_value: Decimal = Decimal("0")
    fixed_income: Decimal = Decimal("0")
    stocks: Decimal = Decimal("0")
    crypto: Decimal = Decimal("0")

    @property
    def fixed_income_pct(self) -> float:
        if self.total_value == 0:
            return 0.0
        return float(self.fixed_income / self.total_value * 100)

    @property
    def stocks_pct(self) -> float:
        if self.total_value == 0:
            return 0.0
        return float(self.stocks / self.total_value * 100)

    @property
    def crypto_pct(self) -> float:
        if self.total_value == 0:
            return 0.0
        return float(self.crypto / self.total_value * 100)


class PortfolioSummary(BaseModel):
    total_value: Decimal
    allocation: AllocationBreakdown
    target_allocation: dict[str, float]
    deviation: dict[str, float]
    assets: list[dict[str, Any]]


class PipelineEvent(BaseModel):
    contribution_id: UUID
    agent_name: str
    status: AgentStatus
    message: str | None = None
    data: dict[str, Any] | None = None
