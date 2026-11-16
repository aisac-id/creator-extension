import { openDb, idbAll, idbGet, idbPut, idbDelete, req, txDone } from '../core/Idb.js';

const DB_NAME = 'hx-library';
const DB_VERSION = 1;

/** LibraryStore: IndexedDB untuk dataset, item, dan blob (bukan chrome.storage). */
export class LibraryStore {
  constructor() {
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    this.db = await openDb(DB_NAME, DB_VERSION, (database) => {
      if (!database.objectStoreNames.contains('datasets')) {
        database.createObjectStore('datasets', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('items')) {
        const store = database.createObjectStore('items', { keyPath: 'id' });
        store.createIndex('datasetId', 'datasetId');
      }
      if (!database.objectStoreNames.contains('blobs')) {
        database.createObjectStore('blobs', { keyPath: 'id' });
      }
    });
    return this.db;
  }

  async saveDataset(dataset) {
    await this.open();
    await idbPut(this.db, 'datasets', { ...dataset, updatedAt: new Date().toISOString() });
    return dataset;
  }

  async listDatasets() {
    await this.open();
    const all = await idbAll(this.db, 'datasets');
    return all.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  async getDataset(id) {
    await this.open();
    return idbGet(this.db, 'datasets', id);
  }

  async addItems(items) {
    if (!items.length) return;
    await this.open();
    const tx = this.db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    items.forEach((item) => store.put(item));
    await txDone(tx);
  }

  async itemsOf(datasetId, { limit = 300 } = {}) {
    await this.open();
    const tx = this.db.transaction('items', 'readonly');
    const index = tx.objectStore('items').index('datasetId');
    const all = await req(index.getAll(datasetId));
    return all.slice(0, limit);
  }

  async putBlob(record) {
    await this.open();
    await idbPut(this.db, 'blobs', record);
  }

  async getBlob(id) {
    await this.open();
    return idbGet(this.db, 'blobs', id);
  }

  async deleteDataset(id) {
    await this.open();
    const items = await this.itemsOf(id, { limit: 5000 });
    const blobs = items.filter((item) => item.blobId).map((item) => item.blobId);
    const tx = this.db.transaction(['items', 'blobs', 'datasets'], 'readwrite');
    items.forEach((item) => tx.objectStore('items').delete(item.id));
    blobs.forEach((blobId) => tx.objectStore('blobs').delete(blobId));
    tx.objectStore('datasets').delete(id);
    await txDone(tx);
  }

  async usage() {
    await this.open();
    const datasets = await idbAll(this.db, 'datasets');
    const bytes = datasets.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
    return { bytes, datasets: datasets.length };
  }

  async clearAll() {
    await this.open();
    const tx = this.db.transaction(['datasets', 'items', 'blobs'], 'readwrite');
    ['datasets', 'items', 'blobs'].forEach((name) => tx.objectStore(name).clear());
    await txDone(tx);
  }

  async deleteItemBlob(blobId) {
    if (!blobId) return;
    await this.open();
    await idbDelete(this.db, 'blobs', blobId);
  }
}
