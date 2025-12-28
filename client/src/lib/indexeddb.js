// Lightweight IndexedDB promise wrapper for simple key-value object stores
const openDB = (dbName, storeName, version = 1) => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName, version);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
      }
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
