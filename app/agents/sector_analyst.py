import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "sector_analyst.j2"


class SectorAnalystAgent(BaseAgent):
    name = "sector_analyst"
    order = 2
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        macro_result = context.get("agent_results", {}).get("macro_analyst", {})
        portfolio = context.get("portfolio_summary", {})

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            macro_json=json.dumps(macro_result, indent=2, default=str),
            portfolio_json=json.dumps(portfolio, indent=2, default=str),
            amount_brl=context.get("amount_brl", "0"),
        )
