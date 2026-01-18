const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  address: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  zip: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  gender: {
    type: String,
    trim: true
  },
  userType: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create index on firstname for faster searches
userSchema.index({ firstname: 1 });

module.exports = mongoose.model('User', userSchema);

