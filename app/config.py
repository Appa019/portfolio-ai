from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Telegram notifications
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # Backend
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Playwright
    google_email: str = ""
    playwright_headless: bool = True
    playwright_storage_path: str = "storage/claude_session.json"

    # APIs
    coingecko_api_url: str = "https://api.coingecko.com/api/v3"

    # Portfolio targets
    target_fixed_income: float = 0.35
    target_stocks: float = 0.40
    target_crypto: float = 0.25
    lockup_days: int = 31

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
