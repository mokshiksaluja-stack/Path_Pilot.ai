import json
import logging
from typing import Any
from app.llm import ainvoke_structured_llm
from app.prompts.decomposer_prompt import DecomposerOutput, get_decomposer_prompt
from app.state import GraphState

logger = logging.getLogger("ai-orchestrator.nodes.decomposer")


async def decomposer_node(state: GraphState) -> dict[str, Any]:
    """
    LangGraph Node: Micro-Task Decomposer.
    
    Responsibility:
    - Slices milestone focus areas into atomic, daily 15-30 minute micro-tasks.
    - Calibrates task count and estimated minutes to fit within the student's daily_hours budget.
    - Assigns difficulty tiers (EASY, MEDIUM, HARD).
    - If looping back from a failed Critic review, incorporates review_feedback for self-correction.
    - Writes `formatted_tasks` and updated `milestones` into the shared GraphState.
    """
    print("=" * 70)
    print("NODE: MICRO-TASK DECOMPOSER (ATOMIC DAILY TASKS)")
    print("=" * 70)

    milestones = state.get("milestones", [])
    target_days = state.get("target_days", 30)
    daily_hours = state.get("daily_hours", 2.0)
    skill_level = state.get("skill_level", "Beginner")
    review_feedback = state.get("review_feedback")
    max_daily_mins = int(daily_hours * 60)

    logger.info(
        "⚙️ Running Decomposer Node: %d milestones, daily_budget=%d mins, feedback=%s",
        len(milestones), max_daily_mins, bool(review_feedback)
    )

    if not milestones:
        logger.warning("No milestones found in state. Skipping decomposer.")
        return {
            "error_message": "Decomposer Node failed: Milestones list is empty in GraphState."
        }

    try:
        prompt_template = get_decomposer_prompt(review_feedback=review_feedback)
        prompt_value = prompt_template.format_messages(
            target_days=target_days,
            daily_hours=daily_hours,
            max_daily_mins=max_daily_mins,
            skill_level=skill_level,
            milestones_json=json.dumps(milestones, indent=2),
        )

        response: DecomposerOutput = await ainvoke_structured_llm(
            prompt=prompt_value,
            schema=DecomposerOutput,
            temperature=0.2,
        )

        # Collect flat list of all atomic tasks across milestones
        flat_tasks: list[dict[str, Any]] = []
        updated_milestones: list[dict[str, Any]] = []

        for m_decomp in response.milestone_decompositions:
            m_dict = m_decomp.model_dump()
            updated_milestones.append(m_dict)
            for task in m_dict.get("tasks", []):
                # Ensure milestone metadata is attached to each task for easy lookup
                task["milestone_order_index"] = m_dict["order_index"]
                task["milestone_title"] = m_dict["title"]
                flat_tasks.append(task)

        logger.info(
            "✅ Decomposer Node succeeded: Generated %d daily tasks across %d milestones.",
            len(flat_tasks), len(updated_milestones)
        )

        return {
            "milestones": updated_milestones,
            "formatted_tasks": flat_tasks,
            "review_feedback": None,  # Reset feedback after processing correction
        }

    except Exception as ex:
        logger.error("❌ Error in decomposer_node: %s", ex, exc_info=True)
        return {
            "error_message": f"Decomposer Node failed: {str(ex)}"
        }
