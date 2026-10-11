# 🚀 PathPilot AI — Complete Master Architecture & Project Context Document
This document contains **100% of the complete architectural, design, technical, and implementation context** for **PathPilot AI**. 
> **Instruction for AI Agents / Antigravity IDE**: Read this file to instantly gain full context on the system architecture, microservices layout, database schemas, API contracts, design decisions, and current implementation progress.
---
## 📌 1. Project Vision & Executive Context
### Problem Statement
Static learning roadmaps (e.g., generic blogs, YouTube videos, roadmap.sh) fail because:
1. They are generic and do not adapt to a student's daily available time.
2. They offer no daily micro-accountability or actionable 15–30 minute tasks.
3. When a student falls behind by 2–3 days due to exams or life, static roadmaps become useless.
### Solution: PathPilot AI
**PathPilot AI** is an adaptive, agentic learning acceleration platform designed for college students, self-taught developers, and job seekers. A user inputs a goal (e.g., *"Clear GSoC 2027"* or *"Master React & Node in 30 Days"*). The system:
- Generates a personalized timeline broken down into weekly milestones and daily 15–30 minute micro-tasks with curated links.
- Uses **Redis + BullMQ** to send daily automated WhatsApp/Email reminders.
- Uses an **Adaptive AI Agent** to recalculate future uncompleted tasks when a user falls behind without wiping out historical completed data.
- Employs **Redis Caching** to return duplicate roadmap queries in under **15ms**, saving >70% on LLM API costs.
---
## 🏗️ 2. High-Level Design (HLD) — Microservices Architecture
The system is engineered as a **Distributed Microservices Architecture** containerized with Docker Compose to demonstrate high fault isolation, independent service scaling, and production-grade software engineering.
### System Architecture Diagram
```mermaid
graph TD
    Client[React 18 + Vite SPA (:3000)] <-->|HTTP / REST| Gateway[Microservice 1: API Gateway (Node.js/Express :5050)]
    
    Gateway <-->|JWT Auth & Token Bucket Rate Limit| RedisBroker[(Redis 7 Broker & Cache :6379)]
    
    Gateway <-->|Internal REST API :5002| CoreService[Microservice 2: Roadmap Core Service (Node.js/Express :5002)]
    CoreService <-->|Prisma ORM| PostgresDB[(PostgreSQL 16 Database :5432)]
    
    Gateway <-->|Internal REST API :5001| AIService[Microservice 3: AI Orchestrator Service (Node.js/Express :5001)]
    AIService <-->|LLM API Calls| GeminiAPI[Google Gemini 2.5 Flash API]
    AIService <-->|Cache Hashed Roadmaps| RedisBroker
    
    Gateway -->|Publish Job Payload| RedisBroker
    RedisBroker <-->|Consume BullMQ Jobs| WorkerService[Microservice 4: Notification Worker Service]
    WorkerService -->|Deliver Email / Push| ExternalNudge[Nodemailer / WhatsApp Gateway]
Microservices Responsibilities
client-frontend (Port 3000):

React 18 + Vite SPA + Tailwind CSS + Lucide Icons + React Flow.
Renders interactive visual node trees for roadmaps, daily task checklists, streak counters, and adaptive schedule shift triggers.
api-gateway (Port 5050 / 5000):

Built with Node.js & Express.
Single reverse proxy entry point. Handles JWT authentication, request validation, CORS policy, and Redis-based token-bucket rate limiting (max 10 req/min per user).
ai-orchestrator-service (Port 5001):

Built with Python 3.12, FastAPI, and LangGraph.
Runs an agentic StateGraph workflow powered by Google Gemini 2.5 Flash (`gemini-2.5-flash`).
Enforces schema validation with Pydantic (`BaseModel`) and structured outputs.
Checks & writes hashed roadmap outputs to Redis Cache (7-day TTL).
roadmap-core-service (Port 5002):

Built with Node.js, Express, and Prisma ORM using a Layered Clean Architecture (controller 
→
→ services 
→
→ repositories 
→
→ models).
Manages relational persistent storage in PostgreSQL 16 (Users, Goals, Milestones, Daily Tasks, User Progress, Streaks).
notification-worker-service (Background Worker):

Event-driven background process connected to Redis (BullMQ).
Consumes scheduled reminder jobs (daily_reminder_queue) asynchronously without blocking HTTP request threads.
Infrastructure Tier (Docker Compose):

postgres-db: PostgreSQL 16 Alpine container (Port 5432).
redis-broker: Redis 7 Alpine container (Port 6379).
📐 3. Low-Level Design (LLD)
3.1 Database Schema (Prisma ORM / PostgreSQL)
prisma


datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
generator client {
  provider = "prisma-client-js"
}
enum GoalStatus {
  IN_PROGRESS
  COMPLETED
  BEHIND_SCHEDULE
  PAUSED
}
enum TaskDifficulty {
  EASY
  MEDIUM
  HARD
}
model User {
  id           String      @id @default(uuid())
  email        String      @unique
  passwordHash String
  name         String
  currentStreak Int        @default(0)
  longestStreak Int        @default(0)
  lastActiveAt DateTime    @default(now())
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  goals        Goal[]
  notifications NotificationLog[]
}
model Goal {
  id             String      @id @default(uuid())
  userId         String
  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  title          String      // e.g., "Clear GSoC 2027" or "Master React"
  description    String?
  targetDate     DateTime
  dailyHours     Float       @default(2.0)
  status         GoalStatus  @default(IN_PROGRESS)
  createdAt      DateTime    @default(now())
  roadmap        Roadmap?
}
model Roadmap {
  id           String      @id @default(uuid())
  goalId       String      @unique
  goal         Goal        @relation(fields: [goalId], references: [id], onDelete: Cascade)
  summary      String
  totalDays    Int
  createdAt    DateTime    @default(now())
  milestones   Milestone[]
}
model Milestone {
  id          String      @id @default(uuid())
  roadmapId   String
  roadmap     Roadmap     @relation(fields: [roadmapId], references: [id], onDelete: Cascade)
  title       String      // e.g., "Week 1: State Management & Hooks"
  orderIndex  Int
  
  dailyTasks  DailyTask[]
}
model DailyTask {
  id          String         @id @default(uuid())
  milestoneId String
  milestone   Milestone      @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  dayNumber   Int            // Day 1 to Day N
  title       String
  description String
  resourceUrl String?
  estimatedMins Int         @default(30)
  difficulty  TaskDifficulty @default(MEDIUM)
  isCompleted Boolean        @default(false)
  completedAt DateTime?
  progressLogs UserProgress[]
}
model UserProgress {
  id          String    @id @default(uuid())
  taskId      String
  task        DailyTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userFeedback String?  // "EASY", "MEDIUM", "HARD"
  createdAt   DateTime  @default(now())
}
model NotificationLog {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel   String   // "EMAIL", "WHATSAPP"
  status    String   // "SENT", "FAILED"
  sentAt    DateTime @default(now())
}
3.2 Enterprise Layered Architecture Standards
Each microservice backend follows the Standard Enterprise Microservice Folder Layout (src/):



src/
├── config/        # Environment vars, Prisma singleton, Redis connections
├── controller/    # HTTP Request & Response handlers (req, res, HTTP status codes)
├── middleware/    # Auth, Validation, Rate Limiting, & Error Handling Middlewares
├── models/        # DTOs, interfaces, and Prisma type extensions
├── repositories/  # Data Access Layer (DAL) — Direct Prisma SQL & $transaction queries
├── routes/        # Express router definitions
├── services/      # Business Logic Layer — Orchestrates repositories & domain math
└── utils/         # Helper utilities (Date math, custom AppError classes, response formatters)
Layer Responsibilities
routes/: Map HTTP endpoints to controller functions.
controller/: Extract params & body, validate HTTP input, call service, return JSON.
services/: Implement core domain logic (streak calculation, schedule shifts) by calling repositories.
repositories/: Perform database operations using Prisma (findUnique, update, $transaction).
middleware/: Reusable request pre-processors (e.g. JWT check, error handler).
3.3 Redis Key Schema & Queue Design
Key / Queue Name	Type	TTL / Retention	Function
roadmap:cache:<hash>	String (JSON)	7 Days (604,800s)	Caches AI-generated roadmaps for duplicate prompt queries.
user:streak:<user_id>	String (Int)	No Expiry	Fast lookup for active streak counters.
ratelimit:<user_id>	String (Int)	60 Seconds	Tracks requests per minute (max 10 req/min).
daily_reminder_queue	BullMQ Queue	Persistent	Holds scheduled notification payloads for background worker.
3.4 API Contracts
1. Generate Goal Roadmap
Endpoint: POST /api/v1/goals/generate
Headers: Authorization: Bearer <JWT>
Request Body:
json


{
  "title": "Master React and Node.js",
  "targetDays": 30,
  "dailyHours": 2,
  "skillLevel": "Beginner"
}
Response (201 Created):
json


{
  "goalId": "g-12345",
  "status": "SUCCESS",
  "cached": false,
  "roadmap": {
    "summary": "30-Day Full-Stack Accelerator",
    "totalDays": 30,
    "milestones": [
      {
        "title": "Week 1: Modern React Fundamentals",
        "tasks": [
          {
            "dayNumber": 1,
            "title": "JSX & Component State",
            "estimatedMins": 30,
            "resourceUrl": "https://react.dev/learn"
          }
        ]
      }
    ]
  }
}
2. Complete Daily Task & Update Streaks
Endpoint: POST /api/v1/tasks/:taskId/complete
Request Body: { "feedback": "EASY" }
Response (200 OK): { "success": true, "currentStreak": 6, "longestStreak": 10, "streakUpdated": true }
3. Adaptive Schedule Shift
Endpoint: POST /api/v1/goals/:goalId/re-adapt
Request Body: { "reason": "Fell behind 3 days due to midterms" }
Response (200 OK): Recalculated remaining uncompleted tasks with new dates.
🛠️ 4. Tech Stack & Package Matrix
Component	Framework / Library	Exact Package	Why Selected
Frontend	React 18 + Vite	react, vite, tailwindcss	Ultra-fast build tool & component ecosystem.
Visual Node Graph	React Flow	@xyflow/react	Displays interactive node-based roadmap paths.
API Gateway	Node.js + Express	express, jsonwebtoken, helmet	Single entry reverse proxy, CORS, JWT auth.
Database & ORM	PostgreSQL 16 + Prisma	@prisma/client, prisma	Type-safe auto-generated database client.
Caching & Queues	Redis 7 + BullMQ	ioredis, bullmq	Non-blocking async queue & lightning-fast caching.
AI Workflows	LangGraph + Gemini API	langgraph, langchain-google-genai, pydantic	StateGraph multi-agent pipeline & structured output parsing.
Containerization	Docker & Compose	docker-compose.yml	Multi-container environment isolation.
📂 5. Workspace Directory Structure


pathpilot-ai/
├── README.md                 # Brief project summary & container quickstart
├── PROJECT_CONTEXT.md        # THIS FILE — 100% complete master context document
├── docker-compose.yml        # PostgreSQL (5432) & Redis (6379) infrastructure
├── client/                   # React + Vite Frontend SPA (Port 3000)
├── api-gateway/              # Express API Gateway Microservice (Port 5050)
├── roadmap-core-service/     # Prisma + Express PostgreSQL CRUD Microservice (Port 5002)
│   ├── src/
│   │   ├── config/           # DB Client & Env Configuration
│   │   ├── controller/       # HTTP Request & Response Handlers
│   │   ├── middleware/       # Auth, Rate Limit, Error Handling Middlewares
│   │   ├── models/           # DTOs & Schema Extensions
│   │   ├── repositories/     # Database Access Layer (Prisma Queries & $transaction)
│   │   ├── routes/           # Express Endpoint Routes
│   │   ├── services/         # Domain Business Logic Layer
│   │   └── utils/            # Helper Utilities & Custom Error Classes
│   └── prisma/               # PostgreSQL Database Schemas & Migrations
├── ai-orchestrator-service/  # Python 3.12 + FastAPI + LangGraph AI Microservice (Port 5001)
└── notification-worker/      # BullMQ Redis Background Worker Microservice
🚦 6. Pair-Programming & Mentorship Rules
When interacting with this project in any AI thread:

NO CODE DUMPING:
Do NOT generate 300+ line monster controller files or dump 6 API endpoints all at once.
Build code incrementally: feature-by-feature and route-by-route.
ARCHITECTURAL TRACING:
Explain explicitly how the request flows across the layered architecture: routes/ 
⟶
⟶ controller/ 
⟶
⟶ services/ 
⟶
⟶ repositories/ 
⟶
⟶ config/.
LAYERED CLEAN ARCHITECTURE:
Keep controllers thin (HTTP concerns only).
Keep business logic in services/.
Keep Prisma database queries inside repositories/.
MILESTONE TESTING CHECKPOINTS (cURL & Postman):
Hit a Testing Checkpoint at meaningful milestones (after completing 3–4 related endpoints or a major concept like Prisma $transaction, Redis caching, or BullMQ queues).
Provide exact cURL commands, Postman JSON bodies, and expected status codes (200 OK, 201 Created).
EXECUTION CONTROL:
Complete ONLY the current feature step, then STOP and wait for the user to test and say "next".


---
*(Whenever you are ready to begin **Step 2 — Repositories & Database Layer**, type **next**!)*
# # follow these rules 

Act as my Senior Developer Mentor & Pair Programmer for PathPilot AI.
CRITICAL INSTRUCTIONS FOR CODE GENERATION & PAIR PROGRAMMING:
1. ABSOLUTELY NO CODE DUMPING:
   - Do NOT generate 300+ line monster controller files or dump 6 API endpoints all at once.
   - We will write code like real senior software developers do: feature-by-feature and route-by-route.
2. ARCHITECTURAL TRACING & FILE CONNECTIONS:
   - Before giving me code for a feature, explicitly explain how the request flows across files:
     server.js  ==>  routes/goalRoutes.js  ==>  controllers/goalController.js  ==>  config/prisma.js
   - Tell me exact file paths so I know where each piece of code belongs and how imports connect.
3. INCREMENTAL ATOMIC CODE DELIVERY:
   - Deliver code in small, digestible steps:
     Step A: Route definition in `routes/`.
     Step B: Controller handler function in `controllers/`.
     Step C: DB query / transaction logic in `config/prisma.js` or service layer.
   - Do NOT force dummy or unused middleware until we actually implement authentication or rate-limiting.
4. MILESTONE TESTING CHECKPOINTS (cURL & Postman):
   - Do NOT stop after every single 5-line route.
   - Instead, hit a Testing Checkpoint at meaningful milestones (after completing a cluster of 3–4 related endpoints, or when introducing a major technical concept like Prisma Atomic Transactions, Redis Caching, or BullMQ Queues).
   - At each checkpoint, provide:
     a) Exact cURL command I can run in my terminal.
     b) Postman JSON request body & HTTP headers.
     c) Expected HTTP response status code (e.g. 201 Created, 200 OK) and JSON output structure.
5. TEACH THE "WHY" (SENIOR MENTOR STYLE):
   - Briefly highlight design patterns (e.g. Singleton Pattern for Prisma, Atomic Transaction Pattern, Repository Pattern) when they genuinely improve the codebase.
   - Tell me what error cases to watch out for (e.g. database connection leaks, missing payload validation, race conditions).
6. EXECUTION CONTROL:
   - Complete ONLY the current feature step, then STOP and wait for me to test and say "next".




## 📐 3.6 AI Orchestrator Service Architecture (Python 3.12 / FastAPI / LangGraph)

> **Reference Repository Patterns**: https://github.com/mokshiksaluja-stack/100_days_of-_ai.git  
> Incorporates state machine models from `day-47-langgraph-ai-coding-assistant` and multi-agent orchestrator patterns from `ai_careerCoach`.

#### Enterprise Python Microservice Folder Structure (`ai-orchestrator-service/`)
```
ai-orchestrator-service/
├── Dockerfile
├── requirements.txt
├── main.py                     # FastAPI server entry point (Port 5001)
└── app/
    ├── config/                 # Settings, API Keys, Environment configuration
    │   └── settings.py         # Pydantic BaseSettings for ENV vars
    ├── llm.py                  # Centralized Gemini LLM configuration + invoke_structured_llm helper
    ├── state.py                # GraphState TypedDict (Shared memory across all nodes)
    ├── router.py               # Conditional edge routing logic (route_after_review)
    ├── graph.py                # StateGraph construction, edges, compilation
    ├── schemas/                # Pydantic Input/Output Validation Models
    │   ├── request_schema.py   # GoalRequest, ReAdaptRequest
    │   └── roadmap_schema.py   # RoadmapResponse, MilestoneSchema, TaskSchema
    ├── prompts/                # Modular, versioned prompt templates
    │   ├── architect_prompt.py # Milestone generation prompt template
    │   ├── decomposer_prompt.py# Daily 15-30 min atomic micro-task prompt template
    │   ├── curator_prompt.py   # Verified learning resource curation prompt template
    │   └── reviewer_prompt.py  # Critic time-budget evaluation prompt template
    ├── nodes/                  # Pure LangGraph Processing Nodes (state -> update dict)
    │   ├── architect_node.py   # Generates milestone blueprints
    │   ├── decomposer_node.py  # Slices milestones into daily tasks
    │   ├── curator_node.py     # Attaches verified documentation URLs
    │   └── reviewer_node.py    # Evaluates daily bandwidth & triggers self-correction loop
    ├── services/               # Redis Caching & External Service Wrappers
    │   └── redis_cache.py      # Checks & writes 15ms cached JSON roadmaps
    └── api/                    # FastAPI Endpoint Routers
        └── v1/
            ├── roadmap_router.py # POST /ai/v1/generate-roadmap
            └── adapt_router.py   # POST /ai/v1/re-adapt-schedule
