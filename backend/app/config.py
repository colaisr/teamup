from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BACKEND_ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    database_url: str = "postgresql+psycopg2://teamup:teamup@localhost:5432/teamup"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24

    smtp_host: str = "smtp.example.com"
    smtp_port: int = 587
    smtp_user: str = "user@example.com"
    smtp_password: str = "change-me"
    smtp_from: str = "noreply@example.com"
    smtp_use_tls: bool = True

    encryption_key_base64: str = ""

    clickup_api_base: str = "https://api.clickup.com/api/v2"
    openrouter_api_base: str = "https://openrouter.ai/api/v1"
    openrouter_http_referer: str = "http://localhost:3000"
    openrouter_app_title: str = "TeamUp"


settings = Settings()

