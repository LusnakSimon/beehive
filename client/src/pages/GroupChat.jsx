import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './GroupChat.css';

function GroupChat() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchGroupAndMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchGroupAndMessages = async () => {
    try {
      const [groupRes, messagesRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`, {
          credentials: 'include'
        }),
        fetch(`/api/groups/${groupId}/messages?limit=100`, {
          credentials: 'include'
        })
      ]);

      if (groupRes.ok) {
        const groupData = await groupRes.json();
        setGroup(groupData.group);
      }

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData.messages);
      }
    } catch (error) {
      console.error('Error fetching group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/messages?limit=100`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || sending) return;

    setSending(true);

    try {
      if (selectedFiles.length > 0) {
        // Send files
        const formData = new FormData();
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
        if (newMessage.trim()) {
          formData.append('text', newMessage.trim());
        }

        const response = await fetch(`/api/groups/${groupId}/messages/upload`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        if (response.ok) {
          setNewMessage('');
          setSelectedFiles([]);
          fetchMessages();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to send files');
        }
      } else {
        // Send text message
        const response = await fetch(`/api/groups/${groupId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ text: newMessage.trim() })
        });

        if (response.ok) {
          setNewMessage('');
          fetchMessages();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to send message');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files].slice(0, 5));
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('sk-SK', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Dnes';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Včera';
    } else {
      return messageDate.toLocaleDateString('sk-SK', {
        day: 'numeric',
        month: 'long'
      });
    }
  };

  const groupMessagesByDate = (messages) => {
    const grouped = {};
    messages.forEach(msg => {
      const date = new Date(msg.createdAt).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(msg);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="group-chat-container">
        <div className="loading-state">Načítavam...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="group-chat-container">
        <div className="error-state">Skupina nebola nájdená</div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="group-chat-container">
      <div className="group-chat-wrapper">
        {/* Header */}
        <div className="group-chat-header">
          <button className="back-button" onClick={() => navigate(`/groups/${groupId}`)}>
            ←
          </button>
          <div className="group-header-info">
            {group.icon && <img src={group.icon} alt={group.name} className="group-icon-small" />}
            <div>
              <h2>{group.name}</h2>
              <p>{group.memberCount} členov</p>
            </div>
          </div>
          <button 
            className="members-toggle"
            onClick={() => setShowMembers(!showMembers)}
          >
            👥 Členovia
          </button>
        </div>

        <div className="group-chat-content">
        {/* Messages */}
        <div className="group-messages-container">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="empty-messages">
              <p>Zatiaľ žiadne správy</p>
              <p>Buď prvý kto napíše do skupiny!</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="date-separator">
                  {formatDate(msgs[0].createdAt)}
                </div>
                {msgs.map((message) => {
                  const isOwn = message.sender.id === currentUser?._id || message.sender._id === currentUser?._id;
                  return (
                    <div key={message.id} className={`group-message ${isOwn ? 'own' : 'other'}`}>
                      {!isOwn && (
                        <img 
                          src={message.sender.image || '/default-avatar.png'} 
                          alt={message.sender.name}
                          className="message-avatar"
                        />
                      )}
                      <div className="message-content">
                        {!isOwn && (
                          <div className="message-header">
                            <span className="sender-name">{message.sender.name}</span>
                          </div>
                        )}
                        {message.text && (
                          <div className="message-bubble">
                            <p className="message-text">{message.text}</p>
                            <span className="message-time">{formatTime(message.createdAt)}</span>
                          </div>
                        )}
                        {message.files && message.files.length > 0 && (
                          <div className="message-files">
                            {message.files.map((file, idx) => (
                              <div key={idx} className="file-item">
                                {file.type.startsWith('image/') ? (
                                  <img src={file.url} alt={file.name} className="file-image" />
                                ) : (
                                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="file-link">
                                    📎 {file.name}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {isOwn && (
                        <img 
                          src={currentUser?.image || '/default-avatar.png'} 
                          alt={currentUser?.name}
                          className="message-avatar"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Members Sidebar */}
        {showMembers && (
          <div className="members-sidebar">
            <h3>Členovia ({group.members.length})</h3>
            <div className="members-list">
              {group.members.map((member) => (
                <div key={member.user.id} className="member-item">
                  <img 
                    src={member.user.image || '/default-avatar.png'} 
                    alt={member.user.name}
                    className="member-avatar"
                  />
                  <div className="member-info">
                    <span className="member-name">{member.user.name}</span>
                    {group.creator.id === member.user.id && (
                      <span className="member-badge">Zakladateľ</span>
                    )}
                    {group.admins.some(a => a.id === member.user.id) && (
                      <span className="member-badge admin">Admin</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      <form className="message-input-form" onSubmit={handleSendMessage}>
        {selectedFiles.length > 0 && (
          <div className="selected-files-preview">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="file-preview">
                <span>{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="input-row">
          <button
            type="button"
            className="attach-button"
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,application/pdf,.doc,.docx"
            style={{ display: 'none' }}
          />
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Napíš správu..."
            className="message-input"
          />
          <button 
            type="submit" 
            className="send-button"
            disabled={sending || (!newMessage.trim() && selectedFiles.length === 0)}
          >
            {sending ? '...' : '➤'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

export default GroupChat;
