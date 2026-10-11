from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SkillLevel(str, Enum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"


class GoalRequest(BaseModel):
    """
    Input contract for generating a personalized learning roadmap.
    Supports both camelCase (frontend/Node.js) and snake_case formats.
    """
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(
        ...,
        min_length=3,
        max_length=150,
        description="The target learning goal, e.g., 'Master React & Node.js'",
        examples=["Master React and Node.js in 30 Days"]
    )
    target_days: int = Field(
        default=30,
        ge=3,
        le=180,
        alias="targetDays",
        description="Total duration in days (minimum 3 days, maximum 180 days)",
        examples=[30]
    )
    daily_hours: float = Field(
        default=2.0,
        ge=0.5,
        le=12.0,
        alias="dailyHours",
        description="Available daily study bandwidth in hours (0.5 to 12.0)",
        examples=[2.0]
    )
    skill_level: SkillLevel = Field(
        default=SkillLevel.BEGINNER,
        alias="skillLevel",
        description="Student starting proficiency: Beginner, Intermediate, or Advanced",
        examples=["Beginner"]
    )


class ReAdaptRequest(BaseModel):
    """
    Input contract for dynamic adaptive schedule rebalancing.
    Triggered when a student reports falling behind or requests a pace adjustment.
    """
    model_config = ConfigDict(populate_by_name=True)

    goal_id: str = Field(
        ...,
        alias="goalId",
        description="UUID of the existing goal in PostgreSQL",
        examples=["550e8400-e29b-41d4-a716-446655440000"]
    )
    reason: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="User context for the delay, e.g., 'Fell behind 3 days due to college exams'",
        examples=["Fell behind 3 days due to college exams"]
    )
    missed_days: int = Field(
        default=3,
        ge=1,
        le=30,
        alias="missedDays",
        description="Estimated number of missed study days to rebalance",
        examples=[3]
    )
