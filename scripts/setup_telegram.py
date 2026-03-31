"""Setup script to find your Telegram chat_id.

1. Open Telegram and send any message to your bot
2. Run this script: python scripts/setup_telegram.py
3. It will print your chat_id to add to .env
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx


def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("Set TELEGRAM_BOT_TOKEN in your .env first")
        sys.exit(1)

    url = f"https://api.telegram.org/bot{token}/getUpdates"
    response = httpx.get(url, timeout=10)
    data = response.json()

    if not data.get("ok"):
        print(f"Telegram API error: {data}")
        sys.exit(1)

    results = data.get("result", [])
    if not results:
        print("No messages found. Send a message to your bot first!")
        sys.exit(1)

    seen = set()
    for update in results:
        msg = update.get("message", {})
        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        if chat_id and chat_id not in seen:
            seen.add(chat_id)
            name = chat.get("first_name", "Unknown")
            username = chat.get("username", "N/A")
            print(f"Chat ID: {chat_id}  |  Name: {name}  |  Username: @{username}")
            print(f"\nAdd this to your .env:")
            print(f"TELEGRAM_CHAT_ID={chat_id}")


if __name__ == "__main__":
    main()
