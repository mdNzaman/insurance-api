const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true
  },
  scheduled_day: {
    type: String,
    required: true,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    lowercase: true
  },
  scheduled_time: {
    type: String,
    required: true,
    // Format: HH:mm (24-hour format, e.g., "14:30")
    match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
  },
  scheduled_datetime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  executed_at: {
    type: Date
  },
  error_message: {
    type: String
  }
}, {
  timestamps: true
});

// Create index for efficient querying of pending messages
scheduledMessageSchema.index({ status: 1, scheduled_datetime: 1 });

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);

