import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "deep_research_crypto.j2"
FOLLOWUP_2_PATH = Path(__file__).parent / "prompts" / "deep_research_crypto_r2.j2"
FOLLOWUP_3_PATH = Path(__file__).parent / "prompts" / "deep_research_crypto_r3.j2"


class DeepResearchCryptoAgent(BaseAgent):
    name = "deep_research_crypto"
    order = 6
    use_research = True

    @property
    def max_rounds(self) -> int:
        return 3

    def build_prompt(self, context: dict[str, Any]) -> str:
        crypto_result = context.get("agent_results", {}).get("crypto_screener", {})
        candidates = crypto_result.get("candidatos", [])
        market_data = context.get("candidate_data", {}).get("crypto", [])

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            candidates_json=json.dumps(candidates, indent=2, default=str),
            market_data_json=json.dumps(market_data, indent=2, default=str),
        )

    def build_followup_prompt(
        self,
        round_num: int,
        previous_response: str,
        context: dict[str, Any],
    ) -> str | None:
        if round_num == 2:
            template = Template(FOLLOWUP_2_PATH.read_text())
            return template.render()
        if round_num == 3:
            template = Template(FOLLOWUP_3_PATH.read_text())
            return template.render()
        return None
