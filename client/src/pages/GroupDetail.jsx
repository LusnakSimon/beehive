import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import InviteModal from '../components/InviteModal';
import EditGroupModal from '../components/EditGroupModal';
import './GroupDetail.css';

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${groupId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Skupina nebola nájdená');
        }
        throw new Error('Failed to fetch group');
      }

      const data = await response.json();
      setGroup(data.group);
      setError('');
    } catch (err) {
      console.error('Error fetching group:', err);
      setError(err.message || 'Nepodarilo sa načítať skupinu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchGroup();
  }, [groupId, user]);

  const handleJoin = async () => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/groups/${groupId}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join group');
      }

      const data = await response.json();
      toast.success(data.message);
      
      // Refresh group data
      fetchGroup();
    } catch (err) {
      console.error('Error joining group:', err);
      toast.error(err.message || 'Nepodarilo sa pripojiť k skupine');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Naozaj chcete opustiť túto skupinu?')) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/groups/${groupId}/leave`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to leave group');
      }

      toast.success('Úspešne ste opustili skupinu');
      navigate('/groups');
    } catch (err) {
      console.error('Error leaving group:', err);
      toast.error(err.message || 'Nepodarilo sa opustiť skupinu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Naozaj chcete odstrániť tohto člena zo skupiny?')) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }

      toast.success('Člen bol odstránený zo skupiny');
      fetchGroup();
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error(err.message || 'Nepodarilo sa odstrániť člena');
    }
  };

  const handlePromoteAdmin = async (userId) => {
    if (!confirm('Povýšiť tohto člena na administrátora?')) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to promote member');
      }

      toast.success('Člen bol povýšený na administrátora');
      fetchGroup();
    } catch (err) {
      console.error('Error promoting member:', err);
      toast.error(err.message || 'Nepodarilo sa povýšiť člena');
    }
  };

  const handleDemoteAdmin = async (userId) => {
    if (!confirm('Odobrať administrátorské práva tomuto členovi?')) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/demote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to demote admin');
      }

      toast.success('Administrátorské práva boli odobraté');
      fetchGroup();
    } catch (err) {
      console.error('Error demoting admin:', err);
      toast.error(err.message || 'Nepodarilo sa odobrať administrátorské práva');
    }
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/groups/${groupId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      toast.success('Invite link bol skopírovaný do schránky!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast.error('Nepodarilo sa skopírovať link');
    });
  };

  if (!user) {
    return <div className="loading">Načítavam...</div>;
  }

  if (loading) {
    return <div className="loading">Načítavam skupinu...</div>;
  }

  if (error || !group) {
    return (
      <div className="group-detail-page">
        <div className="group-detail-error">
          <span className="error-icon">⚠️</span>
          <h3>{error || 'Skupina nebola nájdená'}</h3>
          <button className="btn-primary" onClick={() => navigate('/groups')}>
            Späť na skupiny
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-detail-page">
      <div className="group-detail-container">
        {/* Cover Image */}
        <div 
          className="group-detail-cover"
          style={{
            backgroundImage: group.coverImage 
              ? `url(${group.coverImage})` 
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
          }}
        >
          <button className="back-button-overlay" onClick={() => navigate('/groups')}>
            ← Späť
          </button>
          {group.privacy === 'private' && (
            <span className="privacy-badge-overlay">🔒 Súkromná</span>
          )}
          {group.privacy === 'secret' && (
            <span className="privacy-badge-overlay">🔐 Tajná</span>
          )}
        </div>

        {/* Group Header */}
        <div className="group-detail-header">
          <div className="group-header-left">
            {group.icon ? (
              <img src={group.icon} alt={group.name} className="group-detail-icon" />
            ) : (
              <div className="group-detail-icon-placeholder">
                {group.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="group-header-info">
              <h1>{group.name}</h1>
              <div className="group-meta-row">
                <span className="meta-item">👥 {group.stats.memberCount} členov</span>
                {group.location && <span className="meta-item">📍 {group.location}</span>}
                <span className="meta-item">📂 {group.category}</span>
              </div>
            </div>
          </div>

          <div className="group-header-actions">
            {group.isMember && (
              <button
                className="btn-chat"
                onClick={() => navigate(`/groups/${groupId}/chat`)}
              >
                💬 Chat
              </button>
            )}
            
            {!group.isMember && !group.isCreator && (
              <button
                className="btn-join"
                onClick={handleJoin}
                disabled={actionLoading}
              >
                {group.privacy === 'private' ? '🔒 Požiadať o vstup' : '✓ Pripojiť sa'}
              </button>
            )}
            
            {group.isMember && !group.isCreator && (
              <button
                className="btn-leave"
                onClick={handleLeave}
                disabled={actionLoading}
              >
                Opustiť skupinu
              </button>
            )}

            {group.isCreator && (
              <span className="creator-badge">👑 Zakladateľ</span>
            )}
            
            {group.isAdmin && !group.isCreator && (
              <span className="admin-badge">⭐ Administrátor</span>
            )}
          </div>
        </div>

        {/* Description */}
        {group.description && (
          <div className="group-section">
            <h2>O skupine</h2>
            <p className="group-description-text">{group.description}</p>
          </div>
        )}

        {/* Rules */}
        {group.rules && (
          <div className="group-section">
            <h2>Pravidlá</h2>
            <p className="group-rules-text">{group.rules}</p>
          </div>
        )}

        {/* Tags */}
        {group.tags && group.tags.length > 0 && (
          <div className="group-section">
            <h2>Tagy</h2>
            <div className="group-tags">
              {group.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        {group.members && group.members.length > 0 && (
          <div className="group-section">
            <h2>Členovia ({group.members.length})</h2>
            <div className="members-grid">
              {group.members.slice(0, 12).map(member => {
                // Normalize IDs for comparison
                const memberId = member.user?.id?.toString() || member.user?._id?.toString();
                const creatorId = group.creator?.id?.toString() || group.creator?._id?.toString();
                const isCreator = memberId === creatorId;
                const isAdmin = group.admins?.some(a => {
                  const adminId = a.id?.toString() || a._id?.toString();
                  return adminId === memberId;
                });
                
                return (
                  <div 
                    key={memberId} 
                    className="member-card"
                  >
                    <img 
                      src={member.user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.name)}&background=3b82f6&color=fff&size=128`}
                      alt={member.user.name}
                      className="member-avatar"
                      onClick={() => navigate(`/profile/${memberId}`)}
                    />
                    <div className="member-info">
                      <div 
                        className="member-name"
                        onClick={() => navigate(`/profile/${memberId}`)}
                      >
                        {member.user.name}
                      </div>
                      <div className="member-badges">
                        {isCreator && (
                          <span className="member-badge creator">👑 Zakladateľ</span>
                        )}
                        {isAdmin && !isCreator && (
                          <span className="member-badge admin">⭐ Admin</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Admin actions - only for creator */}
                    {group.isCreator && !isCreator && (
                      <div className="member-actions">
                        {isAdmin ? (
                          <button 
                            className="action-btn demote"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDemoteAdmin(memberId);
                            }}
                            title="Odobrať admin práva"
                          >
                            ⬇️
                          </button>
                        ) : (
                          <button 
                            className="action-btn promote"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePromoteAdmin(memberId);
                            }}
                            title="Povýšiť na admina"
                          >
                            ⬆️
                          </button>
                        )}
                        <button 
                          className="action-btn remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(memberId);
                          }}
                          title="Vyhodiť zo skupiny"
                        >
                          🚫
                        </button>
                      </div>
                    )}
                    
                    {/* Admins can only remove non-creator members */}
                    {group.isAdmin && !group.isCreator && !isCreator && (
                      <div className="member-actions">
                        <button 
                          className="action-btn remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(memberId);
                          }}
                          title="Vyhodiť zo skupiny"
                        >
                          🚫
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {group.members.length > 12 && (
              <p className="members-more">+ ďalších {group.members.length - 12} členov</p>
            )}
          </div>
        )}

        {/* Admin Panel */}
        {group.isAdmin && (
          <div className="group-section admin-section">
            <h2>⚙️ Administrácia</h2>
            
            <div className="admin-actions">
              <button 
                className="admin-btn"
                onClick={() => setShowInviteModal(true)}
              >
                ➕ Pozvať členov
              </button>
              
              <button 
                className="admin-btn"
                onClick={() => setShowEditModal(true)}
              >
                ✏️ Upraviť skupinu
              </button>
              
              <button 
                className="admin-btn share-btn"
                onClick={handleCopyInviteLink}
              >
                🔗 Kopírovať invite link
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteModal 
        show={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        groupId={groupId}
      />

      {/* Edit Group Modal */}
      <EditGroupModal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        group={group}
        onSuccess={(updatedGroup) => {
          setGroup(updatedGroup);
          fetchGroup(); // Refresh group data
        }}
      />
    </div>
  );
};

export default GroupDetail;
