const roadmapRepository = require('../repositories/roadmapRepository');

/**
 * Service Layer (Business Logic Layer)
 * Contains domain logic, date calculations, validation, and orchestrates repositories.
 */

// 1. Create Goal & Roadmap Tree
exports.createGoal = async ({ userId, title, description, targetDays, dailyHours, roadmapData }) => {
  if (!userId || !title || !roadmapData || !roadmapData.milestones) {
    const error = new Error('Validation failed: userId, title, and roadmapData with milestones are required.');
    error.statusCode = 400;
    throw error;
  }

  const totalDays = parseInt(targetDays, 10) || roadmapData.totalDays || 30;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + totalDays);

  const goalData = {
    userId,
    title,
    description: description || null,
    targetDate,
    dailyHours: parseFloat(dailyHours) || 2.0,
    status: 'IN_PROGRESS',
  };

  const createdGoal = await roadmapRepository.createGoalWithRoadmap(goalData, {
    ...roadmapData,
    totalDays,
  });

  // Return full hydrated relational tree
  return await roadmapRepository.findGoalById(createdGoal.id);
};

// 2. Fetch Goal by ID
exports.getGoalById = async (goalId) => {
  const goal = await roadmapRepository.findGoalById(goalId);
  if (!goal) {
    const error = new Error('Goal not found');
    error.statusCode = 404;
    throw error;
  }
  return goal;
};

// 3. Fetch User Goals
exports.getUserGoals = async (userId) => {
  return await roadmapRepository.findGoalsByUserId(userId);
};

// 4. Complete Daily Task & Calculate Streak Metrics
exports.completeTask = async (taskId, feedback) => {
  const task = await roadmapRepository.findTaskWithDetails(taskId);

  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  const user = task.milestone.roadmap.goal.user;

  // Idempotent check: If already completed, return without double-bumping streak
  if (task.isCompleted) {
    return {
      task,
      user: {
        id: user.id,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
      },
      streakUpdated: false,
      alreadyCompleted: true,
    };
  }

  // Streak Engine: Calendar Day Math
  const now = new Date();
  const lastActive = new Date(user.lastActiveAt);

  const nowDateOnly = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActiveDateOnly = Date.UTC(
    lastActive.getFullYear(),
    lastActive.getMonth(),
    lastActive.getDate()
  );

  const diffInDays = Math.floor((nowDateOnly - lastActiveDateOnly) / (1000 * 60 * 60 * 24));

  let newStreak = user.currentStreak;
  let streakUpdated = false;

  if (diffInDays === 0) {
    // Already completed a task today; maintain streak
    if (newStreak === 0) {
      newStreak = 1;
      streakUpdated = true;
    }
  } else if (diffInDays === 1) {
    // Consecutive day completion! Increment streak
    newStreak += 1;
    streakUpdated = true;
  } else {
    // Missed 1+ days: Reset streak to 1
    newStreak = 1;
    streakUpdated = true;
  }

  const newLongestStreak = Math.max(user.longestStreak, newStreak);

  const streakUpdates = {
    newStreak,
    newLongestStreak,
    now,
    streakUpdated,
  };

  return await roadmapRepository.completeTaskWithStreak(
    taskId,
    user.id,
    feedback,
    streakUpdates
  );
};