```

#### Key Engineering Standards & Design Patterns in Python AI Orchestrator

1. **Pydantic Type Validation (`app/schemas/roadmap_schema.py`)**:
   - All AI prompt outputs are constrained using Pydantic `BaseModel` models (`Field(description=...)`) with Gemini structured outputs.
   - Ensures the LLM returns 100% valid JSON matching the exact relational schema required by PostgreSQL.

2. **LangGraph State Management (`app/state.py`)**:
   - Shared Graph State defined as a `TypedDict` containing:
     ```python
     class GraphState(TypedDict, total=False):
         user_query: str
         target_days: int
         daily_hours: float
         skill_level: str
         roadmap_summary: str
         milestones: list[dict]
         formatted_tasks: list[dict]
         verified_resources: list[dict]
         review_passed: bool
         review_feedback: Optional[str]
         retry_count: int
         final_roadmap: Optional[dict]
         error_message: Optional[str]
     ```

3. **Separation of Prompts & Nodes (`app/prompts/` & `app/nodes/`)**:
   - Prompts are defined as versioned templates in `app/prompts/`.
   - Nodes in `app/nodes/` strictly follow the LangGraph node pattern:
     ```python
     def node_name(state: GraphState) -> dict:
         # Read from state -> invoke LLM -> return state updates
     ```

4. **Multi-Agent Reviewer Loop & Conditional Routing (`app/router.py`)**:
   - A Critic Agent (`reviewer_node.py`) checks if `estimated_mins` for all daily tasks fit within the user's `daily_hours` budget.
   - If verification fails and retries < 2, conditional edge routes execution back to `decomposer_node` for self-correction.
   - Circuit breaker (`retry_count >= 2`) caps iterations to protect API budgets.

5. **FastAPI & Redis Integration**:
   - Exposes REST endpoints on Port `5001`.
   - Interacts with Redis broker (`redis-broker:6379`) to check query hashes before executing the LangGraph pipeline, returning cached responses in **15ms**.



# 🏗️ Architecture & Implementation Guidelines for the New Roadmap

## Instructions for the AI Coding Assistant

Use the following **LangGraph project architecture as a reference blueprint, not a fixed implementation template**, while planning and building this project.

The goal is to maintain a **modular, readable, maintainable, and extensible codebase** that follows a similar structure to the reference project, making it easy to understand the workflow, debug individual components, and extend functionality as the project grows.

### Guidelines to Follow

1. **Follow a Similar Project Structure:** Prefer separating core files such as `app.py`, `graph.py`, `state.py`, `llm.py`, and `router.py`, along with dedicated `nodes/`, `tools/`, and `prompts/` directories wherever they make sense for this project's requirements.

2. **Adapt the Architecture to Project Needs:** Do not blindly copy the reference structure, files, nodes, or workflow. Analyze the actual requirements first, then decide which components are necessary, which should be modified, and which new components need to be introduced.

3. **Use LangGraph for Workflow Orchestration:** Define clear processing steps as nodes, manage shared data through an appropriately designed state, and use conditional routing, parallel execution, or branching only when the workflow genuinely requires them.

4. **Keep Responsibilities Separate:** Each node, tool, prompt, and core module should have a clear purpose. Avoid mixing business logic, LLM configuration, workflow orchestration, and user interaction in a single file.

5. **Maintain Consistent Coding Patterns:** Use typed state definitions, structured Pydantic outputs where appropriate, reusable tool interfaces, centralized configuration, and meaningful error handling. Apply patterns such as registries or singletons only when they provide a genuine benefit.

6. **Explain the Workflow Through Code:** Keep file names descriptive, functions focused, and code easy to follow. Use concise comments and logging to explain important decisions, data flow, and execution order without overcomplicating the implementation.

7. **Keep the Architecture Easy to Learn:** Introduce components incrementally, following a logical implementation order. Before implementing a new component, explain its responsibility, why it is needed, and how it connects to the existing workflow.

8. **Avoid Unnecessary Complexity:** Do not introduce extra nodes, tools, abstractions, agents, memory systems, or dependencies merely because they exist in the reference architecture. Prefer the simplest design that correctly satisfies the requirements.

9. **Design for Future Extension:** Make it straightforward to add new processing steps, tools, prompt templates, and routing rules without requiring major changes to unrelated modules.

10. **Validate Each Stage:** Test important tools and nodes independently, validate state transitions and routing, and verify the complete workflow using realistic project-specific examples.

### Expected Output for Each Roadmap Stage

For every implementation stage, provide:

- **Objective:** What we are building and why.
- **Architecture:** The relevant files, components, and workflow connections.
- **Implementation:** Complete, file-by-file code snippets with the correct file paths.
- **Explanation:** A concise explanation of each component and how data flows through it.
- **Validation:** Commands or test cases to verify that the implementation works.
- **Next Step:** What should be implemented next and how it builds on the current stage.

**Important:** Treat the reference architecture below as a guide for structure, readability, and implementation style—not as a specification that must be reproduced exactly. The final architecture must be driven by the actual project requirements while preserving the same modular and developer-friendly approach wherever practical.



├── app.py                 # Entry point
├── graph.py               # Workflow definition
├── state.py               # State management
├── llm.py                 # LLM configuration
├── router.py              # Routing logic
├── nodes/                 # Processing nodes
│   ├── requirement_analyzer.py
│   ├── project_context.py
│   ├── file_reader.py
│   ├── dependency_analyzer.py
│   ├── merge_context.py
│   ├── prompt_generator.py
│   ├── ai_assistant.py
│   └── tool_executor.py
├── tools/                 # Tool implementations
│   ├── project_context_tool.py
│   ├── file_reader_tool.py
│   ├── dependency_analyzer_tool.py
│   └── tool_registry.py
└── prompts/               # Prompt templates
    ├── analyzer_prompt.py
    └── generator_prompt.py

## Core Components

### 1. State Management (state.py)

The `GraphState` TypedDict serves as shared memory between all nodes:

```python
class GraphState(TypedDict):
    user_query: str
    requirement_analysis: RequirementAnalysis
    execution_plan: list[str]
    tool_result: Optional[str]
    project_context: Optional[str]
    dependency_report: Optional[str]
    merged_context: Optional[str]
    file_content: Optional[str]
    generated_prompt: str
    prompt_template: Any
    retrieved_documents: Optional[str]
    memory: Optional[str]
    response: any

