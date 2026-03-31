import json
from pathlib import Path
from typing import Any

from jinja2 import Template

from app.agents.base import BaseAgent

PROMPT_PATH = Path(__file__).parent / "prompts" / "weekly_report.j2"


class WeeklyReportAgent(BaseAgent):
    name = "weekly_report"
    order = 0
    use_research = True

    def build_prompt(self, context: dict[str, Any]) -> str:
        template = Template(PROMPT_PATH.read_text())
        return template.render(
            period_start=context["period_start"],
            period_end=context["period_end"],
            portfolio_json=json.dumps(context.get("portfolio_summary", {}), indent=2, default=str),
        )
