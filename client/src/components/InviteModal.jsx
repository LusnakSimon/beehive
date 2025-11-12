import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InviteModal.css';

const InviteModal = ({ show, onClose, groupId }) => {
  const [friends, setFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState({});

  useEffect(() => {
    if (show) {
      fetchFriends();
    }
  }, [show]);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get all friends
      const friendsRes = await axios.get('http://localhost:5000/api/users/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Get current group members
      const groupRes = await axios.get(`http://localhost:5000/api/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Filter out users already in the group
      const memberIds = groupRes.data.members.map(m => m._id);
      const availableFriends = friendsRes.data.filter(f => !memberIds.includes(f._id));

      setFriends(availableFriends);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (userId) => {
    setInviting({ ...inviting, [userId]: true });
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/groups/${groupId}/members`,
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Remove invited friend from list
      setFriends(friends.filter(f => f._id !== userId));
      
      alert('Člen bol úspešne pridaný do skupiny!');
    } catch (error) {
      console.error('Error inviting user:', error);
      alert(error.response?.data?.error || 'Nepodarilo sa pridať člena');
    } finally {
      setInviting({ ...inviting, [userId]: false });
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invite-modal-header">
          <h2>Pozvať členov</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="invite-modal-content">
          <input
            type="text"
            className="search-input"
            placeholder="Hľadať priateľov..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="friends-list">
            {loading ? (
              <div className="loading">Načítavam priateľov...</div>
            ) : filteredFriends.length === 0 ? (
              <div className="no-friends">
                {searchTerm ? 'Žiadni priatelia nenájdení' : 'Všetci priatelia sú už v skupine'}
              </div>
            ) : (
              filteredFriends.map((friend) => (
                <div key={friend._id} className="friend-item">
                  <div className="friend-info">
                    <div className="friend-avatar">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="friend-details">
                      <div className="friend-username">{friend.username}</div>
                      <div className="friend-email">{friend.email}</div>
                    </div>
                  </div>
                  <button
                    className="invite-btn"
                    onClick={() => handleInvite(friend._id)}
                    disabled={inviting[friend._id]}
                  >
                    {inviting[friend._id] ? '...' : '+ Pozvať'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="invite-modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