Key features:
- TypedDict ensures type safety across nodes
- Pydantic models (RequirementAnalysis) for structured LLM output
- All workflow data flows through this shared state

2. Graph Construction (graph.py)

Builds the LangGraph workflow:

# Create Graph
builder = StateGraph(GraphState)

# Register Nodes
builder.add_node("requirement_analyzer", requirement_analyzer)
builder.add_node("project_context", project_context)
builder.add_node("file_reader", file_reader)
builder.add_node("prompt_generator", prompt_generator)
builder.add_node("ai_assistant", ai_assistant)
builder.add_node("merge_context", merge_context)
builder.add_node("dependency_analyzer", dependency_analyzer)

# Add Start Edge
builder.add_edge(START, "requirement_analyzer")

# Add Conditional Routing
builder.add_conditional_edges(
    "requirement_analyzer",
    route_task,
    {
        "prompt_generator": "prompt_generator",
        "project_context": "project_context",
        "file_reader": "file_reader"
    }
)

# Connect Remaining Nodes
builder.add_edge("project_context", "file_reader")
builder.add_edge("project_context", "dependency_analyzer")
builder.add_edge("file_reader", "merge_context")
builder.add_edge("dependency_analyzer", "merge_context")
builder.add_edge("merge_context", "prompt_generator")
builder.add_edge("prompt_generator", "ai_assistant")
builder.add_edge("ai_assistant", END)

