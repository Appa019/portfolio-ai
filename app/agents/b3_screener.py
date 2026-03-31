import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "b3_screener.j2"


class B3ScreenerAgent(BaseAgent):
    name = "b3_screener"
    order = 4
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        distribution = context.get("agent_results", {}).get("portfolio_balancer", {})
        budget = distribution.get("distribuicao_aporte", {}).get("acoes", 0)
        sector_data = context.get("agent_results", {}).get("sector_analyst", {})

        current_stocks = [
            a
            for a in context.get("portfolio_summary", {}).get("assets", [])
            if a.get("asset_class") == "stocks"
        ]

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            budget_stocks=budget,
            current_stocks_json=json.dumps(current_stocks, indent=2, default=str),
            sector_focus_json=json.dumps(sector_data.get("foco_b3", {}), indent=2, default=str),
        )
