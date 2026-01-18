const express = require('express');
const connectDB = require('./config/database');
const CPUMonitor = require('./services/cpuMonitor');
const MessageScheduler = require('./services/scheduler');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Initialize services
const cpuMonitor = new CPUMonitor(70, 5000); // 70% threshold, check every 5 seconds
const messageScheduler = new MessageScheduler();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/upload', require('./routes/upload'));
app.use('/api/policies', require('./routes/policies'));

// Scheduled messages route
const scheduledMessagesRouter = require('./routes/scheduledMessages');
scheduledMessagesRouter.setScheduler(messageScheduler);
app.use('/api/scheduled-messages', scheduledMessagesRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// CPU status endpoint
app.get('/api/cpu-status', async (req, res) => {
  try {
    const cpuUsage = await cpuMonitor.getCPUUsage();
    res.json({
      cpu_usage: cpuUsage.toFixed(2),
      threshold: cpuMonitor.threshold,
      is_monitoring: cpuMonitor.isMonitoring,
      status: cpuUsage >= cpuMonitor.threshold ? 'CRITICAL' : 'OK',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching CPU status',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Insurance Policy Management API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/upload - Upload CSV/XLSX file',
      search: 'GET /api/policies/search?username=<name> - Search policies by username',
      aggregated: 'GET /api/policies/aggregated - Get aggregated policies by user',
      scheduledMessages: 'POST /api/scheduled-messages - Schedule a message (body: message, day, time)',
      scheduledMessagesList: 'GET /api/scheduled-messages - Get all scheduled messages',
      cpuStatus: 'GET /api/cpu-status - Get current CPU usage',
      health: 'GET /health - Health check'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Start CPU monitoring
  cpuMonitor.startMonitoring(async () => {
    console.log('🔄 CPU threshold exceeded. Restarting server...');
    
    // Graceful shutdown
    server.close(() => {
      console.log('✅ Server closed. Restarting...');
      
      // Restart the server
      cpuMonitor.restartServer().catch(error => {
        console.error('Error restarting server:', error);
        process.exit(1);
      });
    });
    
    // Force close after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log('⚠️  Forcing server shutdown...');
      process.exit(0);
    }, 5000);
  });

  // Start message scheduler
  messageScheduler.start();
  
  console.log('📊 CPU monitoring started (threshold: 70%)');
  console.log('📅 Message scheduler started');
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  cpuMonitor.stopMonitoring();
  messageScheduler.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  cpuMonitor.stopMonitoring();
  messageScheduler.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