graph = builder.compile()

3. Node Architecture Pattern

Each node in /nodes/ follows this pattern:

def node_name(state: GraphState):
    print("=" * 70)
    print("NODE NAME")
    print("=" * 70)

    try:
        # Access state
        # Perform node-specific logic
        # Update state
        return {
            "state_field": value
        }
    except Exception as ex:
        print(f"Error: {ex}")
        return {
            "state_field": None,
            "error": str(ex)
        }

Specialized Nodes:

Requirement Analyzer (requirement_analyzer.py):
- Classifies user requests using structured LLM output
- Creates execution plan based on analysis
- Uses Pydantic model for reliable parsing

Tool Executor Nodes (e.g., project_context.py, file_reader.py):
- Retrieve tools from ToolRegistry
- Execute tool's execute() method
- Store results in GraphState

Merge Context Node (merge_context.py):
- Combines results from parallel nodes
- Creates unified context for downstream processing

Prompt Generator Node (prompt_generator.py):
- Selects appropriate prompt template based on task type
- Invokes LLM to generate optimized prompt

AI Assistant Node (ai_assistant.py):
- Receives optimized prompt from prompt generator
- Invokes LLM for final response
- Returns response in GraphState

4. Tool System (tools/)

Tools are implemented as classes with standardized interfaces:

