const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  scheduled_message_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledMessage',
    default: null
  },
  inserted_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create index for faster queries
messageSchema.index({ inserted_at: -1 });
messageSchema.index({ scheduled_message_id: 1 });

module.exports = mongoose.model('Message', messageSchema);

