import { uid } from './Format.js';

/**
 * Koleksi CRUD sederhana di atas satu key chrome.storage.
 * Dipakai untuk ide, naskah, kalender, deal, metrik, dan catatan riset.
 */
export class CollectionStore {
  constructor(storage, key, prefix = 'itm') {
    this.storage = storage;
    this.key = key;
    this.prefix = prefix;
    this.cache = null;
  }

  async list() {
    if (!this.cache) this.cache = await this.storage.get(this.key, []);
    return this.cache;
  }

  async save(item) {
    const list = await this.list();
    const now = new Date().toISOString();
    const record = { ...item, updatedAt: now };
    if (!record.id) {
      record.id = uid(this.prefix);
      record.createdAt = now;
      list.unshift(record);
    } else {
      const index = list.findIndex((entry) => entry.id === record.id);
      if (index === -1) {
        list.unshift(record);
      } else {
        list[index] = { ...list[index], ...record };
      }
    }
    await this.persist(list);
    return record;
  }

  async update(id, patch) {
    const list = await this.list();
    const index = list.findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...patch, id, updatedAt: new Date().toISOString() };
    await this.persist(list);
    return list[index];
  }

  async remove(id) {
    const list = await this.list();
    const next = list.filter((entry) => entry.id !== id);
    if (next.length === list.length) return false;
    await this.persist(next);
    return true;
  }

  async clear() {
    await this.persist([]);
  }

  async persist(list) {
    this.cache = list;
    await this.storage.set(this.key, list);
  }

  async count() {
    return (await this.list()).length;
  }

  invalidate() {
    this.cache = null;
  }
}
