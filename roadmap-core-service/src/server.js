require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const roadmapRoutes = require('./routes/roadmapRoutes');
const prisma = require('./prisma');

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health Check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      service: 'roadmap-core-service',
      status: 'HEALTHY',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      service: 'roadmap-core-service',
      status: 'UNHEALTHY',
      database: 'DISCONNECTED',
      error: err.message,
    });
  }
});

// API Routes
app.use('/api/v1/core', roadmapRoutes);

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found on Roadmap Core Service` });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Core Service Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Core Service Error',
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Roadmap Core Service running on port ${PORT}`);
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('Stopping Roadmap Core Service gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database disconnected. Service stopped.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
