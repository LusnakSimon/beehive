const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who receives the notification
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Type of notification
  type: {
    type: String,
    enum: [
      'friend_request',           // Someone sent you a friend request
      'friend_request_accepted',  // Someone accepted your friend request
      'new_message',              // New message in conversation (optional, can use badge)
      'group_invite',             // Invited to a group (future)
      'group_message'             // New message in group (future)
    ],
    required: true
  },
  
  // Who triggered the notification (sender)
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Additional data based on type
  content: {
    text: String,           // Notification message text
    friendRequestId: mongoose.Schema.Types.ObjectId,  // For friend_request type
    conversationId: mongoose.Schema.Types.ObjectId,   // For new_message type
    groupId: mongoose.Schema.Types.ObjectId          // For group types (future)
  },
  
  // Read status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Link to navigate to when clicked
  link: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ user: userId, read: false });
};

// Static method to create friend request notification
notificationSchema.statics.createFriendRequest = async function(toUserId, fromUserId, requestId) {
  return await this.create({
    user: toUserId,
    type: 'friend_request',
    from: fromUserId,
    content: {
      friendRequestId: requestId
    },
    link: '/friends/requests'
  });
};

// Static method to create friend request accepted notification
notificationSchema.statics.createFriendRequestAccepted = async function(toUserId, fromUserId) {
  return await this.create({
    user: toUserId,
    type: 'friend_request_accepted',
    from: fromUserId,
    link: `/profile/${fromUserId}`
  });
};

// Static method to create new message notification
notificationSchema.statics.createNewMessage = async function(toUserId, fromUserId, conversationId, messagePreview) {
  return await this.create({
    user: toUserId,
    type: 'new_message',
    from: fromUserId,
    content: {
      conversationId: conversationId,
      text: messagePreview
    },
    link: `/messages/${conversationId}`
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return await this.save();
};

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
