// Lightweight IndexedDB promise wrapper for simple key-value object stores
// All known stores per database — ensures they're created together during upgrade
const DB_SCHEMAS = {
  'beehive-cache-v1': ['sensor-latest', 'sensor-history', 'sensor-stats', 'inspections'],
  'beehive-offline-v1': ['outbox']
};
const DB_VERSION = 2;

const openDB = (dbName, storeName) => {
  return new Promise((resolve, reject) => {
    const stores = DB_SCHEMAS[dbName] || [storeName];
    const request = window.indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      stores.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const withStore = async (dbName, storeName, mode, callback) => {
  const db = await openDB(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = callback(store);
    } catch (err) {
      reject(err);
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction error'));
  });
};

export const addItem = async (dbName, storeName, value) => {
  return withStore(dbName, storeName, 'readwrite', (store) => store.add(value));
};

export const putItem = async (dbName, storeName, value) => {
  return withStore(dbName, storeName, 'readwrite', (store) => store.put(value));
};

export const getAllItems = async (dbName, storeName) => {
  return withStore(dbName, storeName, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
};

export const deleteItem = async (dbName, storeName, key) => {
  return withStore(dbName, storeName, 'readwrite', (store) => store.delete(key));
};

export const clearStore = async (dbName, storeName) => {
  return withStore(dbName, storeName, 'readwrite', (store) => store.clear());
};

export default {
  openDB,
  addItem,
  putItem,
  getAllItems,
  deleteItem,
  clearStore,
};
