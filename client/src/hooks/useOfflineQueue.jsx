import { useEffect, useCallback } from 'react';
import offlineQueue from '../lib/offlineQueue';

// Hook to enqueue readings; expects a send function that accepts a payload and returns a promise
export function useOfflineQueue(sendFn) {
  useEffect(() => {
    if (sendFn) offlineQueue.init(sendFn);
    return () => {};
  }, [sendFn]);

  const enqueue = useCallback(async (payload) => {
    if (navigator.onLine && sendFn) {
      try {
        await sendFn(payload);
        return { sent: true };
      } catch (err) {
        // fallthrough to enqueue
      }
    }
    await offlineQueue.enqueue(payload);
    return { sent: false };
  }, [sendFn]);

  return { enqueue, processQueue: offlineQueue.processQueue };
}

export default useOfflineQueue;
