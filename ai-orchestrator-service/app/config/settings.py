from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings configured via environment variables and .env file.
    Follows 12-factor app configuration methodology.
    """
    PORT: int = 5001
    ENVIRONMENT: str = "development"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 604800  # 7 Days default TTL

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Singleton provider for application settings with LRU caching.
    Ensures environment variables are only parsed once during lifecycle.
    """
    return Settings()
