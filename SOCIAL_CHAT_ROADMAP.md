# Social & Chat Features Roadmap

## 🎯 Cieľ
Vytvoriť sociálnu platformu pre včelárov s priateľskými spojeniami, chatom a komunitnými skupinami.

## 📋 Fáza 1: Základy sociálnych funkcií (Essential)

### 1.1 User Profiles
**Model rozšírenia:**
```javascript
// lib/models/User.js
{
  // Existing fields...
  profile: {
    bio: String,              // "Včelár už 10 rokov, špecializujem sa na..."
    location: String,         // "Žilina, Slovensko"
    experienceYears: Number,  // Koľko rokov včelárenie
    profilePicture: String,   // URL to profile image
    coverPhoto: String,       // URL to cover image
    website: String,
    phone: String,
    isPublic: Boolean,        // Verejný profil?
    showEmail: Boolean,       // Ukázať email na profile?
    showHiveLocations: Boolean
  },
  stats: {
    totalHives: Number,
    publicHives: Number,
    friendsCount: Number,
    groupsCount: Number
  }
}
```

**Stránky:**
- `/profile/:userId` - View user profile
- `/profile/edit` - Edit own profile
- `/users` - Browse all beekeepers (discovery)

### 1.2 Friend Requests System
**Model:**
```javascript
// lib/models/FriendRequest.js
{
  from: ObjectId,          // User who sent request
  to: ObjectId,            // User who receives request
  status: String,          // 'pending', 'accepted', 'rejected'
  message: String,         // Optional message with request
  createdAt: Date,
  respondedAt: Date
}

// lib/models/Friendship.js
{
  user1: ObjectId,
  user2: ObjectId,
  createdAt: Date,
  lastInteraction: Date
}
```

**API Endpoints:**
- `POST /api/friends/request` - Send friend request
- `GET /api/friends/requests` - Get pending requests
- `PATCH /api/friends/requests/:id/accept` - Accept request
- `PATCH /api/friends/requests/:id/reject` - Reject request
- `GET /api/friends` - Get all friends
- `DELETE /api/friends/:userId` - Remove friend

**UI Components:**
- Friend request button (on profile/map)
- Pending requests list
- Friends list
- Accept/Reject buttons

### 1.3 Private 1-on-1 Chat
**Model:**
```javascript
// lib/models/Conversation.js
{
  participants: [ObjectId, ObjectId],  // Always 2 users
  lastMessage: {
    text: String,
    sender: ObjectId,
    timestamp: Date
  },
  unreadCount: {
    user1: Number,
    user2: Number
  },
  createdAt: Date,
  updatedAt: Date
}

// lib/models/Message.js
{
  conversationId: ObjectId,
  sender: ObjectId,
  text: String,
  images: [String],          // URLs to uploaded images
  files: [{                  // File attachments
    url: String,
    name: String,
    type: String,            // MIME type
    size: Number             // File size in bytes
  }],
  type: String,              // 'text', 'image', 'file', 'system'
  readBy: [ObjectId],
  createdAt: Date,
  editedAt: Date,
  deletedAt: Date
}
```

**Technology:**
- WebSocket (Socket.io) for real-time messaging
- OR polling approach (simpler for MVP)
- Message persistence in MongoDB
- **File uploads:** Multer + Cloudinary/AWS S3
- **Supported formats:** Images (jpg, png, gif), Documents (pdf), Archives (zip)

**API Endpoints:**
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Start new conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message
- `POST /api/conversations/:id/upload` - Upload file/image
- `PATCH /api/messages/:id/read` - Mark as read
- `DELETE /api/messages/:id` - Delete message

