const express = require('express');
const router = express.Router();
const roadmapController = require('../controllers/roadmapController');

// 1. Goal & Roadmap Creation
router.post('/goals', roadmapController.createGoalWithRoadmap);

// 2. Fetch Goal by ID & User Goals
router.get('/goals/:goalId', roadmapController.getGoalById);
router.get('/users/:userId/goals', roadmapController.getUserGoals);

module.exports = router;
