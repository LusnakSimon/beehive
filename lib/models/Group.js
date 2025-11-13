const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxLength: 100,
    trim: true
  },
  description: {
    type: String,
    maxLength: 1000,
    trim: true
  },
  coverImage: {
    type: String,
    maxLength: 500
  },
  icon: {
    type: String,
    maxLength: 500
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['member', 'moderator'],
      default: 'member'
    }
  }],
  privacy: {
    type: String,
    enum: ['public', 'private', 'secret'],
    default: 'public'
  },
  location: {
    type: String,
    maxLength: 100
  },
  category: {
    type: String,
    enum: [
      'beekeeping',
      'honey-production',
      'bee-health',
      'equipment',
      'education',
      'local-community',
      'commercial',
      'hobby',
      'research',
      'other'
    ],
    default: 'beekeeping'
  },
  rules: {
    type: String,
    maxLength: 2000
  },
  stats: {
    memberCount: {
      type: Number,
      default: 1  // Creator is first member
    },
    postCount: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date,
      default: Date.now
    }
  },
  settings: {
    allowMemberPosts: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false  // Auto-approve for public groups
    },
    allowMemberInvites: {
      type: Boolean,
      default: true
    }
  },
  pendingRequests: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    message: String
  }],
  tags: [{
    type: String,
    maxLength: 30
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
groupSchema.index({ privacy: 1, 'stats.memberCount': -1 });
groupSchema.index({ category: 1, privacy: 1 });
groupSchema.index({ location: 1 });
groupSchema.index({ name: 'text', description: 'text' });

// Methods
groupSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.userId.toString() === userId.toString());
};

groupSchema.methods.isAdmin = function(userId) {
  return this.admins.some(a => a.toString() === userId.toString()) || 
         this.creator.toString() === userId.toString();
};

groupSchema.methods.addMember = async function(userId, role = 'member') {
  if (!this.isMember(userId)) {
    this.members.push({
      userId,
      joinedAt: new Date(),
      role
    });
    this.stats.memberCount = this.members.length;
    
    // Remove from pending requests if exists
    this.pendingRequests = this.pendingRequests.filter(
      r => r.userId.toString() !== userId.toString()
    );
    
    await this.save();
  }
};

groupSchema.methods.removeMember = async function(userId) {
  const initialLength = this.members.length;
  this.members = this.members.filter(m => m.userId.toString() !== userId.toString());
  
  if (this.members.length < initialLength) {
    this.stats.memberCount = this.members.length;
    
    // Also remove from admins if they were admin
    this.admins = this.admins.filter(a => a.toString() !== userId.toString());
    
    await this.save();
  }
};

groupSchema.methods.requestToJoin = async function(userId, message = '') {
  // Check if already member
  if (this.isMember(userId)) {
    throw new Error('Already a member');
  }
  
  // Check if already requested
  const alreadyRequested = this.pendingRequests.some(
    r => r.userId.toString() === userId.toString()
  );
  
  if (alreadyRequested) {
    throw new Error('Request already pending');
  }
  
  // Add to pending requests
  this.pendingRequests.push({
    userId,
    requestedAt: new Date(),
    message
  });
  
  await this.save();
};

const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);

module.exports = Group;
