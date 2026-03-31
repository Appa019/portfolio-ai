from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ContributionStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ContributionCreate(BaseModel):
    amount_brl: Decimal = Field(..., gt=0, description="Contribution amount in BRL")


class ContributionResponse(BaseModel):
    id: UUID
    amount_brl: Decimal
    status: ContributionStatus
    distribution: dict[str, Any] | None
    final_recommendation: dict[str, Any] | None
    pipeline_log: list[dict[str, Any]]
    created_at: datetime
    completed_at: datetime | None
