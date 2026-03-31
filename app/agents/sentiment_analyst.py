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

    # Standard format (single-turn or final round output)
    for analysis in agent_output.get("analises", []):
        ticker = analysis.get("ticker")
        if ticker and ticker not in tickers:
            tickers.append(ticker)

    # Try deep_dive format (round 2)
    if not tickers:
        for item in agent_output.get("deep_dive", []):
            ticker = item.get("ticker")
            if ticker and ticker not in tickers:
                tickers.append(ticker)

    # Try devils_advocate format (round 3)
    if not tickers:
        for item in agent_output.get("devils_advocate", []):
            ticker = item.get("ticker")
            if ticker and ticker not in tickers:
                tickers.append(ticker)

    # Try candidatos format (screener output)
    if not tickers:
        for item in agent_output.get("candidatos", []):
            ticker = item.get("ticker")
            if ticker and ticker not in tickers:
                tickers.append(ticker)

    return tickers
