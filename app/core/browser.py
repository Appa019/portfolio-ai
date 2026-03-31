import asyncio
import json
from datetime import datetime
from pathlib import Path

import structlog
from playwright.async_api import ElementHandle, Page, async_playwright

from app.config import settings
from app.core import selectors

logger = structlog.get_logger()


class ClaudeSession:
    """Manages a Playwright Chromium session against claude.ai.

    First login must be done in headed mode (PLAYWRIGHT_HEADLESS=false).
    Subsequent runs reuse the saved storage state.
    """

    CLAUDE_URL = "https://claude.ai/new"
    RATE_LIMIT_SECONDS = 30
    RESPONSE_TIMEOUT_MS = 300_000  # 5 minutes

    def __init__(self) -> None:
        self._playwright = None
        self._browser = None
        self._context = None
        self._page: Page | None = None
        self._last_request_time: float = 0
        self._semaphore = asyncio.Semaphore(1)
        self._conversation_active: bool = False

    async def initialize(self) -> None:
        """Launch browser and load storage state if available."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=settings.playwright_headless,
        )

        storage_path = Path(settings.playwright_storage_path)
        context_options: dict = {
            "viewport": {"width": 1280, "height": 900},
            "user_agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        }

        if storage_path.exists():
            try:
                context_options["storage_state"] = str(storage_path)
                logger.info("loading_storage_state", path=str(storage_path))
            except Exception:
                logger.warning("failed_to_load_storage_state")

        self._context = await self._browser.new_context(**context_options)
        self._page = await self._context.new_page()
        logger.info("browser_initialized", headless=settings.playwright_headless)

    async def ensure_logged_in(self) -> bool:
        """Navigate to claude.ai and verify we're authenticated."""
        if not self._page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")

        await self._page.goto(self.CLAUDE_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(2)

        current_url = self._page.url
        if "login" in current_url.lower():
            logger.warning(
                "not_logged_in",
                message="Session expired. Run with PLAYWRIGHT_HEADLESS=false to login manually.",
            )
            return False

        # Check for login button on page
        login_btn = await self._page.query_selector(selectors.LOGIN_BUTTON)
        if login_btn:
            logger.warning("login_required")
            return False

        # Save storage state for future sessions
        await self._save_storage_state()
        logger.info("logged_in_successfully")
        return True

    async def send_prompt(
        self,
        prompt: str,
        research_mode: bool = True,
    ) -> str:
        """Open a new conversation, send prompt, wait for response."""
        async with self._semaphore:
            await self._rate_limit()

            if not self._page:
                raise RuntimeError("Browser not initialized")

            # Navigate to new chat
            await self._page.goto(self.CLAUDE_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)

            # Enable research mode if requested
            if research_mode:
                await self._enable_research_mode()

            # Inject datetime into prompt
            timestamped = (
                f"[DATETIME: {datetime.now().strftime('%Y-%m-%d %H:%M:%S BRT')}]\n\n{prompt}"
            )

            # Type and send
            await self._type_prompt(timestamped)
            await self._submit_prompt()

            # Wait for complete response
            response = await self._wait_and_extract_response()

            self._last_request_time = asyncio.get_event_loop().time()
            self._conversation_active = True
            logger.info(
                "prompt_sent",
                research=research_mode,
                response_length=len(response),
            )

            return response

    async def send_followup(self, prompt: str) -> str:
        """Send a follow-up message in the CURRENT conversation (no navigation).

        Must be called after send_prompt() which opens the conversation.
        Stays on the same page and types into the existing chat.
        """
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
            logger.info(
                "followup_sent",
                response_length=len(response),
            )

            return response

    def end_conversation(self) -> None:
        """Mark current conversation as ended."""
        self._conversation_active = False

    async def save_login_session(self) -> None:
        """Interactive login flow for first-time setup.

        Run with PLAYWRIGHT_HEADLESS=false. This opens the browser,
        navigates to claude.ai, and waits for you to complete login manually.
        After login, saves the storage state for future headless sessions.
        """
        if not self._page:
            raise RuntimeError("Browser not initialized")

        logger.info("starting_manual_login", url=self.CLAUDE_URL)
        await self._page.goto(self.CLAUDE_URL, wait_until="networkidle", timeout=60000)

        # Wait for user to complete login (up to 5 minutes)
        logger.info("waiting_for_manual_login", timeout="5 minutes")
        try:
            await self._page.wait_for_url(
                "**/new**",
                timeout=300000,
            )
        except Exception:
            # Also check if we ended up on the main chat page
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
        # Use clipboard paste for long prompts (faster, more reliable)
        await self._page.evaluate(f"navigator.clipboard.writeText({json.dumps(text)})")
        await self._page.keyboard.press("Control+V")
        await asyncio.sleep(1)

    async def _submit_prompt(self) -> None:
        """Click send or press Enter to submit."""
        btn = await self._find_element([selectors.SEND_BUTTON, selectors.SEND_BUTTON_FALLBACK])
        if btn:
            await btn.click()
            return

        # Fallback: press Enter
        if self._page:
            await self._page.keyboard.press("Enter")

    async def _wait_and_extract_response(self) -> str:
        """Wait for the response to complete and extract text."""
        if not self._page:
            return ""

        # Wait for streaming to start (message appears)
        await asyncio.sleep(3)

        # Wait for streaming to complete (actions appear or streaming flag changes)
        try:
            await self._page.wait_for_selector(
                selectors.COPY_BUTTON,
                timeout=self.RESPONSE_TIMEOUT_MS,
            )
        except Exception:
            # Fallback: wait for streaming indicator to disappear
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

        # Ultimate fallback: try to get any response text
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
