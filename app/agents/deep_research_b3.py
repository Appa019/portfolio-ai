import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "deep_research_b3.j2"
FOLLOWUP_2_PATH = Path(__file__).parent / "prompts" / "deep_research_b3_r2.j2"
FOLLOWUP_3_PATH = Path(__file__).parent / "prompts" / "deep_research_b3_r3.j2"


class DeepResearchB3Agent(BaseAgent):
    name = "deep_research_b3"
    order = 5
    use_research = True

    @property
    def max_rounds(self) -> int:
        return 3

    def get_session_key(self, context: dict[str, Any]) -> str:
        """Use a key based on the candidate tickers for persistent chat."""
        b3_result = context.get("agent_results", {}).get("b3_screener", {})
        tickers = [c.get("ticker", "") for c in b3_result.get("candidatos", [])]
        if tickers:
            key = "_".join(sorted(tickers[:5]))
            return f"deep_research_b3:{key}"
        return "deep_research_b3"

    def build_prompt(self, context: dict[str, Any]) -> str:
        b3_result = context.get("agent_results", {}).get("b3_screener", {})
        candidates = b3_result.get("candidatos", [])
        market_data = context.get("candidate_data", {}).get("stocks", [])

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
