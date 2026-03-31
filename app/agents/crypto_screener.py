import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "crypto_screener.j2"


class CryptoScreenerAgent(BaseAgent):
    name = "crypto_screener"
    order = 4
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        distribution = context.get("agent_results", {}).get("portfolio_balancer", {})
        budget = distribution.get("distribuicao_aporte", {}).get("crypto", 0)
        sector_data = context.get("agent_results", {}).get("sector_analyst", {})

        current_crypto = [
            a
            for a in context.get("portfolio_summary", {}).get("assets", [])
            if a.get("asset_class") == "crypto"
        ]

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            budget_crypto=budget,
            current_crypto_json=json.dumps(current_crypto, indent=2, default=str),
            segment_focus_json=json.dumps(
                sector_data.get("foco_crypto", {}), indent=2, default=str
            ),
        )
