const express = require('express');
const router = express.Router();
const roadmapController = require('../controller/roadmapController');

// 1. Goal & Roadmap Creation
router.post('/goals', roadmapController.createGoal);

// 2. Fetch Goal by ID & User Goals
router.get('/goals/:goalId', roadmapController.getGoalById);
router.get('/users/:userId/goals', roadmapController.getUserGoals);

// 3. Complete Daily Task & Streak Engine
router.patch('/tasks/:taskId/complete', roadmapController.completeTask);
router.post('/tasks/:taskId/complete', roadmapController.completeTask);

module.exports = router;
