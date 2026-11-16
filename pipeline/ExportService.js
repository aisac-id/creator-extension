import { slugify } from '../core/Format.js';
import { buildZip } from './ZipWriter.js';

/** Export dataset ke JSON/CSV/Markdown/TXT/ZIP, lalu unduh lewat chrome.downloads. */
export class ExportService {
  constructor(library) {
    this.library = library;
  }

  async payload(datasetId) {
    const dataset = await this.library.getDataset(datasetId);
    if (!dataset) throw new Error('Dataset tidak ditemukan.');
    const items = await this.library.itemsOf(datasetId, { limit: 5000 });
    return { dataset, items };
  }

  async save(blob, filename) {
    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({ url, filename, saveAs: true });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    }
    return filename;
  }

  toJson(dataset, items) {
    return JSON.stringify({
      dataset,
      items: items.map(({ blobId, ...rest }) => rest)
    }, null, 2);
  }

  toCsv(items) {
    const header = ['kind', 'title', 'url', 'alt', 'width', 'height', 'bytes', 'text'];
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [header.join(',')];
    items.forEach((item) => {
      lines.push(header.map((key) => escape(key === 'text' ? String(item.text || '').slice(0, 4000) : item[key])).join(','));
    });
    return lines.join('\r\n');
  }

  toMarkdown(dataset, items) {
    const lines = [`# ${dataset.title || 'Dataset'}`, '', `Sumber: ${dataset.sourceUrl || '—'}`, ''];
    items.forEach((item) => {
      if (item.kind === 'text') {
        lines.push(String(item.text || ''), '');
      } else if (item.kind === 'table') {
        const table = item.table || { headers: [], rows: [] };
        if (table.headers?.length) lines.push(`| ${table.headers.join(' | ')} |`, `| ${table.headers.map(() => '---').join(' | ')} |`);
        (table.rows || []).forEach((row) => lines.push(`| ${row.join(' | ')} |`));
        lines.push('');
      } else if (item.url) {
        lines.push(`- ${item.alt || item.kind}: ${item.url}`);
      }
    });
    return lines.join('\n');
  }

  async toZip(dataset, items) {
    const entries = [{
      name: 'manifest.json',
      data: new TextEncoder().encode(JSON.stringify({
        dataset,
        items: items.map(({ blobId, ...rest }) => rest)
      }, null, 2))
    }];
    let index = 0;
    for (const item of items) {
      if (!item.blobId) continue;
      const record = await this.library.getBlob(item.blobId);
      if (!record?.blob) continue;
      index += 1;
      const array = new Uint8Array(await record.blob.arrayBuffer());
      const ext = (record.mime || item.mime || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
      entries.push({ name: `asets/${String(index).padStart(3, '0')}-${slugify(item.alt || item.title || 'gambar', 'gambar')}.${ext}`, data: array });
    }
    return buildZip(entries);
  }

  async export(datasetId, format = 'json') {
    const { dataset, items } = await this.payload(datasetId);
    const base = `creator-${slugify(dataset.title || dataset.kind, 'data')}`;
    if (format === 'json') {
      return this.save(new Blob([this.toJson(dataset, items)], { type: 'application/json' }), `${base}.json`);
    }
    if (format === 'csv') {
      return this.save(new Blob([this.toCsv(items)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
    }
    if (format === 'md') {
      return this.save(new Blob([this.toMarkdown(dataset, items)], { type: 'text/markdown;charset=utf-8' }), `${base}.md`);
    }
    if (format === 'txt') {
      const text = items.map((item) => item.text || item.url || '').filter(Boolean).join('\n\n');
      return this.save(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
    }
    if (format === 'zip') {
      const blob = await this.toZip(dataset, items);
      return this.save(blob, `${base}.zip`);
    }
    throw new Error(`Format ${format} tidak didukung.`);
  }
}
