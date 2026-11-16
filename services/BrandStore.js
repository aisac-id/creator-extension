import { Logger } from '../core/Logger.js';

const KEY = 'hx.brand';

export const DEFAULT_BRAND = {
  name: '',
  handle: '',
  niche: '',
  audience: '',
  language: 'id',
  tone: 'ramah',
  values: '',
  offers: '',
  signature: '',
  bio: '',
  banned: '',
  city: '',
  cta: '',
  links: [],
  palette: ['#22d3ee'],
  updatedAt: null
};

const CHECKS = [
  ['name', 'Nama brand'],
  ['niche', 'Niche'],
  ['audience', 'Audiens'],
  ['tone', 'Gaya bahasa'],
  ['offers', 'Penawaran / produk'],
  ['cta', 'Call to action']
];

/** Profil brand: sumber konteks untuk semua prompt AI dan naskah. */
export class BrandStore {
  constructor(storage) {
    this.storage = storage;
    this.data = { ...DEFAULT_BRAND };
    this.listeners = new Set();
  }

  async load() {
    const saved = await this.storage.get(KEY, null);
    this.data = { ...DEFAULT_BRAND, ...(saved || {}) };
    return this.data;
  }

  get() {
    return this.data;
  }

  async save(patch) {
    this.data = {
      ...this.data,
      ...patch,
      links: Array.isArray(patch.links) ? patch.links.filter(Boolean) : this.data.links,
      palette: Array.isArray(patch.palette) ? patch.palette.slice(0, 5) : this.data.palette,
      updatedAt: new Date().toISOString()
    };
    await this.storage.set(KEY, this.data);
    Logger.record('info', 'brand', 'Profil brand disimpan', { name: this.data.name });
    this.emit();
    return this.data;
  }

  missing() {
    return CHECKS.filter(([field]) => !String(this.data[field] || '').trim()).map(([, label]) => label);
  }

  completeness() {
    const missing = this.missing();
    const filled = CHECKS.length - missing.length;
    return {
      filled,
      total: CHECKS.length,
      missing,
      percent: Math.round((filled / CHECKS.length) * 100)
    };
  }

  /** Ringkasan pendek yang aman ditanam di system prompt. */
  summary() {
    const b = this.data;
    return {
      name: b.name || 'belum diisi',
      handle: b.handle || '',
      niche: b.niche || '',
      audience: b.audience || '',
      language: b.language || 'id',
      tone: b.tone || 'ramah',
      values: b.values || '',
      offers: b.offers || '',
      signature: b.signature || '',
      bio: b.bio || '',
      banned: b.banned || '',
      city: b.city || '',
      cta: b.cta || '',
      links: (b.links || []).slice(0, 6),
      palette: b.palette || []
    };
  }

  /** Teks siap tempel untuk caption/naskah tanpa AI. */
  boilerplate() {
    const b = this.data;
    const lines = [];
    if (b.name) lines.push(b.name + (b.handle ? ` (@${String(b.handle).replace(/^@/, '')})` : ''));
    if (b.niche) lines.push(`Niche: ${b.niche}`);
    if (b.cta) lines.push(`CTA: ${b.cta}`);
    if (b.links?.length) lines.push(`Link: ${b.links[0]}`);
    return lines.join('\n');
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.data);
      } catch {
        // listener panel yang sudah ditutup diabaikan
      }
    });
  }
}
