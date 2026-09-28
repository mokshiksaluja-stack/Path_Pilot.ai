const roadmapService = require('../services/roadmapService');

/**
 * Controller Layer (HTTP Request / Response Handlers)
 * Thin handlers responsible for parsing HTTP input, invoking services, and sending JSON responses.
 */

// 1. POST /api/v1/core/goals
exports.createGoal = async (req, res, next) => {
  try {
    const { userId, title, description, targetDays, dailyHours, roadmapData } = req.body;

    const goal = await roadmapService.createGoal({
      userId,
      title,
      description,
      targetDays,
      dailyHours,
      roadmapData,
    });

    return res.status(201).json({
      success: true,
      data: goal,
    });
  } catch (error) {
    next(error);
  }
};

// 2. GET /api/v1/core/goals/:goalId
exports.getGoalById = async (req, res, next) => {
  try {
    const { goalId } = req.params;
    const goal = await roadmapService.getGoalById(goalId);

    return res.status(200).json({
      success: true,
      data: goal,
    });
  } catch (error) {
    next(error);
  }
};

// 3. GET /api/v1/core/users/:userId/goals
exports.getUserGoals = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const goals = await roadmapService.getUserGoals(userId);

    return res.status(200).json({
      success: true,
      count: goals.length,
      data: goals,
    });
  } catch (error) {
    next(error);
  }
};

// 4. PATCH or POST /api/v1/core/tasks/:taskId/complete
exports.completeTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { feedback } = req.body;

    const result = await roadmapService.completeTask(taskId, feedback);

    return res.status(200).json({
      success: true,
      message: result.alreadyCompleted
        ? 'Task was already marked as completed.'
        : 'Task marked as completed successfully!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