class ProjectContextTool:
    def execute(self, root_path: str) -> str:
        # Tool-specific logic
        return result

Tool Registry (tool_registry.py):
- Singleton pattern for efficient tool management
- Centralized tool instantiation and retrieval
- Prevents recreating tools on every invocation

class ToolRegistry:
    def __init__(self):
        self.tools = {
            "project_context": ProjectContextTool(),
            "file_reader": FileReaderTool(),
            "dependency_analyzer": DependencyAnalyzerTool()
        }

    def get_tool(self, tool_name: str):
        return self.tools.get(tool_name)

5. Prompt System (prompts/)

Prompt templates are separated from node logic:

def get_explanation_prompt():
    return ChatPromptTemplate.from_messages([
        ("system", "You are an expert AI Coding Assistant..."),
        ("human", "{analysis}\n{user_query}")
    ])

PROMPT_REGISTRY = {
    "project_creation": get_project_prompt,
    "explanation": get_explanation_prompt
}

Nodes use prompts like:
prompt_template = PROMPT_REGISTRY[task_type]()
prompt = prompt_template.invoke({...})
response = invoke_llm(prompt)

6. LLM Configuration (llm.py)

Centralized LLM setup:

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0)

def invoke_structured_llm(prompt, schema):
    structured_llm = llm.with_structured_output(schema)
    return structured_llm.invoke(prompt)

