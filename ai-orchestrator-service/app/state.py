from typing import Any, Optional
from typing_extensions import TypedDict


class GraphState(TypedDict, total=False):
    """
    Centralized Shared State for the PathPilot AI LangGraph Workflow.
    
    Acts as the single source of truth across all nodes.
    Each node receives this state, executes its dedicated responsibility,
    and returns a partial dictionary that LangGraph merges into the state.
    """
    # ---------------------------------------------------------------------------
    # 1. User & Goal Input Parameters (Initialized at invocation)
    # ---------------------------------------------------------------------------
    user_query: str              # Target goal, e.g. "Master React and Node.js in 30 Days"
    target_days: int             # Total duration in days (e.g. 30)
    daily_hours: float           # Daily bandwidth budget (e.g. 2.0 hrs)
    skill_level: str             # "Beginner", "Intermediate", or "Advanced"

    # ---------------------------------------------------------------------------
    # 2. Intermediate Node Artifacts
    # ---------------------------------------------------------------------------
    roadmap_summary: str         # Pedagogical strategy and curriculum summary (from Architect)
    milestones: list[dict[str, Any]]        # Chronological milestone phases (from Architect)
    formatted_tasks: list[dict[str, Any]]   # Atomic 15-30m daily micro-tasks (from Decomposer)
    verified_resources: list[dict[str, Any]]# Curated documentation/tutorial links (from Curator)

    # ---------------------------------------------------------------------------
    # 3. Critic & Self-Correction Feedback Loop Controls
    # ---------------------------------------------------------------------------
    review_passed: bool          # Evaluation flag set by Reviewer Critic Node
    review_feedback: Optional[str] # Actionable diagnostic guidance if budget is exceeded
    retry_count: int             # Circuit breaker: tracks self-correction loops (max 2)

    # ---------------------------------------------------------------------------
    # 4. Final Compiled Output & Diagnostic State
    # ---------------------------------------------------------------------------
    final_roadmap: Optional[dict[str, Any]] # Validated output adhering to RoadmapSchema
    error_message: Optional[str] # Diagnostic error string if an unrecoverable failure occurs
