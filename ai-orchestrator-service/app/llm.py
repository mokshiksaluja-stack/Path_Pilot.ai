import logging
from functools import lru_cache
from typing import Any, TypeVar
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel
from app.config.settings import get_settings

logger = logging.getLogger("ai-orchestrator.llm")

T = TypeVar("T", bound=BaseModel)


@lru_cache()
def get_chat_model(
    temperature: float = 0.2,
    max_output_tokens: int = 8192,
) -> ChatGoogleGenerativeAI:
    """
    Singleton provider for ChatGoogleGenerativeAI (Google Gemini 2.5 Flash).
    Cached with LRU cache to prevent re-instantiating HTTP client pools.
    """
    settings = get_settings()

    if not settings.GEMINI_API_KEY:
        logger.warning(
            "GEMINI_API_KEY is not configured in .env. LLM calls will fail until an API key is provided."
        )

    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY or "DUMMY_KEY_FOR_INITIALIZATION",
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )


async def ainvoke_structured_llm(
    prompt: Any,
    schema: type[T],
    temperature: float = 0.2
) -> T:
    """
    Executes an asynchronous LLM call enforcing native structured JSON schema.
    
    Args:
        prompt: ChatPromptValue, list of messages, or formatted prompt.
        schema: The Pydantic BaseModel class defining expected output structure.
        temperature: Sampling temperature (default 0.2 for deterministic output).
        
    Returns:
        Instance of schema (Pydantic model) populated with validated model predictions.
    """
    model = get_chat_model(temperature=temperature)
    structured_model = model.with_structured_output(schema)
    
    try:
        response = await structured_model.ainvoke(prompt)
        return response
    except Exception as exc:
        logger.error("Structured LLM invocation failed for schema %s: %s", schema.__name__, exc)
        raise


def invoke_structured_llm(
    prompt: Any,
    schema: type[T],
    temperature: float = 0.2
) -> T:
    """
    Synchronous variant for test scripts or blocking invocations.
    """
    model = get_chat_model(temperature=temperature)
    structured_model = model.with_structured_output(schema)
    return structured_model.invoke(prompt)
