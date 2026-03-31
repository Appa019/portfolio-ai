"""First-time login script for claude.ai.

Run with: python scripts/login_claude.py

Opens a visible browser window. Log in manually with your Google account.
The session will be saved for future headless use.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["PLAYWRIGHT_HEADLESS"] = "false"

from app.core.browser import ClaudeSession  # noqa: E402


async def main():
    session = ClaudeSession()
    try:
        await session.initialize()
        await session.save_login_session()
        print("\n✓ Login saved successfully! You can now run in headless mode.")
    except Exception as e:
        print(f"\n✗ Login failed: {e}")
        sys.exit(1)
    finally:
        await session.close()


if __name__ == "__main__":
    asyncio.run(main())
