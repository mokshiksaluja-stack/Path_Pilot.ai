const express = require('express');
const router = express.Router();
const roadmapController = require('../controllers/roadmapController');

// Goal & Roadmap Routes
router.post('/goals', roadmapController.createGoalWithRoadmap);
router.get('/goals/:goalId', roadmapController.getGoalById);
router.get('/users/:userId/goals', roadmapController.getUserGoals);
router.get('/users/:userId/metrics', roadmapController.getUserMetrics);

// Task Action Routes
router.post('/tasks/:taskId/complete', roadmapController.completeDailyTask);
router.post('/goals/:goalId/re-adapt', roadmapController.reAdaptGoalSchedule);

module.exports = router;
