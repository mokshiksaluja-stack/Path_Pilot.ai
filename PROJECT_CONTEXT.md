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

Built with Node.js & LangChain.
Isolated AI microservice running Gemini API prompt pipelines (gemini-2.5-flash).
Parses structured output JSON via Zod / StructuredOutputParser.
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
AI Workflows	LangChain + Gemini API	@langchain/google-genai, zod	Structured JSON output parsing & agent orchestration.
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
├── ai-orchestrator-service/  # LangChain + Gemini AI Microservice (Port 5001)
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
