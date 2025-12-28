import { useEffect, useState, useCallback } from 'react'
import offlineQueue from '../lib/offlineQueue'
import { getAllItems } from '../lib/indexeddb'

const OUTBOX_DB = 'beehive-offline-v1'
const OUTBOX_STORE = 'outbox'

export default function useOfflineStatus(hiveId = null) {
  const [queuedCount, setQueuedCount] = useState(0)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isReplaying, setIsReplaying] = useState(false)

  const refreshCount = useCallback(async () => {
    try {
      const items = await getAllItems(OUTBOX_DB, OUTBOX_STORE)
      const filtered = (items || []).map(i => i.payload).filter(p => p && (!hiveId || p.hiveId === hiveId))
      setQueuedCount(filtered.length)
    } catch (err) {
      console.warn('useOfflineStatus: failed to read outbox', err)
      setQueuedCount(0)
    }
  }, [hiveId])

  const replay = useCallback(async () => {
    setIsReplaying(true)
    try {
      await offlineQueue.processQueue()
    } catch (err) {
      console.warn('replay failed', err)
    } finally {
      setIsReplaying(false)
      refreshCount()
    }
  }, [refreshCount])

  useEffect(() => {
    refreshCount()
    const onOnline = () => {
      setIsOnline(true)
      // attempt to replay when back online
      replay()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    // also refresh when visibility changes (user may have switched tabs)
    const onVisibility = () => { if (!document.hidden) refreshCount() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshCount, replay])

  return { queuedCount, isOnline, isReplaying, retry: replay, refreshCount }
}
