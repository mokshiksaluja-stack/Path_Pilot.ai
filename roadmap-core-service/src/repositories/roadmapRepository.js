const prisma = require('../config/prisma');

/**
 * Repository Layer (Data Access Layer - DAL)
 * Directly handles all Prisma queries and database transactions.
 */

// 1. Create Goal, Roadmap, Milestones, and DailyTasks in an Atomic Transaction
exports.createGoalWithRoadmap = async (goalData, roadmapData) => {
  return await prisma.$transaction(async (tx) => {
    // 1.1 Insert Goal
    const goal = await tx.goal.create({
      data: goalData,
    });

    // 1.2 Insert Roadmap linked to Goal
    const roadmap = await tx.roadmap.create({
      data: {
        goalId: goal.id,
        summary: roadmapData.summary || `Personalized learning path for ${goalData.title}`,
        totalDays: roadmapData.totalDays,
      },
    });

    // 1.3 Insert Milestones and their Daily Tasks
    if (Array.isArray(roadmapData.milestones)) {
      for (let i = 0; i < roadmapData.milestones.length; i++) {
        const ms = roadmapData.milestones[i];
        const milestone = await tx.milestone.create({
          data: {
            roadmapId: roadmap.id,
            title: ms.title,
            orderIndex: i + 1,
          },
        });

        if (Array.isArray(ms.tasks)) {
          for (const task of ms.tasks) {
            await tx.dailyTask.create({
              data: {
                milestoneId: milestone.id,
                dayNumber: task.dayNumber || 1,
                title: task.title,
                description: task.description || '',
                resourceUrl: task.resourceUrl || null,
                estimatedMins: task.estimatedMins || 30,
                difficulty: task.difficulty || 'MEDIUM',
                isCompleted: false,
              },
            });
          }
        }
      }
    }

    return goal;
  });
};

// 2. Find Goal by ID with full nested relational tree
exports.findGoalById = async (goalId) => {
  return await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      roadmap: {
        include: {
          milestones: {
            orderBy: { orderIndex: 'asc' },
            include: {
              dailyTasks: {
                orderBy: { dayNumber: 'asc' },
                include: {
                  progressLogs: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

// 3. Find all Goals for a specific User
exports.findGoalsByUserId = async (userId) => {
  return await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      roadmap: {
        include: {
          milestones: {
            orderBy: { orderIndex: 'asc' },
            include: {
              dailyTasks: {
                orderBy: { dayNumber: 'asc' },
              },
            },
          },
        },
      },
    },
  });
};

// 4. Find Task by ID with parent User relation (for streak math)
exports.findTaskWithDetails = async (taskId) => {
  return await prisma.dailyTask.findUnique({
    where: { id: taskId },
    include: {
      milestone: {
        include: {
          roadmap: {
            include: {
              goal: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

// 5. Complete Task, Create Progress Log, and Update User Streak (Atomic Transaction)
exports.completeTaskWithStreak = async (taskId, userId, feedback, streakUpdates) => {
  return await prisma.$transaction(async (tx) => {
    // 5.1 Update task status
    const updatedTask = await tx.dailyTask.update({
      where: { id: taskId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    // 5.2 Log User Progress
    const progressLog = await tx.userProgress.create({
      data: {
        taskId,
        userFeedback: feedback || null,
      },
    });

    // 5.3 Update User Streak Metrics
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        currentStreak: streakUpdates.newStreak,
        longestStreak: streakUpdates.newLongestStreak,
        lastActiveAt: streakUpdates.now,
      },
    });

    return {
      task: updatedTask,
      progressLog,
      user: {
        id: updatedUser.id,
        currentStreak: updatedUser.currentStreak,
        longestStreak: updatedUser.longestStreak,
      },
      streakUpdated: streakUpdates.streakUpdated,
    };
  });
};
