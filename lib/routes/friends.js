import { authMiddleware } from '../middleware/auth.js';
import FriendRequest from '../models/FriendRequest.js';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  const auth = await authMiddleware(req);
  const { method } = req;
  
  // All friend endpoints require authentication
  if (!auth.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pathParts = req.url.replace('/api/friends', '').split('/').filter(Boolean);
  const basePath = '/' + pathParts.join('/');

  // POST /api/friends/request - Send friend request
  if (basePath === '/request' && method === 'POST') {
    try {
      const { toUserId, message } = req.body;

      if (!toUserId) {
        return res.status(400).json({ error: 'toUserId is required' });
      }

      // Can't send request to self
      if (toUserId === auth.user.id) {
        return res.status(400).json({ error: 'Cannot send friend request to yourself' });
      }

      // Check if target user exists
      const targetUser = await User.findById(toUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already friends
      const areFriends = await Friendship.areFriends(auth.user.id, toUserId);
      if (areFriends) {
        return res.status(400).json({ error: 'Already friends with this user' });
      }

      // Check for existing pending request
      const existingRequest = await FriendRequest.findOne({
        $or: [
          { from: auth.user.id, to: toUserId, status: 'pending' },
          { from: toUserId, to: auth.user.id, status: 'pending' }
        ]
      });

      if (existingRequest) {
        return res.status(400).json({ error: 'Friend request already exists' });
      }

      // Create friend request
      const friendRequest = await FriendRequest.create({
        from: auth.user.id,
        to: toUserId,
        message: message || ''
      });

      await friendRequest.populate('from to', 'name email image');

      return res.status(201).json({
        success: true,
        friendRequest
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      return res.status(500).json({ error: 'Failed to send friend request' });
    }
  }

  // GET /api/friends/requests - Get friend requests (incoming/outgoing)
  if (basePath === '/requests' && method === 'GET') {
    try {
      const { type = 'incoming' } = req.query;

      let query;
      if (type === 'incoming') {
        query = { to: auth.user.id, status: 'pending' };
      } else if (type === 'outgoing') {
        query = { from: auth.user.id, status: 'pending' };
      } else {
        return res.status(400).json({ error: 'Invalid type. Use incoming or outgoing' });
      }

      const requests = await FriendRequest.find(query)
        .populate('from to', 'name email image profile')
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        requests
      });
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      return res.status(500).json({ error: 'Failed to fetch friend requests' });
    }
  }

  // PATCH /api/friends/requests/:id/accept - Accept friend request
  if (basePath.match(/^\/requests\/[^/]+\/accept$/) && method === 'PATCH') {
    try {
      const requestId = pathParts[1];
      
      const friendRequest = await FriendRequest.findById(requestId);
      if (!friendRequest) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      // Only the recipient can accept
      if (friendRequest.to.toString() !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized to accept this request' });
      }

      if (friendRequest.status !== 'pending') {
        return res.status(400).json({ error: 'Friend request already processed' });
      }

      // Update request status
      friendRequest.status = 'accepted';
      await friendRequest.save();

      // Create friendship
      await Friendship.create({
        user1: friendRequest.from,
        user2: friendRequest.to
      });

      // Update stats for both users
      await User.findByIdAndUpdate(friendRequest.from, {
        $inc: { 'stats.friendsCount': 1 }
      });
      await User.findByIdAndUpdate(friendRequest.to, {
        $inc: { 'stats.friendsCount': 1 }
      });

      return res.json({
        success: true,
        message: 'Friend request accepted'
      });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return res.status(500).json({ error: 'Failed to accept friend request' });
    }
  }

  // PATCH /api/friends/requests/:id/reject - Reject friend request
  if (basePath.match(/^\/requests\/[^/]+\/reject$/) && method === 'PATCH') {
    try {
      const requestId = pathParts[1];
      
      const friendRequest = await FriendRequest.findById(requestId);
      if (!friendRequest) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      // Only the recipient can reject
      if (friendRequest.to.toString() !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized to reject this request' });
      }

      if (friendRequest.status !== 'pending') {
        return res.status(400).json({ error: 'Friend request already processed' });
      }

      // Update request status
      friendRequest.status = 'rejected';
      await friendRequest.save();

      return res.json({
        success: true,
        message: 'Friend request rejected'
      });
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      return res.status(500).json({ error: 'Failed to reject friend request' });
    }
  }

  // DELETE /api/friends/requests/:id - Cancel/delete friend request
  if (basePath.match(/^\/requests\/[^/]+$/) && method === 'DELETE') {
    try {
      const requestId = pathParts[1];
      
      const friendRequest = await FriendRequest.findById(requestId);
      if (!friendRequest) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      // Only the sender can cancel
      if (friendRequest.from.toString() !== auth.user.id) {
        return res.status(403).json({ error: 'Not authorized to delete this request' });
      }

      await friendRequest.deleteOne();

      return res.json({
        success: true,
        message: 'Friend request cancelled'
      });
    } catch (error) {
      console.error('Error deleting friend request:', error);
      return res.status(500).json({ error: 'Failed to delete friend request' });
    }
  }

  // GET /api/friends - Get all friends
  if (basePath === '' && method === 'GET') {
    try {
      const friends = await Friendship.getFriends(auth.user.id);

      return res.json({
        success: true,
        friends
      });
    } catch (error) {
      console.error('Error fetching friends:', error);
      return res.status(500).json({ error: 'Failed to fetch friends' });
    }
  }

  // DELETE /api/friends/:userId - Remove friendship
  if (basePath.match(/^\/[^/]+$/) && method === 'DELETE') {
    try {
      const friendUserId = pathParts[0];

      const [smaller, larger] = [auth.user.id, friendUserId].sort();
      const friendship = await Friendship.findOneAndDelete({
        user1: smaller,
        user2: larger
      });

      if (!friendship) {
        return res.status(404).json({ error: 'Friendship not found' });
      }

      // Update stats for both users
      await User.findByIdAndUpdate(auth.user.id, {
        $inc: { 'stats.friendsCount': -1 }
      });
      await User.findByIdAndUpdate(friendUserId, {
        $inc: { 'stats.friendsCount': -1 }
      });

      return res.json({
        success: true,
        message: 'Friendship removed'
      });
    } catch (error) {
      console.error('Error removing friendship:', error);
      return res.status(500).json({ error: 'Failed to remove friendship' });
    }
  }

  // GET /api/friends/status/:userId - Check friendship status with user
  if (basePath.match(/^\/status\/[^/]+$/) && method === 'GET') {
    try {
      const targetUserId = pathParts[1];

      // Check if friends
      const areFriends = await Friendship.areFriends(auth.user.id, targetUserId);
      if (areFriends) {
        return res.json({ status: 'friends' });
      }

      // Check for pending request
      const pendingRequest = await FriendRequest.findOne({
        $or: [
          { from: auth.user.id, to: targetUserId, status: 'pending' },
          { from: targetUserId, to: auth.user.id, status: 'pending' }
        ]
      });

      if (pendingRequest) {
        const isSender = pendingRequest.from.toString() === auth.user.id;
        return res.json({
          status: 'pending',
          direction: isSender ? 'outgoing' : 'incoming',
          requestId: pendingRequest._id
        });
      }

      return res.json({ status: 'none' });
    } catch (error) {
      console.error('Error checking friendship status:', error);
      return res.status(500).json({ error: 'Failed to check friendship status' });
    }
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
