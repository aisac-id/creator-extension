/** Helper IndexedDB berbasis Promise, dipakai LibraryStore dan SecretVault. */

export function openDb(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbGet(db, storeName, key) {
  const tx = db.transaction(storeName, 'readonly');
  return req(tx.objectStore(storeName).get(key));
}

export async function idbAll(db, storeName, query = null) {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return req(query ? store.getAll(query) : store.getAll());
}

export async function idbPut(db, storeName, value, key) {
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const request = key === undefined ? store.put(value) : store.put(value, key);
  await req(request);
  return txDone(tx);
}

export async function idbDelete(db, storeName, key) {
  const tx = db.transaction(storeName, 'readwrite');
  await req(tx.objectStore(storeName).delete(key));
  return txDone(tx);
}

export async function idbClear(db, storeName) {
  const tx = db.transaction(storeName, 'readwrite');
  await req(tx.objectStore(storeName).clear());
  return txDone(tx);
}