7. Routing Logic (router.py)

Dynamic workflow selection based on state:

def route_task(state):
    execution_plan = state.get("execution_plan", [])
    if not execution_plan:
        return "prompt_generator"
    return execution_plan[0]  # Return first tool in plan

8. Entry Point (app.py)

Simple CLI interface:

user_query = input("Enter your query : ")
result = graph.invoke({"user_query": user_query})
print(result["response"].content[0]["text"])

Key Architectural Patterns

1. Separation of Concerns

- State: Data management (state.py)
- Workflow: Graph construction (graph.py)
- Processing: Individual nodes (nodes/)
- Tools: Business logic (tools/)
- Prompts: Template management (prompts/)
- LLM: Model configuration (llm.py)
- Routing: Conditional logic (router.py)
- Entry: User interaction (app.py)

2. LangGraph Best Practices

- State Typing: Strong typing prevents data inconsistencies
- Modular Nodes: Single responsibility principle
- Conditional Edges: Dynamic workflow based on state
- Shared Memory Pattern: All nodes read/write to same state
- Error Handling: Graceful degradation with try/catch
- Logging: Debugging information at each step

3. Extensibility Points

- Add New Nodes: Register in graph.py, implement in nodes/
- Add New Tools: Implement class, register in ToolRegistry
- Add New Prompts: Create function, add to PROMPT_REGISTRY
- Modify Routing: Update router.py logic
- Change LLM: Modify llm.py configuration

