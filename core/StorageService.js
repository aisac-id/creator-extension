/** Pembungkus tipis chrome.storage dengan fallback memori untuk pengujian. */
export class StorageService {
  constructor(areaName = 'local') {
    this.memory = new Map();
    this.area = globalThis.chrome?.storage?.[areaName] || null;
  }

  async get(key, fallback = null) {
    if (!this.area) return this.memory.has(key) ? this.memory.get(key) : fallback;
    const result = await this.area.get(key);
    return result[key] === undefined ? fallback : result[key];
  }

  async set(key, value) {
    if (!this.area) {
      this.memory.set(key, value);
      return value;
    }
    await this.area.set({ [key]: value });
    return value;
  }

  async remove(key) {
    if (!this.area) {
      this.memory.delete(key);
      return;
    }
    await this.area.remove(key);
  }

  async all() {
    if (!this.area) return Object.fromEntries(this.memory);
    return this.area.get(null);
  }

  async bytesUsed() {
    if (!this.area?.getBytesInUse) return 0;
    return this.area.getBytesInUse(null);
  }

  onChange(callback) {
    if (!this.area) return () => {};
    const handler = (changes, areaName) => callback(areaName, changes);
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }
}
