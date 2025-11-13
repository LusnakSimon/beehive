const Notification = require('../models/Notification.js');
const User = require('../models/User.js');
const jwt = require('jsonwebtoken');

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
  if (urlPath.startsWith('/api/social-notifications')) {
    urlPath = urlPath.replace('/api/social-notifications', '');
  }
  const pathParts = urlPath.split('/').filter(Boolean);

  // GET /api/social-notifications - Get all notifications for user
  if (pathParts.length === 0 && method === 'GET') {
    try {
      const { limit = 50, unreadOnly = 'false' } = req.query;
      
      const query = { user: auth.user.id };
      if (unreadOnly === 'true') {
        query.read = false;
      }

      const notifications = await Notification.find(query)
        .populate('from', 'name image')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      const unreadCount = await Notification.getUnreadCount(auth.user.id);

      return res.json({
        success: true,
        notifications,
        unreadCount
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  // GET /api/social-notifications/unread-count - Get only unread count
  if (pathParts[0] === 'unread-count' && method === 'GET') {
    try {
      const unreadCount = await Notification.getUnreadCount(auth.user.id);
      return res.json({
        success: true,
        unreadCount
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  }

  // PATCH /api/social-notifications/:id/read - Mark notification as read
  if (pathParts.length === 2 && pathParts[1] === 'read' && method === 'PATCH') {
    try {
      const notificationId = pathParts[0];
      
      const notification = await Notification.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      // Verify ownership
      if (notification.user.toString() !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await notification.markAsRead();

      return res.json({
        success: true,
        notification
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  }

  // PATCH /api/social-notifications/mark-all-read - Mark all notifications as read
  if (pathParts[0] === 'mark-all-read' && method === 'PATCH') {
    try {
      await Notification.updateMany(
        { user: auth.user.id, read: false },
        { read: true }
      );

      return res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      return res.status(500).json({ error: 'Failed to mark all as read' });
    }
  }

  // DELETE /api/social-notifications/:id - Delete notification
  if (pathParts.length === 1 && method === 'DELETE') {
    try {
      const notificationId = pathParts[0];
      
      const notification = await Notification.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      // Verify ownership
      if (notification.user.toString() !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await Notification.findByIdAndDelete(notificationId);

      return res.json({
        success: true,
        message: 'Notification deleted'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({ error: 'Failed to delete notification' });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
