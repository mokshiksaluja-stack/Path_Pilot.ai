import logging
from typing import Any
from app.llm import ainvoke_structured_llm
from app.prompts.architect_prompt import ArchitectOutput, get_architect_prompt
from app.state import GraphState

logger = logging.getLogger("ai-orchestrator.nodes.architect")


async def architect_node(state: GraphState) -> dict[str, Any]:
    """
    LangGraph Node: Roadmap Architect.
    
    Responsibility:
    - Analyzes student goal, time budget, and proficiency tier.
    - Formulates the pedagogical summary and chronological milestone blueprints.
    - Writes `roadmap_summary` and `milestones` to the shared GraphState.
    """
    print("=" * 70)
    print("NODE: ROADMAP ARCHITECT (MILESTONES BLUEPRINT)")
    print("=" * 70)

    user_query = state.get("user_query", "")
    target_days = state.get("target_days", 30)
    daily_hours = state.get("daily_hours", 2.0)
    skill_level = state.get("skill_level", "Beginner")

    logger.info(
        "🎯 Running Architect Node for query='%s', days=%d, daily_hours=%.1f, level=%s",
        user_query, target_days, daily_hours, skill_level
    )

    try:
        prompt_template = get_architect_prompt()
        prompt_value = prompt_template.format_messages(
            user_query=user_query,
            target_days=target_days,
            daily_hours=daily_hours,
            skill_level=skill_level,
        )

        response: ArchitectOutput = await ainvoke_structured_llm(
            prompt=prompt_value,
            schema=ArchitectOutput,
            temperature=0.2,
        )

        logger.info(
            "✅ Architect Node succeeded: %d milestone blueprints generated.",
            len(response.milestones)
        )

        return {
            "roadmap_summary": response.roadmap_summary,
            "milestones": [m.model_dump() for m in response.milestones],
            "retry_count": state.get("retry_count", 0),
        }

    except Exception as ex:
        logger.error("❌ Error in architect_node: %s", ex, exc_info=True)
        return {
            "error_message": f"Architect Node failed: {str(ex)}"
        }
