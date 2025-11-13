const Group = require('../models/Group.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const GroupMessage = require('../models/GroupMessage.js');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer storage
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const useCloudinary = isServerless && process.env.CLOUDINARY_CLOUD_NAME;

let storage;
if (useCloudinary) {
  // Use Cloudinary on serverless with config
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'beehive/groups',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      resource_type: 'image',
      public_id: (req, file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        return 'group-' + uniqueSuffix;
      }
    }
  });
} else {
  // Use local storage for development
  storage = multer.diskStorage({
    destination: async function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'groups');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'group-' + uniqueSuffix + ext);
    }
  });
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WEBP'));
    }
  }
});

// Verify JWT token from cookie
function verifyAuth(req) {
  const token = req.headers.cookie?.split('auth-token=')[1]?.split(';')[0];
  
  if (!token) {
    return { authenticated: false, user: null };
  }

  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    
    const userData = decoded.user || decoded;
    
    return { 
      authenticated: true, 
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role || 'user'
      }
    };
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return { authenticated: false, user: null };
  }
}

module.exports = async function handler(req, res) {
  const auth = verifyAuth(req);
  const { method } = req;
  
  if (!auth.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Parse URL path
  let urlPath = req.url.split('?')[0];
  if (urlPath.startsWith('/api/groups')) {
    urlPath = urlPath.replace('/api/groups', '');
  }
  const pathParts = urlPath.split('/').filter(Boolean);
  const basePath = pathParts.length > 0 ? '/' + pathParts.join('/') : '';
  
  // Debug logging for upload endpoint
  if (urlPath.includes('upload')) {
    console.log('[Groups] Upload request:', {
      originalUrl: req.url,
      urlPath,
      pathParts,
      basePath,
      method,
      regexMatch: basePath.match(/^\/[^/]+\/messages\/upload$/)
    });
  }

  // POST /api/groups - Create new group
  if (urlPath === '' && method === 'POST') {
    return new Promise((resolve) => {
      upload.fields([
        { name: 'coverImage', maxCount: 1 },
        { name: 'icon', maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        try {
          const { name, description, privacy, location, category, rules, tags } = req.body;

          if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Group name is required' });
          }

          // Prepare group data
          const groupData = {
            name: name.trim(),
            description: description?.trim(),
            creator: auth.user.id,
            admins: [auth.user.id],
            members: [{
              userId: auth.user.id,
              joinedAt: new Date(),
              role: 'member'
            }],
            privacy: privacy || 'public',
            location: location?.trim(),
            category: category || 'beekeeping',
            rules: rules?.trim(),
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
            settings: {
              allowMemberPosts: true,
              requireApproval: privacy === 'private',
              allowMemberInvites: true
            }
          };

          // Add uploaded images - handle both Cloudinary and local storage
          if (req.files?.coverImage) {
            groupData.coverImage = useCloudinary 
              ? req.files.coverImage[0].path  // Cloudinary URL
              : `/uploads/groups/${req.files.coverImage[0].filename}`;  // Local path
          }
          if (req.files?.icon) {
            groupData.icon = useCloudinary
              ? req.files.icon[0].path  // Cloudinary URL
              : `/uploads/groups/${req.files.icon[0].filename}`;  // Local path
          }

          const group = await Group.create(groupData);
          await group.populate('creator', 'name image');

          resolve(res.status(201).json({
            success: true,
            group: {
              id: group._id,
              name: group.name,
              description: group.description,
              coverImage: group.coverImage,
              icon: group.icon,
              creator: {
                id: group.creator._id,
                name: group.creator.name,
                image: group.creator.image
              },
              privacy: group.privacy,
              location: group.location,
              category: group.category,
              memberCount: group.stats.memberCount,
              createdAt: group.createdAt
            }
          }));
        } catch (error) {
          console.error('Error creating group:', error);
          resolve(res.status(500).json({ error: 'Failed to create group' }));
        }
      });
    });
  }

  // GET /api/groups - List/search groups
  if (urlPath === '' && method === 'GET') {
    try {
      const { 
        search, 
        category, 
        location, 
        privacy = 'public', 
        page = 1, 
        limit = 20,
        sort = '-stats.memberCount'
      } = req.query;

      const query = {};

      // Only show public groups by default (or groups user is member of)
      if (privacy === 'public') {
        query.privacy = 'public';
      } else {
        // Show user's groups (member or creator)
        query.$or = [
          { 'members.userId': auth.user.id },
          { creator: auth.user.id }
        ];
      }

      // Search filter
      if (search) {
        query.$text = { $search: search };
      }

      // Category filter
      if (category) {
        query.category = category;
      }

      // Location filter
      if (location) {
        query.location = new RegExp(location, 'i');
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [groups, total] = await Promise.all([
        Group.find(query)
          .populate('creator', 'name image')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Group.countDocuments(query)
      ]);

      // Add isMember flag for each group
      const groupsWithStatus = groups.map(group => ({
        id: group._id,
        name: group.name,
        description: group.description,
        coverImage: group.coverImage,
        icon: group.icon,
        creator: {
          id: group.creator._id,
          name: group.creator.name,
          image: group.creator.image
        },
        privacy: group.privacy,
        location: group.location,
        category: group.category,
        memberCount: group.stats.memberCount,
        lastActivityAt: group.stats.lastActivityAt,
        isMember: group.members.some(m => m.userId.toString() === auth.user.id),
        createdAt: group.createdAt
      }));

      return res.json({
        success: true,
        groups: groupsWithStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }

  // GET /api/groups/:id - Get group details
  if (basePath.match(/^\/[^/]+$/) && method === 'GET') {
    try {
      const groupId = pathParts[0];

      const group = await Group.findById(groupId)
        .populate('creator', 'name image profile')
        .populate('admins', 'name image')
        .populate('members.userId', 'name image profile')
        .lean();

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Check if user can view group
      const isMember = group.members.some(m => m.userId._id.toString() === auth.user.id);
      const isCreator = group.creator._id.toString() === auth.user.id;
      
      if (group.privacy === 'secret' && !isMember && !isCreator) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.json({
        success: true,
        group: {
          id: group._id,
          name: group.name,
          description: group.description,
          coverImage: group.coverImage,
          icon: group.icon,
          creator: group.creator,
          admins: group.admins,
          members: group.members.map(m => ({
            user: m.userId,
            joinedAt: m.joinedAt,
            role: m.role
          })),
          privacy: group.privacy,
          location: group.location,
          category: group.category,
          rules: group.rules,
          tags: group.tags,
          stats: group.stats,
          settings: group.settings,
          isMember,
          isAdmin: group.admins.some(a => a._id.toString() === auth.user.id) || isCreator,
          isCreator,
          createdAt: group.createdAt
        }
      });
    } catch (error) {
      console.error('Error fetching group:', error);
      return res.status(500).json({ error: 'Failed to fetch group' });
    }
  }

  // POST /api/groups/:id/join - Join group or request to join
  if (basePath.match(/^\/[^/]+\/join$/) && method === 'POST') {
    try {
      const groupId = pathParts[0];
      const { message } = req.body;

      const group = await Group.findById(groupId);
      
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Check if already a member
      if (group.isMember(auth.user.id)) {
        return res.status(400).json({ error: 'Already a member of this group' });
      }

      // Public groups: instant join
      if (group.privacy === 'public') {
        await group.addMember(auth.user.id);
        
        // Notify group creator
        try {
          await Notification.create({
            user: group.creator,
            type: 'group_join',
            content: {
              groupId: group._id,
              groupName: group.name,
              userId: auth.user.id
            },
            read: false
          });
        } catch (notifError) {
          console.error('Error creating join notification:', notifError);
        }

        return res.json({
          success: true,
          message: 'Successfully joined group',
          joined: true
        });
      }

      // Private groups: send join request
      if (group.privacy === 'private') {
        await group.requestToJoin(auth.user.id, message);

        // Notify group admins
        try {
          const adminIds = [...group.admins, group.creator];
          await Promise.all(adminIds.map(adminId =>
            Notification.create({
              user: adminId,
              type: 'group_request',
              content: {
                groupId: group._id,
                groupName: group.name,
                userId: auth.user.id,
                message
              },
              read: false
            })
          ));
        } catch (notifError) {
          console.error('Error creating request notification:', notifError);
        }

        return res.json({
          success: true,
          message: 'Join request sent. Waiting for admin approval.',
          requested: true
        });
      }

      // Secret groups: can't join
      return res.status(403).json({ error: 'This group is invite-only' });

    } catch (error) {
      console.error('Error joining group:', error);
      
      if (error.message === 'Already a member') {
        return res.status(400).json({ error: 'Already a member of this group' });
      }
      if (error.message === 'Request already pending') {
        return res.status(400).json({ error: 'Join request already pending' });
      }
      
      return res.status(500).json({ error: 'Failed to join group' });
    }
  }

  // POST /api/groups/:id/leave - Leave group
  if (basePath.match(/^\/[^/]+\/leave$/) && method === 'POST') {
    try {
      const groupId = pathParts[0];

      const group = await Group.findById(groupId);
      
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Can't leave if you're the creator (must transfer ownership first)
      if (group.creator.toString() === auth.user.id) {
        return res.status(400).json({ 
          error: 'Creator cannot leave group. Transfer ownership first or delete the group.' 
        });
      }

      await group.removeMember(auth.user.id);

      return res.json({
        success: true,
        message: 'Successfully left group'
      });
    } catch (error) {
      console.error('Error leaving group:', error);
      return res.status(500).json({ error: 'Failed to leave group' });
    }
  }

  // GET /api/groups/:id/messages - Get group messages
  if (basePath.match(/^\/[^/]+\/messages$/) && method === 'GET') {
    try {
      const groupId = pathParts[0];
      const { page = 1, limit = 50 } = req.query;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Check if user is member
      if (!group.isMember(auth.user.id)) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [messages, total] = await Promise.all([
        GroupMessage.find({ groupId, deleted: false })
          .populate('sender', 'name image')
          .populate('replyTo')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        GroupMessage.countDocuments({ groupId, deleted: false })
      ]);

      return res.json({
        success: true,
        messages: messages.reverse(), // Show oldest first
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching group messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // POST /api/groups/:id/messages - Send message to group
  if (basePath.match(/^\/[^/]+\/messages$/) && method === 'POST') {
    try {
      const groupId = pathParts[0];
      const { text, replyTo } = req.body;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Check if user is member
      if (!group.isMember(auth.user.id)) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }

      // Create message
      const message = await GroupMessage.create({
        groupId,
        sender: auth.user.id,
        text: text?.trim() || '',
        type: 'text',
        readBy: [{ userId: auth.user.id }],
        replyTo: replyTo || null
      });

      await message.populate('sender', 'name image');

      // Update group last activity
      group.stats.lastActivityAt = new Date();
      await group.save();

      // Update or create conversation for this group
      try {
        const Conversation = require('../models/Conversation');
        const memberIds = group.members.map(m => m.userId);
        
        let conversation = await Conversation.findOne({ group: groupId, type: 'group' });
        
        if (!conversation) {
          // Create group conversation
          conversation = await Conversation.create({
            participants: memberIds,
            group: groupId,
            type: 'group',
            lastMessage: {
              text: text?.substring(0, 100) || 'Sent a file',
              sender: auth.user.id,
              timestamp: new Date()
            },
            unreadCount: {}
          });
        } else {
          // Update existing conversation
          conversation.lastMessage = {
            text: text?.substring(0, 100) || 'Sent a file',
            sender: auth.user.id,
            timestamp: new Date()
          };
          
          // Update unread count for all members except sender
          for (const memberId of memberIds) {
            if (memberId.toString() !== auth.user.id) {
              const currentCount = conversation.unreadCount.get(memberId.toString()) || 0;
              conversation.unreadCount.set(memberId.toString(), currentCount + 1);
            } else {
              // Reset sender's unread count
              conversation.unreadCount.set(auth.user.id, 0);
            }
          }
          
          await conversation.save();
        }
      } catch (convError) {
        console.error('Error updating group conversation:', convError);
      }

      // Notify other members (except sender)
      try {
        const otherMembers = group.members
          .filter(m => m.userId.toString() !== auth.user.id)
          .map(m => m.userId);

        await Promise.all(otherMembers.map(memberId =>
          Notification.create({
            user: memberId,
            type: 'group_message',
            content: {
              groupId: group._id,
              groupName: group.name,
              senderId: auth.user.id,
              messagePreview: text?.substring(0, 100)
            },
            read: false
          })
        ));
      } catch (notifError) {
        console.error('Error creating notifications:', notifError);
      }

      return res.status(201).json({
        success: true,
        message: {
          id: message._id,
          sender: {
            id: message.sender._id,
            name: message.sender.name,
            image: message.sender.image
          },
          text: message.text,
          type: message.type,
          readBy: message.readBy,
          replyTo: message.replyTo,
          createdAt: message.createdAt
        }
      });
    } catch (error) {
      console.error('Error sending group message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // POST /api/groups/:id/messages/upload - Upload files to group chat
  if (basePath.match(/^\/[^/]+\/messages\/upload$/) && method === 'POST') {
    return new Promise((resolve) => {
      upload.array('files', 5)(req, res, async (err) => {
        if (err) {
          return resolve(res.status(400).json({ error: err.message }));
        }

        try {
          const groupId = pathParts[0];
          const uploadedFiles = req.files;

          if (!uploadedFiles || uploadedFiles.length === 0) {
            return resolve(res.status(400).json({ error: 'No files uploaded' }));
          }

          const group = await Group.findById(groupId);
          if (!group) {
            return resolve(res.status(404).json({ error: 'Group not found' }));
          }

          if (!group.isMember(auth.user.id)) {
            return resolve(res.status(403).json({ error: 'Not a member of this group' }));
          }

          // Prepare files data
          const filesData = uploadedFiles.map(file => {
            if (useCloudinary) {
              return {
                url: file.path,
                name: file.originalname,
                type: file.mimetype,
                size: file.size,
                thumbnailUrl: file.mimetype.startsWith('image/') ? file.path : null
              };
            } else {
              return {
                url: `/uploads/groups/${file.filename}`,
                name: file.originalname,
                type: file.mimetype,
                size: file.size,
                thumbnailUrl: file.mimetype.startsWith('image/') ? `/uploads/groups/${file.filename}` : null
              };
            }
          });

          // Create message with files
          const message = await GroupMessage.create({
            groupId,
            sender: auth.user.id,
            text: req.body.text || '',
            files: filesData,
            type: 'file',
            readBy: [{ userId: auth.user.id }]
          });

          await message.populate('sender', 'name image');

          // Update group
          group.stats.lastActivityAt = new Date();
          await group.save();

          // Notify members
          try {
            const otherMembers = group.members
              .filter(m => m.userId.toString() !== auth.user.id)
              .map(m => m.userId);

            const previewText = req.body.text || `📎 ${filesData.length} file${filesData.length > 1 ? 's' : ''}`;
            
            await Promise.all(otherMembers.map(memberId =>
              Notification.create({
                user: memberId,
                type: 'group_message',
                content: {
                  groupId: group._id,
                  groupName: group.name,
                  senderId: auth.user.id,
                  messagePreview: previewText
                },
                read: false
              })
            ));
          } catch (notifError) {
            console.error('Error creating notifications:', notifError);
          }

          resolve(res.status(201).json({
            success: true,
            message: {
              id: message._id,
              sender: {
                id: message.sender._id,
                name: message.sender.name,
                image: message.sender.image
              },
              text: message.text,
              files: message.files,
              type: message.type,
              readBy: message.readBy,
              createdAt: message.createdAt
            }
          }));
        } catch (error) {
          console.error('Error uploading to group:', error);
          resolve(res.status(500).json({ error: 'Failed to upload files' }));
        }
      });
    });
  }

  // POST /api/groups/:groupId/members - Add member (admin only)
  if (basePath.match(/^\/[^/]+\/members$/) && method === 'POST') {
    try {
      const groupId = pathParts[0];
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Check if requester is admin
      const isAdmin = group.admins.some(a => a.toString() === auth.user.id) || 
                     group.creator.toString() === auth.user.id;
      
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Check if user is already a member
      const isMember = group.members.some(m => m.userId.toString() === userId);
      if (isMember) {
        return res.status(400).json({ error: 'User is already a member' });
      }

      // Add member
      group.members.push({ userId, role: 'member' });
      await group.save();

      // Create notification
      try {
        await Notification.create({
          user: userId,
          type: 'group_invite',
          content: {
            groupId: group._id,
            groupName: group.name,
            invitedBy: auth.user.id
          },
          read: false
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }

      return res.json({
        success: true,
        message: 'Member added successfully',
        group
      });
    } catch (error) {
      console.error('Error adding member:', error);
      return res.status(500).json({ error: 'Failed to add member' });
    }
  }

  // DELETE /api/groups/:groupId/members/:userId - Remove member (admin only)
  if (basePath.match(/^\/[^/]+\/members\/[^/]+$/) && method === 'DELETE') {
    try {
      const groupId = pathParts[0];
      const userIdToRemove = pathParts[2];

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Check if requester is admin
      const isAdmin = group.admins.some(a => a.toString() === auth.user.id) || 
                     group.creator.toString() === auth.user.id;
      
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Can't remove creator
      if (group.creator.toString() === userIdToRemove) {
        return res.status(400).json({ error: 'Cannot remove group creator' });
      }

      await group.removeMember(userIdToRemove);

      // Notify removed user
      try {
        await Notification.create({
          user: userIdToRemove,
          type: 'group_removed',
          content: {
            groupId: group._id,
            groupName: group.name,
            removedBy: auth.user.id
          },
          read: false
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }

      return res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      console.error('Error removing member:', error);
      return res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  // PUT /api/groups/:id - Update group (admin only)
  if (basePath.match(/^\/[^/]+$/) && method === 'PUT') {
    return new Promise((resolve) => {
      upload.fields([
        { name: 'coverImage', maxCount: 1 },
        { name: 'icon', maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          return resolve(res.status(400).json({ error: err.message }));
        }

        try {
          const groupId = pathParts[0];
          const group = await Group.findById(groupId);

          if (!group) {
            return resolve(res.status(404).json({ error: 'Group not found' }));
          }

          // Check if requester is admin
          const isAdmin = group.admins.some(a => a.toString() === auth.user.id) || 
                         group.creator.toString() === auth.user.id;
          
          if (!isAdmin) {
            return resolve(res.status(403).json({ error: 'Admin access required' }));
          }

          const { name, description, privacy, location, category, rules, tags } = req.body;

          // Update fields
          if (name) group.name = name.trim();
          if (description !== undefined) group.description = description?.trim();
          if (privacy) group.privacy = privacy;
          if (location !== undefined) group.location = location?.trim();
          if (category) group.category = category;
          if (rules !== undefined) group.rules = rules?.trim();
          if (tags) group.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());

          // Update images if provided
          if (req.files?.coverImage) {
            group.coverImage = useCloudinary 
              ? req.files.coverImage[0].path
              : `/uploads/groups/${req.files.coverImage[0].filename}`;
          }
          if (req.files?.icon) {
            group.icon = useCloudinary
              ? req.files.icon[0].path
              : `/uploads/groups/${req.files.icon[0].filename}`;
          }

          await group.save();

          resolve(res.json({
            success: true,
            group: {
              id: group._id,
              name: group.name,
              description: group.description,
              coverImage: group.coverImage,
              icon: group.icon,
              privacy: group.privacy,
              location: group.location,
              category: group.category,
              rules: group.rules,
              tags: group.tags
            }
          }));
        } catch (error) {
          console.error('Error updating group:', error);
          resolve(res.status(500).json({ error: 'Failed to update group' }));
        }
      });
    });
  }

  // Endpoint not found
  return res.status(404).json({ error: 'Endpoint not found' });
};
