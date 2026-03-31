from decimal import Decimal
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "reevaluation.j2"


class ReevaluationAgent(BaseAgent):
    name = "reevaluation"
    order = 0
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        asset = context["asset"]
        entry_price = Decimal(str(asset.get("avg_price", 0)))
        current_price = Decimal(str(asset.get("current_price") or entry_price))
        quantity = Decimal(str(asset.get("quantity", 0)))
        current_value = quantity * current_price

        return_pct = 0.0
        if entry_price > 0:
            return_pct = float((current_price - entry_price) / entry_price * 100)

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            asset_class=asset.get("asset_class", ""),
            ticker=asset.get("ticker", ""),
            entry_date=asset.get("entry_date", ""),
            entry_price=str(entry_price),
            current_price=str(current_price),
            return_pct=f"{return_pct:.2f}",
            quantity=str(quantity),
            current_value=f"{current_value:.2f}",
        )
