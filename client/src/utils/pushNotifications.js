// Push Notifications Utility

/**
 * Request permission for push notifications
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Check if notifications are supported and enabled
 */
export function areNotificationsEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Get user's push notification preferences from localStorage
 */
export function getPushSettings() {
  const saved = localStorage.getItem('socialPushNotifications');
  if (saved) {
    return JSON.parse(saved);
  }
  // Default settings
  return {
    friendRequests: true,
    friendRequestAccepted: true,
    newMessages: true
  };
}

/**
 * Show a push notification using service worker
 * @param {string} title - Notification title
 * @param {object} options - Notification options
 */
export async function showPushNotification(title, options = {}) {
  if (!areNotificationsEnabled()) {
    console.log('Notifications not enabled');
    return null;
  }

  const defaultOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options
  };

  try {
    // Use service worker if available for better notification support
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return await registration.showNotification(title, defaultOptions);
    } else {
      // Fallback to regular Notification API
      return new Notification(title, defaultOptions);
    }
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
}

/**
 * Show notification for friend request
 */
export async function showFriendRequestNotification(fromUser, requestId) {
  const settings = getPushSettings();
  if (!settings.friendRequests) {
    return null;
  }

  return await showPushNotification('Nová žiadosť o priateľstvo', {
    body: `${fromUser.name} vám poslal žiadosť o priateľstvo`,
    icon: fromUser.image || '/icon-192.png',
    tag: `friend-request-${requestId}`,
    data: {
      type: 'friend_request',
      requestId,
      url: '/search'
    }
  });
}

/**
 * Show notification for accepted friend request
 */
export async function showFriendRequestAcceptedNotification(fromUser) {
  const settings = getPushSettings();
  if (!settings.friendRequestAccepted) {
    return null;
  }

  return await showPushNotification('Žiadosť bola prijatá', {
    body: `${fromUser.name} prijal vašu žiadosť o priateľstvo`,
    icon: fromUser.image || '/icon-192.png',
    tag: `friend-accepted-${fromUser.id}`,
    data: {
      type: 'friend_request_accepted',
      userId: fromUser.id,
      url: `/profile/${fromUser.id}`
    }
  });
}

/**
 * Show notification for new message
 */
export async function showNewMessageNotification(fromUser, messagePreview, conversationId) {
  const settings = getPushSettings();
  if (!settings.newMessages) {
    return null;
  }

  return await showPushNotification(`Nová správa od ${fromUser.name}`, {
    body: messagePreview,
    icon: fromUser.image || '/icon-192.png',
    tag: `message-${conversationId}`,
    data: {
      type: 'new_message',
      conversationId,
      url: `/messages/${conversationId}`
    }
  });
}

/**
 * Setup notification click handler
 */
export function setupNotificationClickHandler(navigate) {
  // Listen for notification clicks
  if ('Notification' in window) {
    // For service worker notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'notification-click') {
          const url = event.data.url;
          if (url && navigate) {
            navigate(url);
          }
        }
      });
    }
  }
}

/**
 * Handle notification from server (in-app notification to push notification)
 */
export async function handleInAppNotification(notification, navigate) {
  if (!areNotificationsEnabled()) {
    return;
  }

  const settings = getPushSettings();
  
  // Check if user wants this type of notification
  if (notification.type === 'friend_request' && !settings.friendRequests) {
    return;
  }
  if (notification.type === 'friend_request_accepted' && !settings.friendRequestAccepted) {
    return;
  }
  if (notification.type === 'new_message' && !settings.newMessages) {
    return;
  }

  // Create push notification
  let pushNotif = null;
  
  if (notification.type === 'friend_request') {
    pushNotif = await showFriendRequestNotification(
      notification.from,
      notification.content.friendRequestId
    );
  } else if (notification.type === 'friend_request_accepted') {
    pushNotif = await showFriendRequestAcceptedNotification(notification.from);
  } else if (notification.type === 'new_message') {
    pushNotif = await showNewMessageNotification(
      notification.from,
      notification.content.text,
      notification.content.conversationId
    );
  }

  // Note: Click handling is done by the service worker (see sw.js notificationclick event)
  // The service worker will use notification.data.url to navigate

  return pushNotif;
}
