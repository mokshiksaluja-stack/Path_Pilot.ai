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
    Client[React 18 + Vite SPA (:3000)] <-->|HTTP / REST| Gateway[Microservice 1: API Gateway (Node.js/Express :5000)]
    
    Gateway <-->|JWT Auth & Token Bucket Rate Limit| RedisBroker[(Redis 7 Broker & Cache :6379)]
    
    Gateway <-->|Internal REST API :5002| CoreService[Microservice 2: Roadmap Core Service (Node.js/Express :5002)]
    CoreService <-->|Prisma ORM| PostgresDB[(PostgreSQL 16 Database :5432)]
    
    Gateway <-->|Internal REST API :5001| AIService[Microservice 3: AI Orchestrator Service (Node/Python :5001)]
    AIService <-->|LLM API Calls| GeminiAPI[Google Gemini 2.5 Flash API]
    AIService <-->|Cache Hashed Roadmaps| RedisBroker
    
    Gateway -->|Publish Job Payload| RedisBroker
    RedisBroker <-->|Consume BullMQ Jobs| WorkerService[Microservice 4: Notification Worker Service]
    WorkerService -->|Deliver Email / Push| ExternalNudge[Nodemailer / WhatsApp Gateway]
```

### Microservices Responsibilities

1. **`client-frontend` (Port 3000)**:
   - React 18 + Vite SPA + Tailwind CSS + Lucide Icons + React Flow.
   - Renders interactive visual node trees for roadmaps, daily task checklists, streak counters, and adaptive schedule shift triggers.

2. **`api-gateway` (Port 5000)**:
   - Built with Node.js & Express.
   - Single reverse proxy entry point. Handles JWT authentication, request validation, CORS policy, and Redis-based token-bucket rate limiting (max 10 req/min per user).

3. **`ai-orchestrator-service` (Port 5001)**:
   - Built with Node.js/Python & LangChain.
   - Isolated AI microservice running Gemini API prompt pipelines (`gemini-2.5-flash`).
   - Parses structured output JSON via `Zod` / `StructuredOutputParser`.
   - Checks & writes hashed roadmap outputs to Redis Cache (7-day TTL).

4. **`roadmap-core-service` (Port 5002)**:
   - Built with Node.js, Express, and Prisma ORM.
   - Manages relational persistent storage in PostgreSQL 16 (Users, Goals, Milestones, Daily Tasks, User Progress, Streaks).

5. **`notification-worker-service` (Background Worker)**:
   - Event-driven background process connected to **Redis (BullMQ)**.
   - Consumes scheduled reminder jobs (`daily_reminder_queue`) asynchronously without blocking HTTP request threads.

6. **Infrastructure Tier (Docker Compose)**:
   - `postgres-db`: PostgreSQL 16 Alpine container (Port 5432).
   - `redis-broker`: Redis 7 Alpine container (Port 6379).

---

## 📐 3. Low-Level Design (LLD)

### 3.1 Database Schema (Prisma ORM / PostgreSQL)

```prisma
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
```

---

### 3.2 Redis Key Schema & Queue Design

| Key / Queue Name | Type | TTL / Retention | Function |
| :--- | :--- | :--- | :--- |
| `roadmap:cache:<hash>` | `String (JSON)` | 7 Days (604,800s) | Caches AI-generated roadmaps for duplicate prompt queries. |
| `user:streak:<user_id>` | `String (Int)` | No Expiry | Fast lookup for active streak counters. |
| `ratelimit:<user_id>` | `String (Int)` | 60 Seconds | Tracks requests per minute (max 10 req/min). |
| `daily_reminder_queue` | `BullMQ Queue` | Persistent | Holds scheduled notification payloads for background worker. |

---

### 3.3 API Contracts

#### 1. Generate Goal Roadmap
- **Endpoint**: `POST /api/v1/goals/generate`
- **Headers**: `Authorization: Bearer <JWT>`
- **Request Body**:
  ```json
  {
    "title": "Master React and Node.js",
    "targetDays": 30,
    "dailyHours": 2,
    "skillLevel": "Beginner"
  }
  ```
- **Response (201 Created)**:
  ```json
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
  ```

#### 2. Complete Daily Task
- **Endpoint**: `POST /api/v1/tasks/:taskId/complete`
- **Request Body**: `{ "feedback": "EASY" }`
- **Response (200 OK)**: `{ "success": true, "currentStreak": 6, "streakUpdated": true }`

#### 3. Adaptive Schedule Shift
- **Endpoint**: `POST /api/v1/goals/:goalId/re-adapt`
- **Request Body**: `{ "reason": "Fell behind 3 days due to midterms" }`
- **Response (200 OK)**: Recalculated remaining uncompleted tasks with new dates.

---

### 3.4 AI Agent Graph & Prompting Pipeline

```
  [User Goal Input]
         │
         ▼
 ┌──────────────────────┐
 │ Goal Decomposer Node │ ──► (Deconstructs into 4-week Milestones)
 └──────────────────────┘
         │
         ▼
 ┌──────────────────────┐
 │ Resource Scraper Node│ ──► (Attaches verified GitHub/Docs/YouTube links)
 └──────────────────────┘
         │
         ▼
 ┌──────────────────────┐
 │ Micro-Task Formatter │ ──► (Formats into Day 1...N 15-30 min micro-tasks)
 └──────────────────────┘
         │
         ▼
 [Cache in Redis & Save to Postgres DB]
