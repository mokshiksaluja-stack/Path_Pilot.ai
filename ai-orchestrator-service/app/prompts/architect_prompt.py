from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Structured Output Models for Roadmap Architect
# ---------------------------------------------------------------------------
class MilestoneBlueprint(BaseModel):
    order_index: int = Field(
        ...,
        description="1-based chronological index of this milestone phase"
    )
    title: str = Field(
        ...,
        description="Concise, high-impact milestone title (e.g. 'Phase 1: React Fundamentals & Component Lifecycle')"
    )
    focus_areas: list[str] = Field(
        ...,
        description="Key architectural concepts, technical deliverables, and core skills covered in this phase"
    )
    day_range: str = Field(
        ...,
        description="Calendar day span allocation for this milestone (e.g. 'Days 1-7' or 'Days 8-14')"
    )


class ArchitectOutput(BaseModel):
    roadmap_summary: str = Field(
        ...,
        description="Comprehensive pedagogical summary outlining the curriculum strategy, learning objectives, and expected outcomes"
    )
    milestones: list[MilestoneBlueprint] = Field(
        ...,
        min_length=1,
        description="Chronological, progressive milestone stages spanning the complete target duration"
    )


# ---------------------------------------------------------------------------
# Enterprise System Prompt & Template Provider
# ---------------------------------------------------------------------------
ARCHITECT_SYSTEM_PROMPT = """You are a Principal Curriculum Architect and Staff Software Engineer at PathPilot AI.
Your mission is to deconstruct ambitious technical learning goals into mathematically sound, pedagogically rigorous weekly milestone roadmaps.

### CURRICULUM DOCTRINE:
1. **First-Principles Progression**: Start with fundamental mental models and syntax before advancing to production frameworks, design patterns, and distributed systems.
2. **Realistic Scope Partitioning**: Divide the complete `{target_days}` day duration into balanced milestone phases (typically 1-week blocks) without any gaps or overlapping days.
3. **Bandwidth Calibration**: Calibrate technical depth to the student's daily study budget of `{daily_hours}` hours/day.
4. **Skill-Level Adaptation**:
   - Beginner: Emphasize fundamental mechanics, error patterns, debugging, and small isolated builds.
   - Intermediate: Emphasize architectural patterns, testing, performance, and integrated full-stack workflows.
   - Advanced: Emphasize internal runtimes, concurrency, scale, trade-offs, and production hardening.
5. **Zero Hallucination / Fluff**: Avoid generic marketing phrases like "Master the basics". Use exact technical concepts (e.g., "Closure mechanics, event loop tick order, and custom React hooks").

Output must strictly adhere to the structured schema provided."""

ARCHITECT_USER_PROMPT = """Deconstruct the following learning goal into a structured milestone roadmap:

- Target Goal: {user_query}
- Total Duration: {target_days} days
- Daily Time Budget: {daily_hours} hours/day
- Starting Skill Level: {skill_level}

Formulate the pedagogical summary and partition the timeline into sequential milestone phases."""


def get_architect_prompt() -> ChatPromptTemplate:
    """
    Returns the ChatPromptTemplate for the Roadmap Architect Agent.
    """
    return ChatPromptTemplate.from_messages([
        ("system", ARCHITECT_SYSTEM_PROMPT),
        ("human", ARCHITECT_USER_PROMPT),
    ])
