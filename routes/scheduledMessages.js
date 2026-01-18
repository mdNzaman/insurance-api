const express = require('express');
const ScheduledMessage = require('../models/ScheduledMessage');
const MessageScheduler = require('../services/scheduler');

const router = express.Router();

// Store scheduler instance (will be initialized in server.js)
let scheduler = null;

// Set scheduler instance
router.setScheduler = (schedulerInstance) => {
  scheduler = schedulerInstance;
};

/**
 * Helper function to calculate next occurrence of a day and time
 * @param {String} day - Day of week (monday, tuesday, etc.)
 * @param {String} time - Time in HH:mm format
 * @returns {Date} Next occurrence date
 */
function getNextScheduledDate(day, time) {
  const dayMap = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };

  const targetDay = dayMap[day.toLowerCase()];
  const [hours, minutes] = time.split(':').map(Number);

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMs = now.getMilliseconds();

  // Calculate days until target day
  let daysUntilTarget = targetDay - currentDay;
  
  // Calculate the target date
  const targetDate = new Date(now);
  targetDate.setHours(hours, minutes, 0, 0);

  // If target day is today but time has passed, schedule for next week
  if (daysUntilTarget === 0 && (currentHour > hours || (currentHour === hours && currentMinute >= minutes))) {
    daysUntilTarget = 7;
  } else if (daysUntilTarget < 0) {
    // If target day has passed this week, schedule for next week
    daysUntilTarget += 7;
  }

  targetDate.setDate(now.getDate() + daysUntilTarget);

  return targetDate;
}

// POST /api/scheduled-messages - Create a scheduled message
router.post('/', async (req, res) => {
  try {
    const { message, day, time } = req.body;

    // Validate required fields
    if (!message || !day || !time) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['message', 'day', 'time'],
        received: { message: !!message, day: !!day, time: !!time }
      });
    }

    // Validate day
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid day',
        validDays: validDays,
        received: day
      });
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      return res.status(400).json({
        error: 'Invalid time format',
        expected: 'HH:mm (24-hour format, e.g., "14:30")',
        received: time
      });
    }

    // Calculate scheduled datetime
    const scheduledDatetime = getNextScheduledDate(day, time);

    // Create scheduled message
    const scheduledMessage = await ScheduledMessage.create({
      message: message.trim(),
      scheduled_day: day.toLowerCase(),
      scheduled_time: time,
      scheduled_datetime: scheduledDatetime,
      status: 'pending'
    });

    // Schedule the message if scheduler is available
    if (scheduler) {
      scheduler.scheduleMessage(scheduledMessage);
    }

    res.status(201).json({
      message: 'Scheduled message created successfully',
      data: {
        id: scheduledMessage._id,
        message: scheduledMessage.message,
        scheduled_day: scheduledMessage.scheduled_day,
        scheduled_time: scheduledMessage.scheduled_time,
        scheduled_datetime: scheduledMessage.scheduled_datetime,
        status: scheduledMessage.status
      }
    });

  } catch (error) {
    console.error('Error creating scheduled message:', error);
    res.status(500).json({
      error: 'Error creating scheduled message',
      message: error.message
    });
  }
});

// GET /api/scheduled-messages - Get all scheduled messages
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const messages = await ScheduledMessage.find(query)
      .sort({ scheduled_datetime: 1 })
      .lean();

    res.json({
      message: `Found ${messages.length} scheduled message(s)`,
      count: messages.length,
      data: messages
    });

  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    res.status(500).json({
      error: 'Error fetching scheduled messages',
      message: error.message
    });
  }
});

// GET /api/scheduled-messages/:id - Get a specific scheduled message
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const scheduledMessage = await ScheduledMessage.findById(id);

    if (!scheduledMessage) {
      return res.status(404).json({
        error: 'Scheduled message not found'
      });
    }

    res.json({
      data: scheduledMessage
    });

  } catch (error) {
    console.error('Error fetching scheduled message:', error);
    res.status(500).json({
      error: 'Error fetching scheduled message',
      message: error.message
    });
  }
});

// DELETE /api/scheduled-messages/:id - Cancel a scheduled message
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const scheduledMessage = await ScheduledMessage.findById(id);

    if (!scheduledMessage) {
      return res.status(404).json({
        error: 'Scheduled message not found'
      });
    }

    if (scheduledMessage.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot cancel message that is not pending',
        currentStatus: scheduledMessage.status
      });
    }

    // Cancel in scheduler if it exists
    if (scheduler) {
      scheduler.cancelMessage(id);
    }

    // Update status in database
    await ScheduledMessage.findByIdAndUpdate(id, {
      status: 'cancelled'
    });

    res.json({
      message: 'Scheduled message cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling scheduled message:', error);
    res.status(500).json({
      error: 'Error cancelling scheduled message',
      message: error.message
    });
  }
});

module.exports = router;

