import { slugify } from '../core/Format.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Unduhan file langsung via chrome.downloads + pengambilan blob untuk pipeline. */
export class FileDownloader {
  constructor({ settings }) {
    this.settings = settings;
  }

  extensionOf(url, fallback = 'jpg') {
    try {
      const path = new URL(url).pathname;
      const match = path.match(/\.([a-z0-9]{2,5})$/i);
      return match ? match[1].toLowerCase() : fallback;
    } catch {
      return fallback;
    }
  }

  filenameFor(url, title = 'gambar') {
    const ext = this.extensionOf(url);
    return `${slugify(title, 'aset')}-${slugify(url.split('/').pop() || 'file', 'file').slice(0, 30)}.${ext}`;
  }

  async fetchBlob(url, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { credentials: 'include', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.blob();
    } finally {
      clearTimeout(timer);
    }
  }

  async download(url, filename = null) {
    const target = filename || this.filenameFor(url);
    return chrome.downloads.download({ url, filename: target, saveAs: true });
  }

  async downloadMany(items, { onProgress = null } = {}) {
    const concurrency = Math.max(1, this.settings.get('scraper.downloadParallel', 3));
    const pacing = this.settings.get('scraper.pacingMs', 600);
    let index = 0;
    let done = 0;
    const worker = async () => {
      while (index < items.length) {
        const current = items[index];
        index += 1;
        try {
          await this.download(current.url, current.filename || this.filenameFor(current.url, current.alt));
          done += 1;
        } catch {
          // item gagal dilewati; ringkasan tetap dilaporkan
        }
        onProgress?.(done, items.length);
        if (pacing) await sleep(pacing);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return { total: items.length, done };
  }
}
