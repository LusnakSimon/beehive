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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const hasMarkedRead = useRef(false);
  const fileInputRef = useRef(null);

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
        // Handle both user.id and user._id
        const currentUserId = user?.id || user?._id;
        const other = data.conversation.participants.find(p => {
          const participantId = p._id?.toString() || p.id?.toString();
          return participantId !== currentUserId;
        });
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
      
      // Deduplicate messages by ID (in case we added one optimistically)
      setMessages(prevMessages => {
        const newMessages = data.messages;
        const existingIds = new Set(prevMessages.map(m => m.id || m._id));
        const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id || m._id));
        
        // If we have new messages, merge them and mark as read
        if (uniqueNewMessages.length > 0) {
          // Mark as read when new messages arrive (if page is visible)
          if (!document.hidden) {
            markAsRead();
          }
          return [...prevMessages, ...uniqueNewMessages];
        }
        
        // If message count is different, replace entirely (might have deletions)
        if (newMessages.length !== prevMessages.length) {
          return newMessages;
        }
        
        // Otherwise keep existing messages to avoid re-render
        return prevMessages;
      });
      
      setLoading(false);
      
      // Scroll to bottom on first load or new messages
      setTimeout(scrollToBottom, 100);

      // Mark messages as read on initial load
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
    
    // Allow sending if there's text OR files
    if ((!messageText.trim() && selectedFiles.length === 0) || sending || uploading) return;

    const trimmedText = messageText.trim();
    if (trimmedText.length > 5000) {
      setError('Správa je príliš dlhá (max 5000 znakov)');
      return;
    }

    // If files are selected, upload them first
    if (selectedFiles.length > 0) {
      await uploadFiles(trimmedText);
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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) {
      setError('Môžete nahrať maximálne 5 súborov naraz');
      return;
    }

    // Validate file size (10MB max per file)
    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('Niektoré súbory presahujú limit 10MB');
      return;
    }

    setSelectedFiles(files);
    setError('');
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (text = '') => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      if (text) {
        formData.append('text', text);
      }

      const response = await fetch(`/api/conversations/${conversationId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload files');
      }

      const data = await response.json();
      
      // Add new message to list
      setMessages(prev => [...prev, data.message]);
      setMessageText('');
      setSelectedFiles([]);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Update conversation
      if (conversation) {
        setConversation({
          ...conversation,
          lastMessage: {
            text: text || `📎 ${selectedFiles.length} súbor${selectedFiles.length > 1 ? 'y' : ''}`,
            sender: user._id,
            timestamp: new Date()
          }
        });
      }

      // Notify other components
      window.dispatchEvent(new CustomEvent('messagesRead'));
      
      scrollToBottom();
    } catch (err) {
      console.error('Error uploading files:', err);
      setError(err.message || 'Nepodarilo sa nahrať súbory');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchConversation();
    fetchMessages();

    // Poll for new messages every 5 seconds
    pollIntervalRef.current = setInterval(fetchMessages, 5000);

    // Handle page visibility change - mark as read when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to tab, mark messages as read
        markAsRead();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
                
                // Debug first message AND any message from current user
                if (index === 0 || isOwn) {
                  console.log(`=== MESSAGE ${index} DEBUG ===`);
                  console.log('Message comparison:', {
                    messageIndex: index,
                    senderId,
                    currentUserId,
                    isOwn,
                    result: senderId === currentUserId ? 'MATCH (own)' : 'NO MATCH (other)',
                    senderName: message.sender?.name || 'unknown',
                    messageText: message.text?.substring(0, 30) + '...'
                  });
                  console.log('Message element will have class:', isOwn ? 'message own' : 'message other');
                  console.log('CSS should align:', isOwn ? 'flex-end (RIGHT)' : 'flex-start (LEFT)');
                  console.log('========================');
                }
                
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
                    data-is-own={isOwn}
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
                        {message.text && <p className="message-text">{message.text}</p>}
                        
                        {/* Display files */}
                        {message.files && message.files.length > 0 && (
                          <div className="message-files">
                            {message.files.map((file, fileIndex) => (
                              <div key={fileIndex} className="message-file">
                                {file.type.startsWith('image/') ? (
                                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                                    <img 
                                      src={file.thumbnailUrl || file.url} 
                                      alt={file.name}
                                      className="message-image"
                                    />
                                  </a>
                                ) : (
                                  <a 
                                    href={file.url} 
                                    download={file.name}
                                    className="file-download"
                                  >
                                    <span className="file-icon">
                                      {file.type === 'application/pdf' ? '📄' : '📎'}
                                    </span>
                                    <div className="file-info">
                                      <span className="file-name">{file.name}</span>
                                      <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <span className="download-icon">⬇️</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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
          
          {/* File preview */}
          {selectedFiles.length > 0 && (
            <div className="selected-files-preview">
              {selectedFiles.map((file, index) => (
                <div key={index} className="selected-file">
                  {file.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className="preview-image"
                    />
                  ) : (
                    <div className="preview-file">
                      <span className="preview-icon">
                        {file.type === 'application/pdf' ? '📄' : '📎'}
                      </span>
                      <span className="preview-name">{file.name}</span>
                    </div>
                  )}
                  <button 
                    type="button"
                    className="remove-file"
                    onClick={() => removeFile(index)}
                    title="Odstrániť súbor"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="message-input-wrapper">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,.pdf,.zip"
              multiple
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="attach-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              title="Priložiť súbory"
            >
              📎
            </button>
            
            <div className="message-input-container">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={selectedFiles.length > 0 ? "Pridať popis..." : "Napíšte správu..."}
                className="message-input"
                rows="1"
                maxLength="5000"
                disabled={sending || uploading}
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
              disabled={(!messageText.trim() && selectedFiles.length === 0) || sending || uploading}
              title={uploading ? 'Nahrávam...' : sending ? 'Odosielam...' : 'Odoslať správu'}
            >
              {uploading ? '⏳' : sending ? '⏳' : '➤'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat;
