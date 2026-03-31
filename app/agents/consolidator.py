import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "consolidator.j2"


class ConsolidatorAgent(BaseAgent):
    name = "consolidator"
    order = 9
    use_research = False

    def build_prompt(self, context: dict[str, Any]) -> str:
        results = context.get("agent_results", {})

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            distribution_json=json.dumps(
                results.get("portfolio_balancer", {}).get("distribuicao_aporte", {}),
                indent=2,
                default=str,
            ),
            macro_json=json.dumps(results.get("macro_analyst", {}), indent=2, default=str),
            deep_b3_json=json.dumps(results.get("deep_research_b3", {}), indent=2, default=str),
            deep_crypto_json=json.dumps(
                results.get("deep_research_crypto", {}), indent=2, default=str
            ),
            risk_json=json.dumps(results.get("risk_analyst", {}), indent=2, default=str),
            sentiment_json=json.dumps(results.get("sentiment_analyst", {}), indent=2, default=str),
            portfolio_json=json.dumps(context.get("portfolio_summary", {}), indent=2, default=str),
        )
