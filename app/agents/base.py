import json
import re
import time
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog

from app.core.browser import ClaudeSession
from app.core.database import get_supabase

logger = structlog.get_logger()


class AgentResult:
    def __init__(
        self,
        agent_name: str,
        status: str,
        output: dict[str, Any] | None = None,
        error: str | None = None,
        duration_ms: int = 0,
        round_outputs: list[dict[str, Any]] | None = None,
    ) -> None:
        self.agent_name = agent_name
        self.status = status
        self.output = output or {}
        self.error = error
        self.duration_ms = duration_ms
        self.round_outputs = round_outputs or []


class BaseAgent(ABC):
    name: str = ""
    order: int = 0
    use_research: bool = False
    timeout_seconds: int = 300

    @property
    def max_rounds(self) -> int:
        """Maximum conversation rounds. Override for multi-turn agents."""
        return 1

    def get_session_key(self, context: dict[str, Any]) -> str:
        """Return the persistent conversation key for this agent.

        Override to create topic-specific conversations.
        Default: one conversation per agent name.
        """
        return self.name

    @abstractmethod
    def build_prompt(self, context: dict[str, Any]) -> str:
        """Build the initial prompt for a NEW conversation."""
        ...

    def build_resume_prompt(self, context: dict[str, Any]) -> str:
        """Build prompt for RESUMING an existing conversation.

        When the agent resumes a persistent conversation, this prompt
        is sent instead of the initial one. Override for custom behavior.
        Default: adds a context update prefix to the regular prompt.
        """
        base = self.build_prompt(context)
        return (
            "[ATUALIZAÇÃO DE CONTEXTO — Esta é uma continuação da nossa conversa anterior. "
            "Use todo o histórico desta conversa como referência. "
            "Aqui estão os dados atualizados:]\n\n"
            f"{base}"
        )

    def build_followup_prompt(
        self,
        round_num: int,
        previous_response: str,
        context: dict[str, Any],
    ) -> str | None:
        """Build follow-up prompt for multi-turn. Return None to stop."""
        return None

    def parse_response(self, raw_text: str) -> dict[str, Any]:
        """Parse the raw Claude response into structured data."""
        return _extract_json(raw_text)

    async def run(
        self,
        session: ClaudeSession,
        context: dict[str, Any],
        contribution_id: UUID | None = None,
        on_round_complete: Any = None,
    ) -> AgentResult:
        """Execute this agent with optional multi-turn support."""
        if self.max_rounds > 1:
            return await self._run_multi_turn(session, context, contribution_id, on_round_complete)
        return await self._run_single(session, context, contribution_id)

    def _resolve_session_key(self, context: dict[str, Any]) -> str:
        """Get the session key for persistent conversation lookup."""
        return self.get_session_key(context)

    async def _check_session_exists(self, session_key: str) -> bool:
        """Check if a persistent conversation exists for this session key."""
        try:
            db = get_supabase()
            result = (
                db.table("conversation_sessions")
                .select("id")
                .eq("session_key", session_key)
                .execute()
            )
            return bool(result.data)
        except Exception:
            return False

    async def _run_single(
        self,
        session: ClaudeSession,
        context: dict[str, Any],
        contribution_id: UUID | None = None,
    ) -> AgentResult:
        """Execute single-turn agent: build prompt, send to Claude, parse response."""
        start = time.monotonic()
        run_id = None

        if contribution_id:
            run_id = await self._log_start(contribution_id)

        try:
            sk = self._resolve_session_key(context)
            logger.info("agent_running", agent=self.name, order=self.order, session_key=sk)

            # Check if conversation will be resumed (peek at Supabase)
            will_resume = await self._check_session_exists(sk)

            # Choose the right prompt
            if will_resume:
                prompt = self.build_resume_prompt(context)
                logger.info("using_resume_prompt", agent=self.name)
            else:
                prompt = self.build_prompt(context)

            raw_response = await session.send_prompt(
                prompt,
                research_mode=self.use_research,
                session_key=sk,
            )
            session.end_conversation()

            if not raw_response:
                raise RuntimeError("Empty response from Claude")

            output = self.parse_response(raw_response)
            duration = int((time.monotonic() - start) * 1000)

            result = AgentResult(
                agent_name=self.name,
                status="completed",
                output=output,
                duration_ms=duration,
            )

            if run_id:
                await self._log_complete(run_id, result)

            logger.info(
                "agent_completed",
                agent=self.name,
                duration_ms=duration,
            )
            return result

        except Exception as e:
            duration = int((time.monotonic() - start) * 1000)
            error_msg = str(e)
            session.end_conversation()

            result = AgentResult(
                agent_name=self.name,
                status="failed",
                error=error_msg,
                duration_ms=duration,
            )

            if run_id:
                await self._log_complete(run_id, result)

            logger.error(
                "agent_failed",
                agent=self.name,
                error=error_msg,
                duration_ms=duration,
            )
            return result

    async def _run_multi_turn(
        self,
        session: ClaudeSession,
        context: dict[str, Any],
        contribution_id: UUID | None = None,
        on_round_complete: Any = None,
    ) -> AgentResult:
        """Execute multi-turn agent across multiple conversation rounds."""
        start = time.monotonic()
        run_id = None
        round_outputs: list[dict[str, Any]] = []

        if contribution_id:
            run_id = await self._log_start(contribution_id)

        try:
            # Round 1: initial prompt (opens or resumes conversation)
            sk = self._resolve_session_key(context)
            will_resume = await self._check_session_exists(sk)

            if will_resume:
                prompt = self.build_resume_prompt(context)
                logger.info("multi_turn_using_resume_prompt", agent=self.name)
            else:
                prompt = self.build_prompt(context)

            logger.info(
                "agent_multi_turn_start",
                agent=self.name,
                total_rounds=self.max_rounds,
                session_key=sk,
                resumed=will_resume,
            )

            raw_response = await session.send_prompt(
                prompt,
                research_mode=self.use_research,
                session_key=sk,
            )

            if not raw_response:
                raise RuntimeError("Empty response from Claude (round 1)")

            parsed = self.parse_response(raw_response)
            round_outputs.append({"round": 1, "output": parsed})

            if on_round_complete:
                await on_round_complete(1, self.max_rounds)

            logger.info("agent_round_completed", agent=self.name, round=1)

            # Rounds 2..N: follow-up prompts in the same conversation
            for round_num in range(2, self.max_rounds + 1):
                followup = self.build_followup_prompt(round_num, raw_response, context)
                if followup is None:
                    logger.info(
                        "agent_multi_turn_stopped_early",
                        agent=self.name,
                        stopped_at=round_num,
                    )
                    break

                raw_response = await session.send_followup(followup)

                if not raw_response:
                    logger.warning(
                        "agent_empty_followup",
                        agent=self.name,
                        round=round_num,
                    )
                    break

                parsed = self.parse_response(raw_response)
                round_outputs.append({"round": round_num, "output": parsed})

                if on_round_complete:
                    await on_round_complete(round_num, self.max_rounds)

                logger.info(
                    "agent_round_completed",
                    agent=self.name,
                    round=round_num,
                )

            session.end_conversation()

            # Final round output is the primary result
            final_output = round_outputs[-1]["output"] if round_outputs else {}
            duration = int((time.monotonic() - start) * 1000)

            result = AgentResult(
                agent_name=self.name,
                status="completed",
                output=final_output,
                duration_ms=duration,
                round_outputs=round_outputs,
            )

            if run_id:
                await self._log_complete(run_id, result)

            logger.info(
                "agent_multi_turn_completed",
                agent=self.name,
                rounds=len(round_outputs),
                duration_ms=duration,
            )
            return result

        except Exception as e:
            duration = int((time.monotonic() - start) * 1000)
            error_msg = str(e)
            session.end_conversation()

            result = AgentResult(
                agent_name=self.name,
                status="failed",
                error=error_msg,
                duration_ms=duration,
                round_outputs=round_outputs,
            )

            if run_id:
                await self._log_complete(run_id, result)

            logger.error(
                "agent_multi_turn_failed",
                agent=self.name,
                error=error_msg,
                completed_rounds=len(round_outputs),
            )
            return result

    async def _log_start(self, contribution_id: UUID) -> str:
        """Record agent run start in database."""
        db = get_supabase()
        result = (
            db.table("agent_runs")
            .insert(
                {
                    "contribution_id": str(contribution_id),
                    "agent_name": self.name,
                    "agent_order": self.order,
                    "status": "running",
                    "started_at": datetime.now(UTC).isoformat(),
                }
            )
            .execute()
        )
        return result.data[0]["id"]

    async def _log_complete(self, run_id: str, result: AgentResult) -> None:
        """Record agent run completion in database."""
        db = get_supabase()
        update_data: dict[str, Any] = {
            "status": result.status,
            "output_data": result.output,
            "error_message": result.error,
            "completed_at": datetime.now(UTC).isoformat(),
            "duration_ms": result.duration_ms,
        }
        if result.round_outputs:
            update_data["round_outputs"] = result.round_outputs
            update_data["round_number"] = len(result.round_outputs)

        db.table("agent_runs").update(update_data).eq("id", run_id).execute()


def _extract_json(text: str) -> dict[str, Any]:
    """Extract JSON from a text response that may contain markdown or other text."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    patterns = [
        r"```json\s*\n?(.*?)\n?\s*```",
        r"```\s*\n?(.*?)\n?\s*```",
        r"\{[\s\S]*\}",
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        for match in matches:
            try:
                return json.loads(match.strip())
            except json.JSONDecodeError:
                continue

    logger.warning("json_extraction_failed", text_preview=text[:200])
    return {"raw_response": text}
