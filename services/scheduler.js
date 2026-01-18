const cron = require('node-cron');
const ScheduledMessage = require('../models/ScheduledMessage');
const Message = require('../models/Message');

class MessageScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('📅 Message scheduler started');

    // Load and schedule existing pending messages
    this.loadPendingMessages();

    // Check for new pending messages every minute
    setInterval(() => {
      this.loadPendingMessages();
    }, 60000); // Check every minute

    // Run scheduled tasks every minute to catch messages
    this.scheduleCronJob();
  }

  /**
   * Load pending messages from database and schedule them
   */
  async loadPendingMessages() {
    try {
      const now = new Date();
      const pendingMessages = await ScheduledMessage.find({
        status: 'pending',
        scheduled_datetime: { $gte: now }
      });

      for (const message of pendingMessages) {
        const jobId = message._id.toString();
        
        // Skip if already scheduled
        if (this.jobs.has(jobId)) {
          continue;
        }

        // Schedule the message
        this.scheduleMessage(message);
      }
    } catch (error) {
      console.error('Error loading pending messages:', error);
    }
  }

  /**
   * Schedule a message to be executed at the specified time
   * @param {Object} message - ScheduledMessage document
   */
  scheduleMessage(message) {
    const jobId = message._id.toString();
    const scheduledDate = new Date(message.scheduled_datetime);
    const now = new Date();

    // Check if the scheduled time has already passed
    if (scheduledDate < now) {
      console.log(`Scheduled time for message ${jobId} has already passed. Executing immediately.`);
      this.executeMessage(message);
      return;
    }

    // Calculate delay in milliseconds
    const delay = scheduledDate.getTime() - now.getTime();

    console.log(`📝 Scheduling message ${jobId} to execute at ${scheduledDate.toISOString()}`);

    // Schedule using setTimeout for exact time execution
    const timeoutId = setTimeout(async () => {
      await this.executeMessage(message);
      this.jobs.delete(jobId);
    }, delay);

    // Store the timeout ID for potential cancellation
    this.jobs.set(jobId, timeoutId);
  }

  /**
   * Execute a scheduled message
   * @param {Object} message - ScheduledMessage document
   */
  async executeMessage(message) {
    try {
      console.log(`⏰ Executing scheduled message ${message._id} at ${new Date().toISOString()}`);

      // Insert the message into the Messages collection
      await Message.create({
        content: message.message,
        scheduled_message_id: message._id,
        inserted_at: new Date()
      });

      // Update scheduled message status to completed
      await ScheduledMessage.findByIdAndUpdate(message._id, {
        status: 'completed',
        executed_at: new Date()
      });

      console.log(`✅ Message executed and inserted into DB: "${message.message}"`);
      
    } catch (error) {
      console.error(`❌ Error executing message ${message._id}:`, error);
      await ScheduledMessage.findByIdAndUpdate(message._id, {
        status: 'failed',
        executed_at: new Date(),
        error_message: error.message
      });
    }
  }

  /**
   * Schedule a cron job to check for messages every minute
   */
  scheduleCronJob() {
    // Run every minute to catch any messages that might have been missed
    cron.schedule('* * * * *', async () => {
      const now = new Date();
      
      try {
        // Find messages that should be executed now (within the last minute)
        const messagesToExecute = await ScheduledMessage.find({
          status: 'pending',
          scheduled_datetime: {
            $gte: new Date(now.getTime() - 60000), // 1 minute ago
            $lte: now
          }
        });

        for (const message of messagesToExecute) {
          const jobId = message._id.toString();
          
          // Only execute if not already scheduled
          if (!this.jobs.has(jobId)) {
            await this.executeMessage(message);
          }
        }
      } catch (error) {
        console.error('Error in cron job:', error);
      }
    });
  }

  /**
   * Cancel a scheduled message
   * @param {String} messageId - Message ID
   */
  cancelMessage(messageId) {
    const jobId = messageId.toString();
    if (this.jobs.has(jobId)) {
      clearTimeout(this.jobs.get(jobId));
      this.jobs.delete(jobId);
      console.log(`Cancelled scheduled message ${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Stop the scheduler
   */
  stop() {
    // Clear all scheduled jobs
    for (const [jobId, timeoutId] of this.jobs) {
      clearTimeout(timeoutId);
    }
    this.jobs.clear();
    this.isRunning = false;
    console.log('Scheduler stopped');
  }
}

module.exports = MessageScheduler;

