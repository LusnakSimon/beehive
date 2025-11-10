import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Chat.css';

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const hasMarkedRead = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Konverzácia nebola nájdená');
        } else if (response.status === 403) {
          setError('Nemáte prístup k tejto konverzácii');
        }
        throw new Error('Failed to fetch conversation');
      }

      const data = await response.json();
      setConversation(data.conversation);
      
      // Use otherUser from API response (already filtered by backend)
      if (data.conversation.otherUser) {
        setOtherUser(data.conversation.otherUser);
      } else {
        // Fallback: find the other user manually
        const other = data.conversation.participants.find(p => p._id.toString() !== user._id.toString());
        setOtherUser(other);
      }
      
      console.log('Fetched conversation - otherUser:', data.conversation.otherUser);
    } catch (err) {
      console.error('Error fetching conversation:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages?limit=100`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      setMessages(data.messages);
      setLoading(false);
      
      // Scroll to bottom on first load or new messages
      setTimeout(scrollToBottom, 100);

      // Mark messages as read (only once on mount)
      if (!hasMarkedRead.current) {
        hasMarkedRead.current = true;
        markAsRead();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/read`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Trigger navigation update by dispatching custom event
        window.dispatchEvent(new CustomEvent('messagesRead'));
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || sending) return;

    const trimmedText = messageText.trim();
    if (trimmedText.length > 5000) {
      setError('Správa je príliš dlhá (max 5000 znakov)');
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: trimmedText })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      // Add new message to list
      setMessages(prev => [...prev, data.message]);
      setMessageText('');
      
      // Update conversation lastMessage
      if (conversation) {
        setConversation({
          ...conversation,
          lastMessage: {
            text: trimmedText,
            sender: user._id,
            timestamp: new Date()
          }
        });
      }

      // Notify other components about new message
      window.dispatchEvent(new CustomEvent('messagesRead'));
      
      scrollToBottom();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Nepodarilo sa odoslať správu');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchConversation();
    fetchMessages();

    // Poll for new messages every 5 seconds
    pollIntervalRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [conversationId, user]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'práve teraz';
    if (diffMins < 60) return `pred ${diffMins} min`;
    if (diffHours < 24) return `pred ${diffHours} h`;
    if (diffDays === 1) return 'včera';
    if (diffDays < 7) return `pred ${diffDays} dňami`;
    
    return date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' });
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const timeStr = date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === today.toDateString()) {
      return timeStr;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Včera ${timeStr}`;
    } else {
      return `${date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' })} ${timeStr}`;
    }
  };

  if (!user) {
    return <div className="loading">Načítavam...</div>;
  }

  if (error && !conversation) {
    return (
      <div className="chat-page">
        <div className="chat-error">
          <span className="error-icon">⚠️</span>
          <h3>{error}</h3>
          <button className="btn-primary" onClick={() => navigate('/messages')}>
            Späť na správy
          </button>
        </div>
      </div>
    );
  }

  if (!conversation || !otherUser) {
    return <div className="loading">Načítavam konverzáciu...</div>;
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <button className="back-button" onClick={() => navigate('/messages')}>
            <span className="back-arrow">←</span>
          </button>
          <img 
            src={otherUser.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name)}&background=fbbf24&color=fff&size=128`} 
            alt={otherUser.name}
            className="chat-user-avatar"
          />
          <div className="chat-user-info">
            <h2>{otherUser.name}</h2>
            {otherUser.profile?.location && (
              <span className="user-location">📍 {otherUser.profile.location}</span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="messages-area">
          {loading ? (
            <div className="loading">Načítavam správy...</div>
          ) : messages.length === 0 ? (
            <div className="no-messages">
              <span className="no-messages-icon">💬</span>
              <p>Zatiaľ žiadne správy</p>
              <p className="no-messages-hint">Napíšte prvú správu pre začatie konverzácie</p>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((message, index) => {
                // API returns sender.id (not sender._id) and message.id (not message._id)
                const senderId = message.sender?.id || message.sender?._id || message.sender;
                const currentUserId = user?.id || user?._id;
                const isOwn = senderId === currentUserId;
                
                const prevSenderId = index > 0 
                  ? (messages[index - 1].sender?.id || messages[index - 1].sender?._id || messages[index - 1].sender)
                  : null;
                const nextSenderId = index < messages.length - 1
                  ? (messages[index + 1].sender?.id || messages[index + 1].sender?._id || messages[index + 1].sender)
                  : null;
                
                const showAvatar = index === 0 || prevSenderId !== senderId;
                const showTimestamp = index === messages.length - 1 || 
                  nextSenderId !== senderId ||
                  (messages[index + 1] && (new Date(messages[index + 1].createdAt) - new Date(message.createdAt)) > 300000); // 5 min
                
                return (
                  <div 
                    key={message.id || message._id} 
                    className={`message ${isOwn ? 'own' : 'other'}`}
                  >
                    {!isOwn && showAvatar && (
                      <img 
                        src={otherUser.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name)}&background=fbbf24&color=fff&size=128`} 
                        alt={otherUser.name}
                        className="message-avatar"
                      />
                    )}
                    {!isOwn && !showAvatar && <div className="message-avatar-spacer" />}
                    
                    <div className="message-content">
                      <div className="message-bubble">
                        <p className="message-text">{message.text}</p>
                      </div>
                      {showTimestamp && (
                        <span className="message-time">{formatMessageTime(message.createdAt)}</span>
                      )}
                    </div>

                    {isOwn && showAvatar && (
                      <img 
                        src={user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff&size=128`} 
                        alt={user.name}
                        className="message-avatar"
                      />
                    )}
                    {isOwn && !showAvatar && <div className="message-avatar-spacer" />}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <form className="message-input-area" onSubmit={sendMessage}>
          {error && <div className="input-error">⚠️ {error}</div>}
          <div className="message-input-wrapper">
            <div className="message-input-container">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Napíšte správu..."
                className="message-input"
                rows="1"
                maxLength="5000"
                disabled={sending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />
              <div className="input-footer">
                <span className="char-count">
                  {messageText.length}/5000
                </span>
              </div>
            </div>
            <button 
              type="submit" 
              className="send-button"
              disabled={!messageText.trim() || sending}
              title={sending ? 'Odosielam...' : 'Odoslať správu'}
            >
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat;
