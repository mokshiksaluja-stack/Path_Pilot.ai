const prisma = require('../prisma');

/**
 * Creates a new Goal along with its Roadmap, Milestones, and Daily Tasks transactionally.
 */
exports.createGoalWithRoadmap = async (req, res) => {
  try {
    const { userId, title, description, targetDays, dailyHours, roadmapData } = req.body;

    if (!userId || !title || !roadmapData || !roadmapData.milestones) {
      return res.status(400).json({
        error: 'Validation failed: userId, title, and roadmapData are required.',
      });
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (targetDays || roadmapData.totalDays || 30));

    // Execute atomic creation across relational graph
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Goal
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

      // 2. Create Roadmap
      const roadmap = await tx.roadmap.create({
        data: {
          goalId: goal.id,
          summary: roadmapData.summary || `Personalized learning path for ${title}`,
          totalDays: roadmapData.totalDays || targetDays || 30,
        },
      });

      // 3. Create Milestones and Daily Tasks
      for (let i = 0; i < roadmapData.milestones.length; i++) {
        const ms = roadmapData.milestones[i];
        const milestone = await tx.milestone.create({
          data: {
            roadmapId: roadmap.id,
            title: ms.title,
            orderIndex: i + 1,
          },
        });

        if (ms.tasks && Array.isArray(ms.tasks)) {
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

    // Fetch complete hydrated graph
    const fullGoal = await prisma.goal.findUnique({
      where: { id: result.id },
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
    console.error('Error creating goal with roadmap:', error);
    return res.status(500).json({ error: 'Internal server error while saving roadmap.' });
  }
};

/**
 * Get goal by ID with complete hierarchical roadmap tree.
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

    return res.status(200).json({ success: true, data: goal });
  } catch (error) {
    console.error('Error retrieving goal:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all goals for a specific user.
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
              include: {
                dailyTasks: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ success: true, data: goals });
  } catch (error) {
    console.error('Error retrieving user goals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Complete a daily task and calculate user streak.
 */
exports.completeDailyTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { feedback, userId } = req.body;

    const task = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      include: {
        milestone: {
          include: {
            roadmap: {
              include: {
                goal: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const resolvedUserId = userId || task.milestone.roadmap.goal.userId;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark task complete
      const updatedTask = await tx.dailyTask.update({
        where: { id: taskId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      // 2. Log progress feedback
      if (feedback) {
        await tx.userProgress.create({
          data: {
            taskId,
            userFeedback: feedback,
          },
        });
      }

      // 3. Update User Streaks
      const user = await tx.user.findUnique({
        where: { id: resolvedUserId },
      });

      let updatedStreak = user ? user.currentStreak : 0;
      let longestStreak = user ? user.longestStreak : 0;

      if (user) {
        const now = new Date();
        const lastActive = new Date(user.lastActiveAt);
        const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 3600 * 24));

        if (diffDays <= 1) {
          // Continuous active streak
          updatedStreak += 1;
        } else {
          // Streak broken
          updatedStreak = 1;
        }

        if (updatedStreak > longestStreak) {
          longestStreak = updatedStreak;
        }

        await tx.user.update({
          where: { id: resolvedUserId },
          data: {
            currentStreak: updatedStreak,
            longestStreak,
            lastActiveAt: now,
          },
        });
      }

      return { task: updatedTask, currentStreak: updatedStreak, longestStreak };
    });

    return res.status(200).json({
      success: true,
      message: 'Task marked as completed',
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      task: result.task,
    });
  } catch (error) {
    console.error('Error completing task:', error);
    return res.status(500).json({ error: 'Internal server error while updating task.' });
  }
};

/**
 * Adaptive Re-balancing: Shift or regenerate remaining uncompleted tasks when behind schedule.
 */
exports.reAdaptGoalSchedule = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { additionalDays = 3, reason } = req.body;

    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        roadmap: {
          include: {
            milestones: {
              include: {
                dailyTasks: {
                  where: { isCompleted: false },
                  orderBy: { dayNumber: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!goal || !goal.roadmap) {
      return res.status(404).json({ error: 'Goal or roadmap not found' });
    }

    // Shift target date forward
    const newTargetDate = new Date(goal.targetDate);
    newTargetDate.setDate(newTargetDate.getDate() + additionalDays);

    await prisma.$transaction(async (tx) => {
      await tx.goal.update({
        where: { id: goalId },
        data: {
          targetDate: newTargetDate,
          status: 'BEHIND_SCHEDULE',
        },
      });

      await tx.roadmap.update({
        where: { goalId },
        data: {
          totalDays: goal.roadmap.totalDays + additionalDays,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: `Roadmap adapted successfully. Target extended by ${additionalDays} days. Reason: ${reason || 'Catch-up rebalance'}`,
      newTargetDate,
      totalDays: goal.roadmap.totalDays + additionalDays,
    });
  } catch (error) {
    console.error('Error adapting roadmap:', error);
    return res.status(500).json({ error: 'Internal server error during schedule shift.' });
  }
};

/**
 * Get streak and progress metrics for a user.
 */
exports.getUserMetrics = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        currentStreak: true,
        longestStreak: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalTasks = await prisma.dailyTask.count({
      where: {
        milestone: {
          roadmap: {
            goal: { userId },
          },
        },
      },
    });

    const completedTasks = await prisma.dailyTask.count({
      where: {
        isCompleted: true,
        milestone: {
          roadmap: {
            goal: { userId },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
        progress: {
          totalTasks,
          completedTasks,
          completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching user metrics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
