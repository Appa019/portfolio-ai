"""Create the admin user in Supabase Auth.

Usage:
    python scripts/create_user.py
"""

import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def main() -> None:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_key:
        print("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    email = os.getenv("AUTH_USER_EMAIL", "pedropestana.fgv@gmail.com")
    password = os.getenv("AUTH_USER_PASSWORD")

    if not password:
        print("Error: AUTH_USER_PASSWORD must be set in .env")
        sys.exit(1)

    client = create_client(url, service_key)

    try:
        result = client.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
            }
        )
        print(f"User created: {result.user.email} (id: {result.user.id})")
    except Exception as exc:
        message = str(exc)
        if "already" in message.lower() or "duplicate" in message.lower():
            print(f"User {email} already exists.")
        else:
            print(f"Error creating user: {message}")
            sys.exit(1)


if __name__ == "__main__":
    main()
