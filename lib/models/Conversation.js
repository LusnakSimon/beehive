const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  // Optional: If this is a group conversation, reference the group
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  // Conversation type: 'dm' or 'group'
  type: {
    type: String,
    enum: ['dm', 'group'],
    default: 'dm'
  },
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

// Ensure exactly 2 participants for DM, skip validation for group chats
conversationSchema.pre('save', function(next) {
  if (this.type === 'dm' && this.participants.length !== 2) {
    next(new Error('DM conversation must have exactly 2 participants'));
  }
  
  // Sort participants for consistency (DM only)
  if (this.type === 'dm') {
    this.participants.sort();
  }
  
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

// Static method to get user's conversations (both DM and group)
conversationSchema.statics.getUserConversations = async function(userId) {
  return this.find({
    participants: userId
  })
    .populate('participants', 'name email image profile')
    .populate('lastMessage.sender', 'name image')
    .populate('group', 'name icon memberCount')
    .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });
};

// Static method to find or create group conversation
conversationSchema.statics.findOrCreateGroupConversation = async function(groupId, participants) {
  let conversation = await this.findOne({
    group: groupId,
    type: 'group'
  });
  
  if (!conversation) {
    conversation = await this.create({
      participants,
      group: groupId,
      type: 'group'
    });
  }
  
  return conversation;
};

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
