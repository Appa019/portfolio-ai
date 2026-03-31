import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "sentiment_analyst.j2"


class SentimentAnalystAgent(BaseAgent):
    name = "sentiment_analyst"
    order = 8
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        results = context.get("agent_results", {})

        # Extract tickers from deep research results
        b3_tickers = _extract_tickers(results.get("deep_research_b3", {}))
        crypto_tickers = _extract_tickers(results.get("deep_research_crypto", {}))

        template = Template(PROMPT_PATH.read_text())
        return template.render(
            b3_tickers_json=json.dumps(b3_tickers, indent=2, default=str),
            crypto_tickers_json=json.dumps(crypto_tickers, indent=2, default=str),
        )


def _extract_tickers(agent_output: dict[str, Any]) -> list[str]:
    """Extract ticker list from a deep research agent output."""
    tickers = []

    # Try standard format
    for analysis in agent_output.get("analises", []):
        ticker = analysis.get("ticker")
        if ticker:
            tickers.append(ticker)

    # Try round_outputs format (multi-turn)
    if not tickers:
        for round_data in agent_output.get("_round_outputs", []):
            output = round_data.get("output", {})
            for analysis in output.get("analises", []):
                ticker = analysis.get("ticker")
                if ticker and ticker not in tickers:
                    tickers.append(ticker)

    return tickers
