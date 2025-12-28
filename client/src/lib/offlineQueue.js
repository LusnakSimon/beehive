import { addItem, getAllItems, deleteItem } from './indexeddb';

const DB_NAME = 'beehive-offline-v1';
const STORE = 'outbox';

let _sendFn = null;

export const enqueue = async (payload) => {
  // payload should be a plain object representing the reading/event
  try {
    await addItem(DB_NAME, STORE, { createdAt: Date.now(), payload });
  } catch (err) {
    console.error('enqueue error', err);
  }
};

export const processQueue = async () => {
  if (typeof _sendFn !== 'function') return;
  try {
    const items = await getAllItems(DB_NAME, STORE);
    for (const item of items) {
      try {
        await _sendFn(item.payload);
        await deleteItem(DB_NAME, STORE, item.id);
      } catch (err) {
        // stop processing on first failure to avoid hammering the server
        console.warn('offlineQueue: send failed, will retry later', err);
        return;
      }
    }
  } catch (err) {
    console.error('processQueue error', err);
  }
};

export const init = (sendFn) => {
  _sendFn = sendFn;
  // try to flush when online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => processQueue());
  }
  // attempt an immediate flush if online
  if (navigator.onLine) processQueue();
};

export default { enqueue, processQueue, init };
