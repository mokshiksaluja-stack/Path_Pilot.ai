import hashlib
import json
import logging
from typing import Any, Optional
import redis.asyncio as aioredis
from app.config.settings import get_settings

logger = logging.getLogger("ai-orchestrator.redis")

_redis_client: Optional[aioredis.Redis] = None


async def init_redis_client() -> Optional[aioredis.Redis]:
    """
    Initializes async Redis connection pool.
    """
    global _redis_client
    settings = get_settings()
    try:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        # Test connection ping
        await _redis_client.ping()
        logger.info("Connected successfully to Redis broker at %s", settings.REDIS_URL)
        return _redis_client
    except Exception as exc:
        logger.warning(
            "Redis connection failed (%s). System will run with caching disabled.",
            exc,
        )
        _redis_client = None
        return None


async def close_redis_client() -> None:
    """
    Closes the Redis connection pool gracefully during service shutdown.
    """
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        logger.info("Redis connection pool closed.")
        _redis_client = None


def generate_roadmap_cache_key(
    title: str,
    target_days: int,
    daily_hours: float,
    skill_level: str
) -> str:
    """
    Generates a deterministic SHA-256 cache key from normalized goal parameters.
    Format: roadmap:cache:<sha256_hex>
    """
    raw_signature = f"{title.strip().lower()}:{target_days}:{float(daily_hours)}:{skill_level.strip().lower()}"
    hashed_signature = hashlib.sha256(raw_signature.encode("utf-8")).hexdigest()
    return f"roadmap:cache:{hashed_signature}"


async def get_cached_roadmap(cache_key: str) -> Optional[dict[str, Any]]:
    """
    Fetches cached roadmap JSON if present. Returns None on cache miss or Redis error.
    """
    global _redis_client
    if not _redis_client:
        return None

    try:
        cached_val = await _redis_client.get(cache_key)
        if cached_val:
            logger.info("⚡ [CACHE HIT] Retrieved roadmap for key: %s in <15ms", cache_key)
            return json.loads(cached_val)
        logger.info("🔍 [CACHE MISS] No cached roadmap found for key: %s", cache_key)
        return None
    except Exception as exc:
        logger.warning("Error reading from Redis cache: %s", exc)
        return None


async def set_cached_roadmap(
    cache_key: str,
    roadmap_data: dict[str, Any],
    ttl_seconds: Optional[int] = None
) -> bool:
    """
    Stores generated roadmap JSON in Redis with configured TTL (default 7 days).
    """
    global _redis_client
    if not _redis_client:
        return False

    settings = get_settings()
    ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_TTL_SECONDS

    try:
        serialized = json.dumps(roadmap_data, default=str)
        await _redis_client.setex(cache_key, ttl, serialized)
        logger.info("💾 [CACHE SAVED] Roadmap stored with key %s (TTL: %ds)", cache_key, ttl)
        return True
    except Exception as exc:
        logger.warning("Error writing to Redis cache: %s", exc)
        return False
