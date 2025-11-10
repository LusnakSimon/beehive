const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    text: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

// Ensure exactly 2 participants
conversationSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    next(new Error('Conversation must have exactly 2 participants'));
  }
  
  // Sort participants for consistency
  this.participants.sort();
  
  next();
});

// Index for finding conversations
conversationSchema.index({ participants: 1 });

// Compound unique index to prevent duplicate conversations
conversationSchema.index(
  { participants: 1 },
  { unique: true }
);

// Static method to find conversation between two users
conversationSchema.statics.findBetweenUsers = async function(userId1, userId2) {
  const [user1, user2] = [userId1, userId2].sort();
  return this.findOne({
    participants: { $all: [user1, user2], $size: 2 }
  });
};

// Static method to get user's conversations
conversationSchema.statics.getUserConversations = async function(userId) {
  return this.find({
    participants: userId
  })
    .populate('participants', 'name email image profile')
    .populate('lastMessage.sender', 'name image')
    .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });
};

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
