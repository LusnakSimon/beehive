const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxLength: 5000
  },
  images: [{
    type: String,
    maxLength: 500
  }],
  type: {
    type: String,
    enum: ['text', 'image', 'system'],
    default: 'text'
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  editedAt: Date,
  deletedAt: Date
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

// Method to mark message as read
messageSchema.methods.markAsRead = async function(userId) {
  if (!this.readBy.includes(userId)) {
    this.readBy.push(userId);
    await this.save();
  }
};

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

module.exports = Message;
