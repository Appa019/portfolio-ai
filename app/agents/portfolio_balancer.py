import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "portfolio_balancer.j2"


class PortfolioBalancerAgent(BaseAgent):
    name = "portfolio_balancer"
    order = 3
    use_research = False

    def build_prompt(self, context: dict[str, Any]) -> str:
        macro_result = context.get("agent_results", {}).get("macro_analyst", {})

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            amount_brl=context["amount_brl"],
            portfolio_json=json.dumps(context["portfolio_summary"], indent=2, default=str),
            macro_json=json.dumps(macro_result, indent=2, default=str),
        )
