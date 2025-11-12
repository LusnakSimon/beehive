const Group = require('../models/Group.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure Multer for group images
const storage = multer.diskStorage({
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

          // Add uploaded images
          if (req.files?.coverImage) {
            groupData.coverImage = `/uploads/groups/${req.files.coverImage[0].filename}`;
          }
          if (req.files?.icon) {
            groupData.icon = `/uploads/groups/${req.files.icon[0].filename}`;
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

  // Endpoint not found
  return res.status(404).json({ error: 'Endpoint not found' });
};