Implementation Recommendations for Roadmap 1

1. State Design

- Define all data that needs to flow between nodes
- Use TypedDict for state definition
- Use Pydantic models for structured outputs
- Include fields for: inputs, intermediate results, final outputs

2. Node Implementation

- Create one node per distinct processing step
- Each node should: read state, process, write state
- Handle errors gracefully
- Include descriptive logging
- Follow the pattern: try/except with state updates

3. Tool Abstraction

- Implement tools as classes with execute() method
- Use a central registry for tool management
- Follow singleton pattern to avoid recreation
- Keep tools focused on single responsibilities

4. Prompt Management

- Separate prompt templates from node logic
- Use registry pattern for prompt selection
- Leverage LangChain's ChatPromptTemplate
- Make prompts configurable and testable

5. Workflow Construction

- Use StateGraph with your defined state
- Register all nodes explicitly
- Define clear entry and exit points
- Use conditional edges for dynamic routing
- Connect nodes logically based on data dependencies

6. Error Handling

- Wrap node logic in try/except blocks
- Return error state when appropriate
- Log meaningful error messages
- Consider retry mechanisms for transient failures

7. Testing Approach

- Test individual nodes with mock state
- Test tools in isolation
- Test prompt generation separately
- Test end-to-end workflow with sample inputs
- Use LangGraph's testing utilities

### File-by-File Summary for PathPilot AI LangGraph Architecture

#### Core Files:
1. `app/state.py` - Defines `GraphState` TypedDict and state invariants
2. `app/graph.py` - Builds, connects edges, and compiles the `StateGraph` workflow
3. `app/llm.py` - Centralized Google Gemini LLM setup & `invoke_structured_llm`
4. `app/router.py` - Implements conditional routing logic (`route_after_review`)
5. `main.py` - FastAPI server entry point (Port 5001)

#### Nodes Directory (`app/nodes/`):
1. `architect_node.py` - Formulates milestone blueprints & roadmap summary
2. `decomposer_node.py` - Slices milestones into 15-30 min atomic daily tasks
3. `curator_node.py` - Attaches verified documentation links to tasks
4. `reviewer_node.py` - Critic node evaluating task durations against `daily_hours` budget

#### Prompts Directory (`app/prompts/`):
1. `architect_prompt.py` - Curriculum design prompt template
2. `decomposer_prompt.py` - Atomic task decomposition prompt template
3. `curator_prompt.py` - Technical documentation reference prompt template
4. `reviewer_prompt.py` - Critic bandwidth audit prompt template

