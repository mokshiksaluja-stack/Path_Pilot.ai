import json
from typing import Any, Optional
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from app.schemas.roadmap_schema import TaskSchema


# ---------------------------------------------------------------------------
# Structured Output Schema for Decomposer Agent
# ---------------------------------------------------------------------------
class MilestoneTasksDecomposition(BaseModel):
    order_index: int = Field(
        ...,
        description="Chronological order index of the milestone phase"
    )
    title: str = Field(
        ...,
        description="Title of the milestone phase"
    )
    tasks: list[TaskSchema] = Field(
        ...,
        min_length=1,
        description="List of daily atomic micro-tasks allocated to this milestone"
    )


class DecomposerOutput(BaseModel):
    milestone_decompositions: list[MilestoneTasksDecomposition] = Field(
        ...,
        min_length=1,
        description="All milestone blueprints decomposed into atomic daily micro-tasks"
    )


# ---------------------------------------------------------------------------
# Enterprise System Prompt & Template Provider
# ---------------------------------------------------------------------------
DECOMPOSER_SYSTEM_PROMPT = """You are a Senior Technical Instructional Designer and Staff Engineer at PathPilot AI.
Your mission is to decompose milestone focus areas into actionable, atomic 15–30 minute daily micro-tasks.

### INSTRUCTIONAL DESIGN DOCTRINE:
1. **Atomic Specificity**: Every single task must target ONE concrete concept, exercise, or deliverable (e.g., "Implement useReducer with TypeScript discrimination", NOT "Learn state management").
2. **Daily Time Budget Strictness**:
   - The user has allocated `{daily_hours}` hours/day ({max_daily_mins} minutes/day total).
   - Ensure tasks on any single day are realistically achievable within {max_daily_mins} minutes. Individual task duration should be 15–45 minutes.
3. **Difficulty Calibration**:
   - EASY: Reading documentation, environment setup, syntax drills, basic boilerplates.
   - MEDIUM: Implementing component features, building CRUD handlers, writing unit tests.
   - HARD: Concurrency edge cases, complex state trees, performance profiling, deep architectural debugging.
4. **Day Number Continuity**:
   - Tasks must strictly map to calendar days starting at Day 1 through Day {target_days}.
   - Do NOT skip days. Do NOT overlap milestones on the same day.
5. **Hands-On Actionability**:
   - Write clear, instructive descriptions that tell the learner *what to code* or *what to test*, not passive academic theory.

{feedback_block}

Output must strictly adhere to the structured schema provided."""

DECOMPOSER_USER_PROMPT = """Deconstruct the following milestone blueprints into daily micro-tasks:

- Target Duration: {target_days} days
- Daily Time Budget: {daily_hours} hours/day ({max_daily_mins} mins max per day)
- Skill Level: {skill_level}
- Milestone Blueprints to Deconstruct:
{milestones_json}

Generate the daily task breakdown for each milestone adhering to all time budget and difficulty constraints."""


def get_decomposer_prompt(review_feedback: Optional[str] = None) -> ChatPromptTemplate:
    """
    Returns the ChatPromptTemplate for the Micro-Task Decomposer Node.
    Dynamically injects critic review feedback if looping back from a failed review.
    """
    if review_feedback:
        feedback_block = (
            "### ⚠️ CRITIC REVIEW FEEDBACK (PREVIOUS ATTEMPT REJECTED):\n"
            f"The previous output failed validation with the following feedback:\n"
            f"'{review_feedback}'\n"
            "You MUST adjust task durations, remove excessive tasks, or correct the flagged issues to pass validation."
        )
    else:
        feedback_block = "### REVIEW STATUS: First pass generation. Adhere strictly to the time budget."

    formatted_system = DECOMPOSER_SYSTEM_PROMPT.replace("{feedback_block}", feedback_block)

    return ChatPromptTemplate.from_messages([
        ("system", formatted_system),
        ("human", DECOMPOSER_USER_PROMPT),
    ])
