import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "macro_analyst.j2"


class MacroAnalystAgent(BaseAgent):
    name = "macro_analyst"
    order = 1
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        market_data = context.get("market_data", {})
        portfolio = context.get("portfolio_summary", {})

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            macro=market_data.get("macro", {}),
            ibovespa=market_data.get("ibovespa", {}),
            crypto_global=market_data.get("crypto_global", {}),
            fear_greed_index=market_data.get("fear_greed_index"),
            captured_at=market_data.get("captured_at", ""),
            portfolio_json=json.dumps(portfolio, indent=2, default=str),
        )
