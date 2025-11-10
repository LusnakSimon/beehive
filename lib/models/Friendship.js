import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Ensure user1 is always less than user2 for consistency
friendshipSchema.pre('save', function(next) {
  if (this.user1.toString() > this.user2.toString()) {
    [this.user1, this.user2] = [this.user2, this.user1];
  }
  next();
});

// Index for efficient queries
friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });
friendshipSchema.index({ user1: 1 });
friendshipSchema.index({ user2: 1 });

// Static method to check if users are friends
friendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const [smaller, larger] = [userId1, userId2].sort();
  const friendship = await this.findOne({
    user1: smaller,
    user2: larger
  });
  return !!friendship;
};

// Static method to get all friends of a user
friendshipSchema.statics.getFriends = async function(userId) {
  const friendships = await this.find({
    $or: [{ user1: userId }, { user2: userId }]
  }).populate('user1 user2', 'name email image profile');
  
  // Return the other user in each friendship
  return friendships.map(f => {
    return f.user1._id.toString() === userId.toString() ? f.user2 : f.user1;
  });
};

const Friendship = mongoose.models.Friendship || mongoose.model('Friendship', friendshipSchema);

export default Friendship;
