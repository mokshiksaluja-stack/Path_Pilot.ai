const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PathPilot database...');

  // Clean up existing data
  await prisma.notificationLog.deleteMany({});
  await prisma.userProgress.deleteMany({});
  await prisma.dailyTask.deleteMany({});
  await prisma.milestone.deleteMany({});
  await prisma.roadmap.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Demo User
  const demoUser = await prisma.user.create({
    data: {
      email: 'alex@pathpilot.ai',
      passwordHash: '$2b$10$epRkM7qP7H.jW8rK03hQOODiZpQ5gAoxX7M8hE9b3rE5O2Z5s4J9q', // hashed 'password123'
      name: 'Alex Developer',
      currentStreak: 5,
      longestStreak: 12,
      lastActiveAt: new Date(),
    },
  });

  console.log(`👤 Created Demo User: ${demoUser.name} (${demoUser.email})`);

  // 2. Create Goal
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 30);

  const goal = await prisma.goal.create({
    data: {
      userId: demoUser.id,
      title: 'Master Full-Stack TypeScript & React in 30 Days',
      description: 'Zero to production-ready full-stack developer with React, Node, and Postgres',
      targetDate: targetDate,
      dailyHours: 2.5,
      status: 'IN_PROGRESS',
    },
  });

  // 3. Create Roadmap
  const roadmap = await prisma.roadmap.create({
    data: {
      goalId: goal.id,
      summary: 'Comprehensive 4-week structured full-stack mastery plan with daily 30-min actionable tasks.',
      totalDays: 30,
    },
  });

  // 4. Create Milestones & Daily Tasks
  const milestone1 = await prisma.milestone.create({
    data: {
      roadmapId: roadmap.id,
      title: 'Week 1: TypeScript Fundamentals & Modern React',
      orderIndex: 1,
      dailyTasks: {
        create: [
          {
            dayNumber: 1,
            title: 'TypeScript Generics & Utility Types',
            description: 'Learn and implement Partial, Pick, Omit, and custom generic constraints.',
            resourceUrl: 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
            estimatedMins: 30,
            difficulty: 'MEDIUM',
            isCompleted: true,
            completedAt: new Date(Date.now() - 4 * 86400000),
          },
          {
            dayNumber: 2,
            title: 'React Custom Hooks & Component Composition',
            description: 'Build useDebounce and useLocalStorage hooks with strict TypeScript typing.',
            resourceUrl: 'https://react.dev/learn/reusing-logic-with-custom-hooks',
            estimatedMins: 30,
            difficulty: 'MEDIUM',
            isCompleted: true,
            completedAt: new Date(Date.now() - 3 * 86400000),
          },
          {
            dayNumber: 3,
            title: 'State Management with Zustand',
            description: 'Setup global state, selectors, and persistent middleware.',
            resourceUrl: 'https://docs.pmnd.rs/zustand/getting-started/introduction',
            estimatedMins: 30,
            difficulty: 'EASY',
            isCompleted: true,
            completedAt: new Date(Date.now() - 2 * 86400000),
          },
          {
            dayNumber: 4,
            title: 'React Hook Form & Zod Schema Validation',
            description: 'Create type-safe form validation with async submission error handling.',
            resourceUrl: 'https://react-hook-form.com/get-started',
            estimatedMins: 30,
            difficulty: 'MEDIUM',
            isCompleted: true,
            completedAt: new Date(Date.now() - 1 * 86400000),
          },
          {
            dayNumber: 5,
            title: 'TanStack Query (React Query) for Server State',
            description: 'Implement optimistic updates, query invalidation, and automated retry logic.',
            resourceUrl: 'https://tanstack.com/query/latest/docs/framework/react/overview',
            estimatedMins: 35,
            difficulty: 'HARD',
            isCompleted: true,
            completedAt: new Date(),
          },
          {
            dayNumber: 6,
            title: 'Tailwind CSS & Component Architecture',
            description: 'Design accessible, responsive UI primitives using CVA (Class Variance Authority).',
            resourceUrl: 'https://tailwindcss.com/docs/utility-first',
            estimatedMins: 25,
            difficulty: 'EASY',
            isCompleted: false,
          },
          {
            dayNumber: 7,
            title: 'Week 1 Mini-Project: Interactive Dashboard',
            description: 'Combine React Query, Zustand, and Tailwind into a live metrics dashboard.',
            resourceUrl: 'https://github.com/topics/react-dashboard',
            estimatedMins: 45,
            difficulty: 'HARD',
            isCompleted: false,
          },
        ],
      },
    },
  });

  const milestone2 = await prisma.milestone.create({
    data: {
      roadmapId: roadmap.id,
      title: 'Week 2: Backend Architecture, Express & Prisma ORM',
      orderIndex: 2,
      dailyTasks: {
        create: [
          {
            dayNumber: 8,
            title: 'Express REST API Setup with Clean Architecture',
            description: 'Structure controllers, services, repositories, and centralized error handling.',
            resourceUrl: 'https://expressjs.com/en/guide/routing.html',
            estimatedMins: 30,
            difficulty: 'MEDIUM',
            isCompleted: false,
          },
          {
            dayNumber: 9,
            title: 'PostgreSQL & Prisma Schema Design',
            description: 'Define relational models, indexes, and cascading relationships.',
            resourceUrl: 'https://www.prisma.io/docs/concepts/components/prisma-schema',
            estimatedMins: 35,
            difficulty: 'MEDIUM',
            isCompleted: false,
          },
        ],
      },
    },
  });

  console.log(`✅ Database Seeded Successfully!`);
  console.log(`   - 1 User`);
  console.log(`   - 1 Goal ("${goal.title}")`);
  console.log(`   - 1 Roadmap with 2 Milestones and 9 Tasks`);
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