**UI:**
- `/messages` - Chat inbox (list of conversations)
- `/messages/:conversationId` - Chat window
- **File upload button** - Attach images/files
- **Image preview** - Show thumbnails in chat
- **File download** - Download attached files
- Chat bubble in navbar (unread count)
- Mobile-optimized chat interface// URLs to uploaded images
  type: String,              // 'text', 'image', 'system'
  readBy: [ObjectId],
  createdAt: Date,
  editedAt: Date,
  deletedAt: Date
}
```

**Technology:**
- WebSocket (Socket.io) for real-time messaging
- OR polling approach (simpler for MVP)
- Message persistence in MongoDB

**API Endpoints:**
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Start new conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message
- `PATCH /api/messages/:id/read` - Mark as read
- `DELETE /api/messages/:id` - Delete message

**UI:**
- `/messages` - Chat inbox (list of conversations)
- `/messages/:conversationId` - Chat window
- Chat bubble in navbar (unread count)
- Mobile-optimized chat interface

### 1.4 Notifications System
**Model:**
```javascript
// lib/models/Notification.js
{
  user: ObjectId,
  type: String,  // 'friend_request', 'message', 'group_invite', etc.
  from: ObjectId,
  content: {
    title: String,
    message: String,
    link: String
  },
  read: Boolean,
  createdAt: Date
}
```

**Types:**
- Friend request received
- Friend request accepted
- New message
- Group invitation
- Group message

**UI:**
- Notification bell icon in navbar
- Unread count badge
- Dropdown notification list
- `/notifications` - Full notifications page

---

## 📋 Fáza 2: Komunitné skupiny (Community)

### 2.1 Groups/Teams
**Model:**
```javascript
// lib/models/Group.js
{
  name: String,
  description: String,
  coverImage: String,
  icon: String,
  creator: ObjectId,
  admins: [ObjectId],
  members: [ObjectId],
  privacy: String,      // 'public', 'private', 'secret'
  location: String,     // "Žilina región"
  category: String,     // "Hobbyisti", "Profesionáli", "Začiatočníci"
  rules: String,
  memberCount: Number,
  createdAt: Date,
  stats: {
    messageCount: Number,
    activeMembers: Number
  }
}
```

**Features:**
- Browse/discover groups
- Search groups by location/category
- Join public groups
- Request to join private groups
- Admin approval for private groups

### 2.2 Group Chat
**Model:**
```javascript
// lib/models/GroupConversation.js
{
  groupId: ObjectId,
  messages: [MessageSchema],  // Or separate collection
  pinnedMessages: [ObjectId],
  lastActivity: Date
}
```

**Features:**
- Group chat room
- Member list in sidebar
- Admin can pin messages
- Admin can moderate (delete messages, remove members)
- Mention members with @username

### 2.3 Image Sharing
**Storage:**
- Cloudinary or AWS S3 for image hosting
- Image upload component
- Image gallery view
- Lightbox for full-size viewing

**Features:**
- Upload images in chat (1-on-1 and groups)
- Share hive photos
- Create photo albums in groups
- Image compression/optimization

---

## 📋 Fáza 3: Pokročilé funkcie (Advanced)

### 3.1 Group Invitations
- Invite friends to groups
- Share invite links
- Pending invitations list

### 3.2 Admin Features
- User roles: Admin, Moderator, Member
- Ban/kick members
- Edit group settings
- View member activity
- Announcement mode (only admins can post)

### 3.3 Advanced Notifications
- Email notifications
- Push notifications (PWA)
- Notification preferences/settings
- Mute conversations/groups

### 3.4 Activity Feed
- "Home" page with activity from friends/groups
- Post updates
- Like/comment system
- Share hive updates

---

## 🛠️ Technológie

### Backend:
- **Real-time:** Socket.io alebo polling
- **Storage:** MongoDB collections
- **File upload:** Multer + Cloudinary/S3
- **Auth:** Existing JWT system

### Frontend:
- **State:** React Context (MessagesContext, NotificationsContext)
- **Real-time:** Socket.io client alebo polling hook
- **UI:** Tailwind/existing CSS
- **Components:** Chat bubbles, message input, user cards

### Database Collections:
1. `users` - Extended with profile fields
2. `friendrequests` - Friend request tracking
3. `friendships` - Friend connections
4. `conversations` - 1-on-1 chats
5. `messages` - All messages
6. `groups` - Community groups
7. `groupconversations` - Group chats
8. `notifications` - User notifications

---

## 📱 UI/UX Mockup Ideas

### Map Integration:
```
[Hive Popup on Map]
┌─────────────────────┐
│ 🐝 Košický úľ       │
│ HIVE-002            │
│                     │
│ 👤 Peter Novák      │
│ 📍 Košice           │
│                     │
│ [View Profile]      │
│ [Add Friend] 💬     │
└─────────────────────┘
```

### Navbar with Social:
```
🗺️ Mapa | 💬 Správy (3) | 🔔 (5) | ⚙️ Nastavenia
```

### Messages Page:
```
┌─ Conversations ──────────────┐
│ 🟢 Peter Novák              │
│    Ahoj, ako sa darí tvojim │
│    včielkam?                │
│    14:32                    │
├──────────────────────────────┤
│ 🔴 Ján Včelár               │
│    Ďakujem za radu!         │
│    Včera                    │
└──────────────────────────────┘
```

---

## 🚀 Implementačný plán

### Sprint 1 (Týždeň 1-2): Základy
- [ ] User profile model & API
- [ ] Profile view page
- [ ] Profile edit page
- [ ] Friend request model & API
- [ ] Friend request UI components

### Sprint 2 (Týždeň 3-4): Chat MVP
- [ ] Conversation & Message models
- [ ] Basic chat API (polling-based)
- [ ] Chat inbox UI
- [ ] Chat window UI
- [ ] Send/receive messages
- [ ] File upload component (images)
- [ ] Image preview in chat

### Sprint 3 (Týždeň 5-6): Notifikácie
- [ ] Notification model & API
- [ ] Notification bell UI
- [ ] Real-time updates (polling)
- [ ] Mark as read functionality

### Sprint 4 (Týždeň 7-8): Skupiny
- [ ] Group model & API
- [ ] Group list/discovery page
- [ ] Create group UI
- [ ] Join/leave group
- [ ] Group chat integration

### Sprint 5 (Týždeň 9+): Vylepšenia
- [ ] Image upload
- [ ] Socket.io for real-time
- [ ] Admin features
- [ ] Search & filters
- [ ] Mobile optimization

---

## ✅ Success Metrics

- Počet aktívnych konverzácií
- Priemerný response time na správy
- Počet vytvorených skupín
- Member retention v skupinách
- Friend connection rate
- Daily active users

---

## 🔐 Security Considerations

- Validate all user inputs
- Rate limiting on messages (anti-spam)
- Block/report functionality
- Privacy controls (who can message me?)
- Image content moderation
- GDPR compliance (delete data on request)

---

## 📝 Notes

- Start with polling for MVP (easier than WebSockets)
- Implement WebSockets in Sprint 5 if needed
- Keep messages lightweight (limit text length)
- Consider message retention policy (delete old messages?)
- Add "typing..." indicator in Sprint 5
