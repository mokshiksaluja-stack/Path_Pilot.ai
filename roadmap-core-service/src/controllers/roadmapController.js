const prisma = require('../prisma');

/**
 * Feature 1: Create Goal with Roadmap Tree (Atomic Transaction)
 * POST /api/v1/core/goals
 */
exports.createGoalWithRoadmap = async (req, res) => {
  try {
    const { userId, title, description, targetDays, dailyHours, roadmapData } = req.body;

    // 1. Validation Layer
    if (!userId || !title || !roadmapData || !roadmapData.milestones) {
      return res.status(400).json({
        error: 'Validation failed: userId, title, and roadmapData with milestones are required.',
      });
    }

    const totalDays = targetDays || roadmapData.totalDays || 30;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + totalDays);

    // 2. Atomic Transaction Execution
    const createdGoal = await prisma.$transaction(async (tx) => {
      // 2.1 Insert Goal
      const goal = await tx.goal.create({
        data: {
          userId,
          title,
          description: description || null,
          targetDate,
          dailyHours: parseFloat(dailyHours) || 2.0,
          status: 'IN_PROGRESS',
        },
      });

      // 2.2 Insert Roadmap linked to Goal
      const roadmap = await tx.roadmap.create({
        data: {
          goalId: goal.id,
          summary: roadmapData.summary || `Personalized learning path for ${title}`,
          totalDays,
        },
      });

      // 2.3 Insert Milestones and Daily Tasks
      // We iterate through each milestone array inside roadmapData. We insert the milestone (storing roadmapId), and then iterate through its nested tasks to insert every daily task linked to that milestone (milestoneId).
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

      return goal;
    });

    // 3. Hydrate and return full relational tree
    // Prisma's include feature is like a power-charged JOIN query. It grabs the Goal, attaches its Roadmap, embeds all ordered Milestones, and nests all ordered Daily Tasks underneath them in a single, perfectly structured JSON tree!
    const fullGoal = await prisma.goal.findUnique({
      where: { id: createdGoal.id },
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

    return res.status(201).json({
      success: true,
      data: fullGoal,
    });
  } catch (error) {
    console.error('[createGoalWithRoadmap Error]:', error);
    return res.status(500).json({ error: 'Internal database error while saving roadmap.' });
  }
};

/**
 * Feature 2A: Get Goal by ID with full nested roadmap tree
 * GET /api/v1/core/goals/:goalId
 */
exports.getGoalById = async (req, res) => {

  try {
    const { goalId } = req.params;

    const goal = await prisma.goal.findUnique({
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

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    return res.status(200).json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('[getGoalById Error]:', error);
    return res.status(500).json({ error: 'Internal database error while retrieving goal.' });
  }
};

/**
 * Feature 2B: Get all Goals for a specific user
 * GET /api/v1/core/users/:userId/goals
 */
exports.getUserGoals = async (req, res) => {
  try {
    const { userId } = req.params;

    const goals = await prisma.goal.findMany({
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

    return res.status(200).json({
      success: true,
      count: goals.length,
      data: goals,
    });
  } catch (error) {
    console.error('[getUserGoals Error]:', error);
    return res.status(500).json({ error: 'Internal database error while retrieving user goals.' });
  }
};
