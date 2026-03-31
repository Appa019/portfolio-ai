import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "risk_analyst.j2"


class RiskAnalystAgent(BaseAgent):
    name = "risk_analyst"
    order = 7
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        results = context.get("agent_results", {})
        portfolio = context.get("portfolio_summary", {})

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            macro_json=json.dumps(results.get("macro_analyst", {}), indent=2, default=str),
            sector_json=json.dumps(results.get("sector_analyst", {}), indent=2, default=str),
            deep_b3_json=json.dumps(results.get("deep_research_b3", {}), indent=2, default=str),
            deep_crypto_json=json.dumps(
                results.get("deep_research_crypto", {}), indent=2, default=str
            ),
            portfolio_json=json.dumps(portfolio, indent=2, default=str),
        )
