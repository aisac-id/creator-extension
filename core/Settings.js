import { clone, deepMerge, getPath, setPath, clamp } from './Format.js';
import { Logger } from './Logger.js';
import { AppError } from './AppError.js';
import { DEFAULT_SETTINGS, FIELDS, SETTINGS_VERSION } from './SettingsSchema.js';

/** Akses pengaturan terskema: validasi, reset, export/import, tanpa reload. */
export class Settings {
  constructor(storage) {
    this.storage = storage;
    this.key = 'hx.settings';
    this.data = clone(DEFAULT_SETTINGS);
    this.loaded = false;
    this.listeners = new Set();
    this.unsubscribe = storage.onChange((area, changes) => {
      if (area !== 'local' || !changes[this.key]) return;
      this.data = deepMerge(clone(DEFAULT_SETTINGS), changes[this.key].newValue || {});
      Logger.setLevel(this.get('advanced.logLevel'));
      this.emit();
    });
  }

  async load() {
    const saved = await this.storage.get(this.key, null);
    this.data = deepMerge(clone(DEFAULT_SETTINGS), saved || {});
    this.data.version = SETTINGS_VERSION;
    this.loaded = true;
    Logger.setLevel(this.get('advanced.logLevel'));
    if (!saved) await this.storage.set(this.key, this.data);
    return this.data;
  }

  get(path, fallback = undefined) {
    return getPath(this.data, path, fallback);
  }

  field(path) {
    return FIELDS.find((entry) => entry.path === path) || null;
  }

  clean(field, value) {
    if (!field) return value;
    if (field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) return getPath(this.data, field.path);
      return clamp(n, field.min ?? -Infinity, field.max ?? Infinity);
    }
    if (field.type === 'toggle') return Boolean(value);
    if (field.type === 'select') {
      const allowed = (field.options || []).map(([key]) => key);
      return allowed.includes(value) ? value : allowed[0];
    }
    if (field.type === 'color') {
      return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : '#22d3ee';
    }
    return String(value ?? '');
  }

  async set(path, value) {
    const field = this.field(path);
    const clean = this.clean(field, value);
    this.data = setPath(this.data, path, clean);
    await this.persist();
    return clean;
  }

  async patch(partial) {
    this.data = deepMerge(this.data, partial);
    await this.persist();
    return this.data;
  }

  async reset(section) {
    const defaults = clone(DEFAULT_SETTINGS);
    if (section) {
      if (!(section in defaults)) throw new AppError('unknown_section', `Bagian ${section} tidak dikenal.`);
      this.data[section] = defaults[section];
    } else {
      this.data = defaults;
    }
    await this.persist();
  }

  async persist() {
    this.data.version = SETTINGS_VERSION;
    await this.storage.set(this.key, this.data);
    Logger.setLevel(this.get('advanced.logLevel'));
    this.emit();
  }

  describe(section = null, query = '') {
    const needle = query.trim().toLowerCase();
    return FIELDS.filter((field) => {
      if (section && field.section !== section) return false;
      if (!needle) return true;
      return `${field.label} ${field.path} ${field.help || ''}`.toLowerCase().includes(needle);
    });
  }

  exportJson() {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: SETTINGS_VERSION,
      settings: this.data
    }, null, 2);
  }

  async importJson(raw) {
    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      throw new AppError('bad_json', 'File pengaturan bukan JSON yang valid.');
    }
    const incoming = parsed?.settings || parsed;
    if (!incoming || typeof incoming !== 'object') {
      throw new AppError('bad_settings', 'Struktur pengaturan tidak dikenali.');
    }
    const merged = deepMerge(clone(DEFAULT_SETTINGS), incoming);
    FIELDS.forEach((field) => {
      const value = getPath(merged, field.path);
      const clean = this.clean(field, value);
      merged[field.path.split('.')[0]] = setPath(merged, field.path, clean)[field.path.split('.')[0]];
    });
    this.data = merged;
    await this.persist();
    return this.data;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.data);
      } catch (error) {
        Logger.record('warn', 'settings', 'Listener gagal', { message: error.message });
      }
    });
  }
}