```

---

## 🛠️ 4. Tech Stack & Package Matrix

| Component | Framework / Library | Exact Package | Why Selected |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | `react`, `vite`, `tailwindcss` | Ultra-fast build tool & component ecosystem. |
| **Visual Node Graph** | React Flow | `@xyflow/react` | Displays interactive node-based roadmap paths. |
| **API Gateway** | Node.js + Express | `express`, `jsonwebtoken`, `helmet` | Single entry reverse proxy, CORS, JWT auth. |
| **Database & ORM** | PostgreSQL 16 + Prisma | `@prisma/client`, `prisma` | Type-safe auto-generated database client. |
| **Caching & Queues** | Redis 7 + BullMQ | `ioredis`, `bullmq` | Non-blocking async queue & lightning-fast caching. |
| **AI Workflows** | LangChain + Gemini API | `@langchain/google-genai`, `zod` | Structured JSON output parsing & agent orchestration. |
| **Containerization** | Docker & Compose | `docker-compose.yml` | Multi-container environment isolation. |

---

## 📂 5. Workspace Directory Structure

```
pathpilot-ai/
├── README.md                 # Brief project summary & container quickstart
├── PROJECT_CONTEXT.md        # THIS FILE — 100% complete master context document
├── docker-compose.yml        # PostgreSQL (5432) & Redis (6379) infrastructure
├── client/                   # React + Vite Frontend SPA (Port 3000)
├── api-gateway/              # Express API Gateway Microservice (Port 5000)
├── roadmap-core-service/     # Prisma + Express PostgreSQL CRUD Microservice (Port 5002)
├── ai-orchestrator-service/  # LangChain + Gemini AI Microservice (Port 5001)
└── notification-worker/      # BullMQ Redis Background Worker Microservice
```

---

## 🚦 6. Implementation Progress & Step Log

- **Step 1 [COMPLETED]**: Infrastructure container orchestration file `docker-compose.yml` spinning up PostgreSQL 16 (`pathpilot-postgres`:5432) and Redis 7 (`pathpilot-redis`:6379) on an isolated bridge network (`pathpilot-network`).
- **Step 2 [PENDING]**: Create `roadmap-core-service` database package setup & Prisma schema (`prisma/schema.prisma`).
- **Step 3 [PENDING]**: Database seed script & core service Express initialization.
- **Step 4 [PENDING]**: `ai-orchestrator-service` implementation (LangChain prompt chain & Gemini API connector).
- **Step 5 [PENDING]**: Redis caching layer for AI outputs.
- **Step 6 [PENDING]**: `api-gateway` setup (JWT middleware & Redis rate limiting).
- **Step 7 [PENDING]**: `notification-worker` setup (BullMQ queue producer & consumer).
- **Step 8 [PENDING]**: React frontend setup & API integration.
