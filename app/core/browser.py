import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import structlog
from playwright.async_api import ElementHandle, Page, async_playwright

from app.config import settings
from app.core import selectors
from app.core.database import get_supabase

logger = structlog.get_logger()

# Max messages before starting a fresh conversation
MAX_MESSAGES_PER_CONVERSATION = 20


class ClaudeSession:
    """Manages a Playwright Chromium session against claude.ai.

    Supports persistent conversations: each agent/topic reuses the same
    conversation thread, stored in Supabase. When a conversation gets too
    long (>MAX_MESSAGES), a fresh one is created.
    """

    CLAUDE_URL = "https://claude.ai/new"
    RATE_LIMIT_SECONDS = 30
    RESPONSE_TIMEOUT_MS = 300_000  # 5 minutes
    NAV_TIMEOUT_MS = 60_000  # 60s for navigation (Turnstile can be slow)

    def __init__(self) -> None:
        self._playwright = None
        self._browser = None
        self._context = None
        self._page: Page | None = None
        self._last_request_time: float = 0
        self._semaphore = asyncio.Semaphore(1)
        self._conversation_active: bool = False
        self._current_session_key: str | None = None

    async def initialize(self) -> None:
        """Launch browser and load storage state if available."""
        self._playwright = await async_playwright().start()

        # Use real Chrome (not Playwright's Chromium) to bypass Turnstile bot detection.
        # channel="chrome" uses the system-installed Google Chrome.
        launch_options: dict = {
            "headless": settings.playwright_headless,
            "channel": "chrome",
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        }

        self._browser = await self._playwright.chromium.launch(**launch_options)

        storage_path = Path(settings.playwright_storage_path)
        context_options: dict = {
            "viewport": {"width": 1366, "height": 768},
        }

        if storage_path.exists():
            try:
                context_options["storage_state"] = str(storage_path)
                logger.info("loading_storage_state", path=str(storage_path))
            except Exception:
                logger.warning("failed_to_load_storage_state")

        self._context = await self._browser.new_context(**context_options)

        # Remove webdriver flag that Cloudflare Turnstile checks
        await self._context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

        self._page = await self._context.new_page()
        logger.info(
            "browser_initialized",
            headless=settings.playwright_headless,
            channel="chrome",
        )

    async def ensure_logged_in(self) -> bool:
        """Navigate to claude.ai and verify we're authenticated."""
        if not self._page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")

        await self._page.goto(
            self.CLAUDE_URL, wait_until="domcontentloaded", timeout=self.NAV_TIMEOUT_MS
        )
        await asyncio.sleep(3)

        current_url = self._page.url
        if "login" in current_url.lower():
            logger.warning(
                "not_logged_in",
                message="Session expired. Run scripts/login_claude.py first.",
            )
            return False

        login_btn = await self._page.query_selector(selectors.LOGIN_BUTTON)
        if login_btn:
            logger.warning("login_required")
            return False

        await self._save_storage_state()
        logger.info("logged_in_successfully")
        return True

    async def send_prompt(
        self,
        prompt: str,
        research_mode: bool = True,
        session_key: str | None = None,
    ) -> str:
        """Send a prompt, optionally reusing a persistent conversation.

        If session_key is provided, looks up an existing conversation in
        Supabase. If found and not too long, navigates to it and sends a
        follow-up. Otherwise creates a new conversation and stores the URL.
        """
        async with self._semaphore:
            await self._rate_limit()

            if not self._page:
                raise RuntimeError("Browser not initialized")

            # Try to resume an existing conversation
            resumed = False
            if session_key:
                resumed = await self._try_resume_conversation(session_key)

            if not resumed:
                # Start a new conversation
                await self._page.goto(self.CLAUDE_URL, wait_until="domcontentloaded", timeout=60000)
                await asyncio.sleep(2)

                if research_mode:
                    await self._enable_research_mode()

            timestamped = (
                f"[DATETIME: {datetime.now().strftime('%Y-%m-%d %H:%M:%S BRT')}]\n\n{prompt}"
            )

            await self._type_prompt(timestamped)
            await self._submit_prompt()

            response = await self._wait_and_extract_response()

            self._last_request_time = asyncio.get_event_loop().time()
            self._conversation_active = True
            self._current_session_key = session_key

            # Save/update conversation URL in Supabase
            if session_key and self._page:
                await self._save_conversation_url(session_key)

            logger.info(
                "prompt_sent",
                research=research_mode,
                session_key=session_key,
                resumed=resumed,
                response_length=len(response),
            )

            return response

    async def send_followup(self, prompt: str) -> str:
        """Send a follow-up message in the CURRENT conversation."""
        async with self._semaphore:
            await self._rate_limit()

            if not self._page:
                raise RuntimeError("Browser not initialized")

            if not self._conversation_active:
                raise RuntimeError("No active conversation. Call send_prompt() first.")

            timestamped = (
                f"[DATETIME: {datetime.now().strftime('%Y-%m-%d %H:%M:%S BRT')}]\n\n{prompt}"
            )

            await self._type_prompt(timestamped)
            await self._submit_prompt()

            response = await self._wait_and_extract_response()

            self._last_request_time = asyncio.get_event_loop().time()

            # Update message count
            if self._current_session_key:
                await self._increment_message_count(self._current_session_key)

            logger.info("followup_sent", response_length=len(response))
            return response

    def end_conversation(self) -> None:
        """Mark current conversation as ended."""
        self._conversation_active = False
        self._current_session_key = None

    def get_current_url(self) -> str | None:
        """Get the current page URL (conversation URL)."""
        if self._page:
            return self._page.url
        return None

    async def save_login_session(self) -> None:
        """Interactive login flow for first-time setup."""
        if not self._page:
            raise RuntimeError("Browser not initialized")

        logger.info("starting_manual_login", url=self.CLAUDE_URL)
        await self._page.goto(self.CLAUDE_URL, wait_until="domcontentloaded", timeout=60000)

        logger.info("waiting_for_manual_login", timeout="5 minutes")
        try:
            await self._page.wait_for_url("**/new**", timeout=300000)
        except Exception:
            if "claude.ai" in self._page.url and "login" not in self._page.url.lower():
                pass
            else:
                raise

        await asyncio.sleep(3)
        await self._save_storage_state()
        logger.info("login_session_saved")

    async def close(self) -> None:
        """Clean up browser resources."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("browser_closed")

    # --- Conversation persistence ---

    async def _try_resume_conversation(self, session_key: str) -> bool:
        """Try to navigate to an existing conversation. Returns True if successful."""
        try:
            db = get_supabase()
            result = (
                db.table("conversation_sessions")
                .select("*")
                .eq("session_key", session_key)
                .single()
                .execute()
            )

            if not result.data:
                return False

            session = result.data
            msg_count = session.get("message_count", 0)
            max_msgs = session.get("max_messages", MAX_MESSAGES_PER_CONVERSATION)

            # If conversation is too long, start fresh
            if msg_count >= max_msgs:
                logger.info(
                    "conversation_too_long",
                    session_key=session_key,
                    messages=msg_count,
                )
                db.table("conversation_sessions").delete().eq("session_key", session_key).execute()
                return False

            conversation_url = session["conversation_url"]
            logger.info(
                "resuming_conversation",
                session_key=session_key,
                url=conversation_url,
                messages=msg_count,
            )

            await self._page.goto(conversation_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(2)

            # Verify we're on the conversation page (not redirected to login)
            current = self._page.url
            if "login" in current.lower() or "/new" in current:
                logger.warning("conversation_resume_failed", redirected_to=current)
                return False

            self._conversation_active = True
            return True

        except Exception:
            logger.warning("conversation_resume_error", session_key=session_key)
            return False

    async def _save_conversation_url(self, session_key: str) -> None:
        """Save/update the current conversation URL in Supabase."""
        if not self._page:
            return

        url = self._page.url
        # Only save if it's an actual conversation URL (not /new)
        if "/new" in url or "login" in url.lower():
            return

        try:
            db = get_supabase()
            # Extract agent_name from session_key (format: "agent_name" or "agent_name:topic")
            parts = session_key.split(":", 1)
            agent_name = parts[0]
            topic = parts[1] if len(parts) > 1 else None

            db.table("conversation_sessions").upsert(
                {
                    "session_key": session_key,
                    "conversation_url": url,
                    "agent_name": agent_name,
                    "topic": topic,
                    "message_count": 1,
                    "last_used_at": datetime.now(UTC).isoformat(),
                },
                on_conflict="session_key",
            ).execute()

            logger.info(
                "conversation_saved",
                session_key=session_key,
                url=url[:80],
            )
        except Exception:
            logger.warning("conversation_save_failed", session_key=session_key)

    async def _increment_message_count(self, session_key: str) -> None:
        """Increment message count for a conversation session."""
        try:
            db = get_supabase()
            result = (
                db.table("conversation_sessions")
                .select("message_count")
                .eq("session_key", session_key)
                .single()
                .execute()
            )
            if result.data:
                new_count = (result.data.get("message_count", 0) or 0) + 1
                db.table("conversation_sessions").update(
                    {
                        "message_count": new_count,
                        "last_used_at": datetime.now(UTC).isoformat(),
                    }
                ).eq("session_key", session_key).execute()
        except Exception:
            pass  # Non-critical

    # --- Private methods ---

    async def _find_element(self, selectors_list: list[str]) -> ElementHandle | None:
        """Try multiple selectors and return the first matching element."""
        if not self._page:
            return None
        for selector in selectors_list:
            element = await self._page.query_selector(selector)
            if element:
                return element
        return None

    async def _enable_research_mode(self) -> None:
        """Toggle research/search mode on."""
        toggle = await self._find_element(
            [selectors.RESEARCH_TOGGLE, selectors.RESEARCH_TOGGLE_FALLBACK]
        )
        if toggle:
            await toggle.click()
            await asyncio.sleep(1)
            logger.info("research_mode_enabled")
        else:
            logger.warning("research_toggle_not_found")

    async def _type_prompt(self, text: str) -> None:
        """Type the prompt into the chat input."""
        editor = await self._find_element([selectors.CHAT_INPUT, selectors.CHAT_INPUT_FALLBACK])
        if not editor:
            raise RuntimeError("Chat input not found")

        await editor.click()
        await asyncio.sleep(0.5)
        await self._page.evaluate(f"navigator.clipboard.writeText({json.dumps(text)})")
        await self._page.keyboard.press("Control+V")
        await asyncio.sleep(1)

    async def _submit_prompt(self) -> None:
        """Click send or press Enter to submit."""
        btn = await self._find_element([selectors.SEND_BUTTON, selectors.SEND_BUTTON_FALLBACK])
        if btn:
            await btn.click()
            return

        if self._page:
            await self._page.keyboard.press("Enter")

    async def _wait_and_extract_response(self) -> str:
        """Wait for the response to complete and extract text."""
        if not self._page:
            return ""

        await asyncio.sleep(3)

        try:
            await self._page.wait_for_selector(
                selectors.COPY_BUTTON,
                timeout=self.RESPONSE_TIMEOUT_MS,
            )
        except Exception:
            try:
                await self._page.wait_for_selector(
                    selectors.RESPONSE_COMPLETE,
                    timeout=30000,
                )
            except Exception:
                logger.warning("response_wait_timeout_fallback")
                await asyncio.sleep(10)

        await asyncio.sleep(2)
        return await self._extract_last_response()

    async def _extract_last_response(self) -> str:
        """Extract text from the last assistant message."""
        if not self._page:
            return ""

        for selector in [
            selectors.ASSISTANT_MESSAGE,
            selectors.ASSISTANT_MESSAGE_FALLBACK,
        ]:
            messages = await self._page.query_selector_all(selector)
            if messages:
                return await messages[-1].inner_text()

        logger.warning("no_assistant_message_found")
        return ""

    async def _rate_limit(self) -> None:
        """Enforce minimum delay between requests."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < self.RATE_LIMIT_SECONDS:
            wait = self.RATE_LIMIT_SECONDS - elapsed
            logger.info("rate_limiting", wait_seconds=round(wait, 1))
            await asyncio.sleep(wait)

    async def _save_storage_state(self) -> None:
        """Persist browser session to disk."""
        if not self._context:
            return
        storage_path = Path(settings.playwright_storage_path)
        storage_path.parent.mkdir(parents=True, exist_ok=True)
        await self._context.storage_state(path=str(storage_path))
        logger.info("storage_state_saved", path=str(storage_path))
