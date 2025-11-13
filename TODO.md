# TODO List - Beehive Monitor

## Priority Issues (API Endpoints Not Found - 404/500 errors)

### 1. Group Chat File Upload
- **Status**: ❌ Not Working
- **Error**: `POST /api/groups/:id/messages/upload` returns 500
- **Issue**: Endpoint exists but regex matching fails or multer configuration issue
- **Location**: `lib/routes/groups.js` line 638-700
- **Debug**: Added logging in commit c05ab22
- **Action Needed**: Check Vercel logs, verify URL parsing and multer setup

### 2. Group Read Status
- **Status**: ❌ Not Working  
- **Error**: `POST /api/groups/:id/read` returns 404
- **Issue**: Endpoint may be missing or routing broken
- **Location**: Should be in `lib/routes/groups.js`
- **Action Needed**: Implement endpoint to mark group messages as read

### 3. Notification Condition Checking
- **Status**: ❌ Not Working
- **Error**: `POST /api/notifications/check?hiveId=HIVE-002` returns 404
- **Issue**: Endpoint returns HTML page instead of JSON ("The page c..." not valid JSON)
- **Location**: Should be in `api/notifications/` or similar
- **Action Needed**: Create endpoint or fix routing for notification condition checking

## Completed Features ✓

### Social Chat System
- ✅ 1-on-1 Direct Messaging
- ✅ Group Chats with Members Management
- ✅ Admin System (Creator → Admin → Member hierarchy)
- ✅ Member Management (Promote/Demote/Kick)
- ✅ Friend System (Add/Remove/Accept)
- ✅ Dark Mode Support (Complete app-wide)
- ✅ Responsive Design (Mobile + Desktop)
- ✅ Real-time Message Updates (polling every 3s)
- ✅ Avatar Click Navigation to Profiles
- ✅ Proper Message Layout (Own right, Others left)
- ✅ Notification Badges (with mark as read for 1-on-1)
- ✅ Profile Dark Mode Fixed

### UI/UX Improvements
- ✅ Desktop Rounded Corners for Chat Containers
- ✅ Mobile Padding Optimization (GroupChat 160px, Chat 70px)
- ✅ Input Field Positioning (Above navbar on mobile)
- ✅ Avatar Positioning Fix (Next to message bubble)
- ✅ Navbar Logout Button (Emoji-only with tooltip)

## Future Enhancements

### Chat Features
- [ ] File upload in GroupChat (fix existing endpoint)
- [ ] Image previews in messages
- [ ] Message editing/deletion
- [ ] Message reactions
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Search messages

### Group Features
- [ ] Group invitations
- [ ] Member roles (Moderator between Admin and Member)
- [ ] Group settings management
- [ ] Group discovery/search
- [ ] Group categories/tags

### Notifications
- [ ] Push notifications
- [ ] Email notifications
- [ ] Notification preferences
- [ ] Mark all as read

### Performance
- [ ] WebSocket for real-time updates (replace polling)
- [ ] Message pagination/lazy loading
- [ ] Image optimization
- [ ] Caching strategy

## Technical Debt

- [ ] Remove duplicate console.log statements
- [ ] Fix CSS minification warning (line 1761)
- [ ] Consolidate ID normalization pattern
- [ ] Add TypeScript types
- [ ] Add proper error boundaries
- [ ] Add loading states for all async operations
- [ ] Add tests (unit + integration)

---
**Last Updated**: November 13, 2025  
**Branch**: feature/social-chat → merging to main
