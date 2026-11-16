import { uid, bytesOf } from '../core/Format.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** DataPipeline: satu jalur extract -> clean -> store. Scraper tidak menyimpan sendiri. */
export class DataPipeline {
  constructor({ library, settings, downloader, onLog = null }) {
    this.library = library;
    this.settings = settings;
    this.downloader = downloader;
    this.onLog = onLog || (() => {});
  }

  async thumbnail(blob, size) {
    try {
      if ('createImageBitmap' in window) {
        const bitmap = await createImageBitmap(blob);
        const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        if (typeof OffscreenCanvas !== 'undefined') {
          const canvas = new OffscreenCanvas(width, height);
          canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
          return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
        }
      }
    } catch {
      // fallback di bawah
    }
    try {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, size / Math.max(image.naturalWidth || size, image.naturalHeight || size));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((image.naturalWidth || size) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || size) * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    } catch {
      return null;
    }
  }

  async ingestImages({ sourceUrl, title, items, onProgress = null }) {
    const maxImages = this.settings.get('scraper.maxImages', 80);
    const size = this.settings.get('storage.thumbSize', 320);
    const concurrency = Math.max(1, this.settings.get('scraper.downloadParallel', 3));
    const pacing = this.settings.get('scraper.pacingMs', 600);
    const list = items.slice(0, maxImages);
    const dataset = {
      id: uid('ds'),
      kind: 'images',
      title: title || `Gambar — ${new URL(sourceUrl).hostname}`,
      sourceUrl,
      count: 0,
      bytes: 0,
      skipped: Math.max(0, items.length - list.length),
      createdAt: new Date().toISOString()
    };
    await this.library.saveDataset(dataset);

    let cursor = 0;
    let done = 0;
    const records = [];
    const worker = async () => {
      while (cursor < list.length) {
        const source = list[cursor];
        cursor += 1;
        try {
          const blob = await this.downloader.fetchBlob(source.url);
          const thumb = await this.thumbnail(blob, size);
          const blobId = uid('blb');
          await this.library.putBlob({ id: blobId, blob, thumb, size: blob.size, mime: blob.type });
          records.push({
            id: uid('itm'),
            datasetId: dataset.id,
            kind: 'image',
            title: source.alt || title,
            url: source.url,
            alt: source.alt || '',
            width: source.width || 0,
            height: source.height || 0,
            bytes: blob.size,
            mime: blob.type,
            blobId,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          records.push({
            id: uid('itm'),
            datasetId: dataset.id,
            kind: 'image',
            url: source.url,
            error: error.message,
            createdAt: new Date().toISOString()
          });
        }
        done += 1;
        onProgress?.(done, list.length);
        this.onLog(`Gambar ${done}/${list.length}`);
        if (pacing) await sleep(pacing);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length || 1) }, worker));
    await this.library.addItems(records);
    const bytes = records.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
    const count = records.filter((item) => !item.error).length;
    dataset.count = count;
    dataset.bytes = bytes;
    await this.library.saveDataset(dataset);
    this.onLog(`Tersimpan ${count} gambar (${Math.round(bytes / 1024)} KB).`);
    return dataset;
  }

  async ingestText({ sourceUrl, title, text, tables = [], meta = {} }) {
    const dataset = {
      id: uid('ds'),
      kind: 'text',
      title: title || meta.title || 'Teks halaman',
      sourceUrl,
      count: 0,
      bytes: 0,
      createdAt: new Date().toISOString()
    };
    await this.library.saveDataset(dataset);
    const records = [];
    if (text) {
      records.push({
        id: uid('itm'),
        datasetId: dataset.id,
        kind: 'text',
        title: title || 'Teks utama',
        text,
        url: sourceUrl,
        bytes: bytesOf(text),
        createdAt: new Date().toISOString()
      });
    }
    tables.slice(0, 5).forEach((table, index) => {
      const json = JSON.stringify(table);
      records.push({
        id: uid('itm'),
        datasetId: dataset.id,
        kind: 'table',
        title: `Tabel ${index + 1}`,
        table,
        url: sourceUrl,
        bytes: bytesOf(json),
        createdAt: new Date().toISOString()
      });
    });
    await this.library.addItems(records);
    dataset.count = records.length;
    dataset.bytes = records.reduce((sum, item) => sum + item.bytes, 0);
    dataset.meta = meta;
    await this.library.saveDataset(dataset);
    return dataset;
  }
}
