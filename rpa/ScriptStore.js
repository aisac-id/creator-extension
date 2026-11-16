import { CollectionStore } from '../core/CollectionStore.js';

export const SCRIPT_TEMPLATES = [
  {
    name: 'Scroll halaman bertahap',
    description: 'Scroll 5 kali untuk memicu konten lazy-load.',
    steps: Array.from({ length: 5 }, () => ({ action: 'scroll', value: 700, options: {} }))
  },
  {
    name: 'Klik tombol berdasarkan teks',
    description: 'Ganti value dengan teks tombol yang ingin diklik.',
    steps: [
      { action: 'waitForSelector', selector: { text: 'Muat lebih banyak' }, optional: true },
      { action: 'click', selector: { text: 'Muat lebih banyak' }, optional: true }
    ]
  },
  {
    name: 'Ekstrak tabel ke variabel',
    description: 'Ambil seluruh tabel pertama sebagai teks.',
    steps: [
      { action: 'extract', selector: 'table', as: 'tabel', options: { all: true } }
    ]
  }
];

/** Penyimpanan script RPA + export/import JSON. */
export class ScriptStore {
  constructor(storage) {
    this.store = new CollectionStore(storage, 'hx.rpa.scripts', 'rpa');
  }

  list() {
    return this.store.list();
  }

  save(script) {
    return this.store.save(script);
  }

  remove(id) {
    return this.store.remove(id);
  }

  async seed() {
    const existing = await this.store.list();
    if (existing.length) return existing;
    for (const template of SCRIPT_TEMPLATES) {
      await this.store.save({ ...template, seeded: true });
    }
    return this.store.list();
  }

  async exportJson() {
    return JSON.stringify({
      format: 'harness-rpa-v1',
      exportedAt: new Date().toISOString(),
      scripts: await this.store.list()
    }, null, 2);
  }

  async importJson(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('File script bukan JSON valid.');
    }
    const scripts = Array.isArray(parsed) ? parsed : parsed.scripts;
    if (!Array.isArray(scripts)) throw new Error('Tidak ada array "scripts".');
    let imported = 0;
    for (const script of scripts) {
      if (!Array.isArray(script.steps)) continue;
      await this.store.save({
        id: undefined,
        name: script.name || 'Script impor',
        description: script.description || '',
        steps: script.steps
      });
      imported += 1;
    }
    return imported;
  }
}