This structure provides a production-grade foundation for building agentic workflows with LangGraph that is maintainable, extensible, and follows established enterprise patterns.
```

✻ Brewed for 20s · done 4:41 PM

──────────────────────────────────── langgraph-code-structure ─
❯
───────────────────────────────────────




## 13. Notion-Based Visual Documentation: Use the Connected Notion MCP to Maintain Diagrams, Workflows, and Project Documentation

## 13. Visual-First Documentation: Prefer Diagrams Over Long Text

**Make the documentation visual-first, not text-heavy.** My goal is to understand, visualize, and remember the project quickly before interviews.

Whenever a concept can be explained more clearly through a diagram, flowchart, architecture map, sequence diagram, or visual comparison, prefer that over lengthy paragraphs.

### Visual Documentation Rules

1. **Architecture diagrams:** Show how the frontend, backend, database, LLM, external services, and other components interact.

2. **Workflow diagrams:** Visualize the complete request lifecycle, including LangGraph nodes, conditional routing, parallel execution, state updates, and termination.

3. **Sequence diagrams:** Show the order of interactions between the user, API, backend services, database, and LLM.

4. **State diagrams:** Explain how shared state changes as the request moves through different nodes.

5. **Folder structure diagrams:** Show the project directory tree and briefly explain the responsibility of important files and folders.

6. **Database diagrams:** Use ER diagrams or schema relationship diagrams wherever database relationships matter.

7. **Decision diagrams:** Use decision trees and comparison tables to explain routing logic, technology choices, alternatives, and trade-offs.

8. **Error-flow diagrams:** Visualize important failure scenarios, retries, fallback behavior, and error propagation.

9. **Visual code explanations:** For complicated code, show a small code snippet alongside a flow diagram explaining how it works.

10. **Interview memory aids:** Create compact visual summaries, flowcharts, and comparison diagrams for concepts that are likely to be asked in interviews.

### Preferred Documentation Format

For each major concept, follow this order:

**Diagram → Short Explanation → Relevant Code → Interview Questions**

- Start with a diagram whenever it meaningfully improves understanding.
- Explain the diagram in a few concise bullet points.
- Include only the code needed to understand the implementation.
- Finish with likely interview questions and short answers.

Use Mermaid diagrams when supported by the documentation platform. Otherwise, use another readable diagram format.

Avoid creating diagrams merely for decoration. Every diagram should accurately reflect the actual implementation, use clear labels, and make a technical concept easier to understand.

**Priority:** Prefer one clear, accurate diagram with a short explanation over several paragraphs explaining the same thing. Use text when it is more appropriate, and never sacrifice technical accuracy for visual simplicity.

## 14. Standard Project Documentation Structure

Organize the Notion handbook using the following hierarchy. Adapt the contents to the actual project rather than forcing every section into the documentation.

- **01 — Project at a Glance**
  - Project pitch and problem statement
  - Features, users, tech stack, and personal contribution
  - Current implementation status

- **02 — Architecture & Data Flow**
  - High-level system architecture diagram
  - End-to-end request lifecycle diagram
  - API interactions and data flow
  - External service integrations

- **03 — AI & LangGraph Deep Dive**
  - LangGraph workflow diagram
  - State schema and state-transition diagram
  - Node-by-node responsibilities
  - Routing, tools, prompts, and structured outputs
  - LLM limitations and failure handling

- **04 — Database & Backend**
  - Database schema or ER diagram
  - API contracts and validation
  - Backend processing flow
  - Caching, authentication, and other implemented features

- **05 — Codebase & Folder Structure**
  - Complete current project directory tree
  - Purpose of each important file and folder
  - Relationships and dependencies between modules
  - Entry points and execution flow
  - Important code snippets and file references

- **06 — Engineering Decisions & Trade-offs**
  - Architecture decision records
  - Technology comparisons
  - Design patterns and reasons for using them
  - Trade-offs and alternative approaches

- **07 — Bugs, Debugging & Lessons Learned**
  - Actual bugs and root-cause analysis
  - Debugging steps and fixes
  - Error-flow diagrams
  - Lessons and preventive measures

- **08 — Interview Questions & Answers**
  - Fundamental, implementation, architecture, and advanced questions
  - Project-specific follow-up questions
  - Diagram-based explanations
  - Questions I need to practice

- **09 — Rapid Revision Sheet**
  - One-page project summary
  - Most important diagrams
  - Key technical decisions and debugging stories
  - Common interview questions

- **10 — Final Interview Readiness Checklist**
  - Concepts I can explain confidently
  - Features I can demonstrate
  - Topics that need revision
  - Final 30–45-minute revision sequence

### Folder Structure Documentation Requirements

Always document the **actual current folder structure from the repository** rather than inventing one.

For each important file, include:

| Item | What to document |
|---|---|
| File or folder | Exact path in the repository |
| Responsibility | What it does |
| Inputs | Data or dependencies it receives |
| Outputs | What it returns or changes |
| Connections | Which modules call it or depend on it |
| Interview relevance | Why understanding it matters |

Keep the directory tree compact and add separate diagrams for complex relationships between modules.

Do not assume every project needs the same files. For example, include `graph.py`, `state.py`, `router.py`, `nodes/`, `tools/`, and `prompts/` when they match the actual LangGraph implementation. Add, remove, or rename components according to the project's real architecture.

**Final objective:** Make Notion a visual, accurate, easy-to-navigate representation of the actual codebase, so I can revise the architecture and implementation quickly and explain them confidently during interviews.