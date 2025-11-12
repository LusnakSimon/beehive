const Conversation = require('../models/Conversation.js');
const Message = require('../models/Message.js');
const Friendship = require('../models/Friendship.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat');
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
    const nameWithoutExt = path.basename(file.originalname, ext);
    const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, safeName + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allowed file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/zip', 'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, PDF, ZIP'));
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
  if (urlPath.startsWith('/api/conversations')) {
    urlPath = urlPath.replace('/api/conversations', '');
  }
  const pathParts = urlPath.split('/').filter(Boolean);
  const basePath = pathParts.length > 0 ? '/' + pathParts.join('/') : '';

  // GET /api/conversations - List all conversations
  if (basePath === '' && method === 'GET') {
    try {
      const conversations = await Conversation.getUserConversations(auth.user.id);
      
      // Calculate unread count for current user
      const conversationsWithUnread = conversations.map(conv => {
        const unreadCount = conv.unreadCount?.get(auth.user.id.toString()) || 0;
        const otherUser = conv.participants.find(p => p._id.toString() !== auth.user.id);
        
        return {
          id: conv._id,
          otherUser: otherUser ? {
            id: otherUser._id,
            name: otherUser.name,
            image: otherUser.image,
            profile: otherUser.profile
          } : null,
          lastMessage: conv.lastMessage,
          unreadCount,
          updatedAt: conv.updatedAt
        };
      });

      return res.json({
        success: true,
        conversations: conversationsWithUnread
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  // POST /api/conversations - Start new conversation
  if (basePath === '' && method === 'POST') {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Can't message yourself
      if (userId === auth.user.id) {
        return res.status(400).json({ error: 'Cannot message yourself' });
      }

      // Check if users are friends
      const areFriends = await Friendship.areFriends(auth.user.id, userId);
      if (!areFriends) {
        return res.status(403).json({ error: 'Can only message friends' });
      }

      // Check if conversation already exists
      let conversation = await Conversation.findBetweenUsers(auth.user.id, userId);
      
      if (conversation) {
        // Populate participants
        await conversation.populate('participants', 'name email image profile');
        
        const otherUser = conversation.participants.find(p => p._id.toString() !== auth.user.id);
        
        return res.json({
          success: true,
          conversation: {
            id: conversation._id,
            otherUser: {
              id: otherUser._id,
              name: otherUser.name,
              image: otherUser.image,
              profile: otherUser.profile
            },
            lastMessage: conversation.lastMessage,
            unreadCount: conversation.unreadCount?.get(auth.user.id.toString()) || 0,
            updatedAt: conversation.updatedAt
          },
          existing: true
        });
      }

      // Create new conversation
      conversation = await Conversation.create({
        participants: [auth.user.id, userId],
        unreadCount: new Map([
          [auth.user.id, 0],
          [userId, 0]
        ])
      });

      await conversation.populate('participants', 'name email image profile');
      
      const otherUser = conversation.participants.find(p => p._id.toString() !== auth.user.id);

      return res.status(201).json({
        success: true,
        conversation: {
          id: conversation._id,
          otherUser: {
            id: otherUser._id,
            name: otherUser.name,
            image: otherUser.image,
            profile: otherUser.profile
          },
          lastMessage: null,
          unreadCount: 0,
          updatedAt: conversation.updatedAt
        },
        existing: false
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({ error: 'Failed to create conversation' });
    }
  }

  // GET /api/conversations/:id - Get single conversation
  if (basePath.match(/^\/[^/]+$/) && method === 'GET') {
    try {
      const conversationId = pathParts[0];
      
      const conversation = await Conversation.findById(conversationId)
        .populate('participants', 'name email image profile');
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Verify user is participant
      if (!conversation.participants.some(p => p._id.toString() === auth.user.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Find the OTHER user (not the current user)
      const otherUser = conversation.participants.find(p => p._id.toString() !== auth.user.id);
      
      console.log('GET conversation - Current user:', auth.user.id);
      console.log('GET conversation - Participants:', conversation.participants.map(p => ({ id: p._id.toString(), name: p.name })));
      console.log('GET conversation - Other user:', otherUser ? { id: otherUser._id.toString(), name: otherUser.name } : 'NOT FOUND');
      
      return res.json({
        success: true,
        conversation: {
          _id: conversation._id,
          participants: conversation.participants,
          otherUser: otherUser,
          lastMessage: conversation.lastMessage,
          unreadCount: conversation.unreadCount?.get(auth.user.id.toString()) || 0,
          updatedAt: conversation.updatedAt
        }
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  }

  // GET /api/conversations/:id/messages - Get messages
  if (basePath.match(/^\/[^/]+\/messages$/) && method === 'GET') {
    try {
      const conversationId = pathParts[0];
      
      // Verify user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (!conversation.participants.some(p => p.toString() === auth.user.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Get messages
      const { limit = 50, before } = req.query;
      const query = {
        conversationId,
        deletedAt: null
      };

      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const messages = await Message.find(query)
        .populate('sender', 'name image')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      return res.json({
        success: true,
        messages: messages.reverse().map(m => ({
          id: m._id,
          sender: {
            id: m.sender._id,
            name: m.sender.name,
            image: m.sender.image
          },
          text: m.text,
          images: m.images,
          type: m.type,
          readBy: m.readBy,
          createdAt: m.createdAt,
          editedAt: m.editedAt
        }))
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // POST /api/conversations/:id/messages - Send message
  if (basePath.match(/^\/[^/]+\/messages$/) && method === 'POST') {
    try {
      const conversationId = pathParts[0];
      const { text, images = [] } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Message text is required' });
      }

      // Verify user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (!conversation.participants.some(p => p.toString() === auth.user.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Create message
      const message = await Message.create({
        conversationId,
        sender: auth.user.id,
        text: text.trim(),
        images,
        type: images.length > 0 ? 'image' : 'text',
        readBy: [auth.user.id]
      });

      // Update conversation
      const otherUserId = conversation.participants.find(p => p.toString() !== auth.user.id).toString();
      const currentUnread = conversation.unreadCount?.get(otherUserId) || 0;
      
      conversation.lastMessage = {
        text: text.trim(),
        sender: auth.user.id,
        timestamp: message.createdAt
      };
      conversation.unreadCount.set(otherUserId, currentUnread + 1);
      conversation.unreadCount.set(auth.user.id, 0);
      
      await conversation.save();

      // Create notification for the recipient (optional, based on their settings)
      try {
        const messagePreview = text.trim().substring(0, 100);
        await Notification.createNewMessage(
          otherUserId,
          auth.user.id,
          conversationId,
          messagePreview
        );
      } catch (notifError) {
        console.error('Error creating new message notification:', notifError);
        // Don't fail the message send if notification creation fails
      }

      // Populate sender
      await message.populate('sender', 'name image');

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
          images: message.images,
          type: message.type,
          readBy: message.readBy,
          createdAt: message.createdAt
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // POST /api/conversations/:id/upload - Upload files
  if (basePath.match(/^\/[^/]+\/upload$/) && method === 'POST') {
    return new Promise((resolve) => {
      upload.array('files', 5)(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
          }
          return res.status(400).json({ error: 'Upload error: ' + err.message });
        } else if (err) {
          return res.status(400).json({ error: err.message });
        }

        try {
          const conversationId = pathParts[0];
          const uploadedFiles = req.files;

          if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
          }

          // Verify user is participant
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
          }

          if (!conversation.participants.some(p => p.toString() === auth.user.id)) {
            return res.status(403).json({ error: 'Not authorized' });
          }

          // Prepare files data
          const filesData = uploadedFiles.map(file => ({
            url: `/uploads/chat/${file.filename}`,
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            thumbnailUrl: file.mimetype.startsWith('image/') ? `/uploads/chat/${file.filename}` : null
          }));

          // Create message with files
          const message = await Message.create({
            conversationId,
            sender: auth.user.id,
            text: req.body.text || '',  // Optional text with files
            files: filesData,
            type: 'file',
            readBy: [auth.user.id]
          });

          // Update conversation
          const otherUserId = conversation.participants.find(p => p.toString() !== auth.user.id).toString();
          const currentUnread = conversation.unreadCount?.get(otherUserId) || 0;
          
          const previewText = req.body.text || `📎 ${filesData.length} file${filesData.length > 1 ? 's' : ''}`;
          conversation.lastMessage = {
            text: previewText,
            sender: auth.user.id,
            timestamp: message.createdAt
          };
          conversation.unreadCount.set(otherUserId, currentUnread + 1);
          conversation.unreadCount.set(auth.user.id, 0);
          
          await conversation.save();

          // Create notification
          try {
            await Notification.createNewMessage(
              otherUserId,
              auth.user.id,
              conversationId,
              previewText
            );
          } catch (notifError) {
            console.error('Error creating file upload notification:', notifError);
          }

          // Populate sender
          await message.populate('sender', 'name image');

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
          console.error('Error uploading files:', error);
          resolve(res.status(500).json({ error: 'Failed to upload files' }));
        }
      });
    });
  }

  // PATCH /api/conversations/:id/read - Mark conversation as read
  if (basePath.match(/^\/[^/]+\/read$/) && method === 'PATCH') {
    try {
      const conversationId = pathParts[0];
      
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (!conversation.participants.some(p => p.toString() === auth.user.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Reset unread count
      conversation.unreadCount.set(auth.user.id, 0);
      await conversation.save();

      // Mark all messages as read
      await Message.updateMany(
        {
          conversationId,
          readBy: { $ne: auth.user.id }
        },
        {
          $addToSet: { readBy: auth.user.id }
        }
      );

      // Also mark related social notifications as read
      await Notification.updateMany(
        {
          user: auth.user.id,
          type: 'new_message',
          'content.conversationId': conversationId,
          read: false
        },
        {
          read: true
        }
      );

      return res.json({
        success: true,
        message: 'Conversation marked as read'
      });
    } catch (error) {
      console.error('Error marking as read:', error);
      return res.status(500).json({ error: 'Failed to mark as read' });
    }
  }

  return res.status(404).json({ error: 'Endpoint not found' });
};
