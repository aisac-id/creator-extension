import { AppError } from './AppError.js';
import { openDb, idbGet, idbPut } from './Idb.js';
import { Logger } from './Logger.js';

const VAULT_KEY = 'hx.vault';
const DEVICE_DB = 'hx-device';
const DEVICE_STORE = 'keys';
const PBKDF2_ITERATIONS = 600000;
const AUTO_LOCK_MS = 30 * 60 * 1000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromB64(text) {
  const binary = atob(text || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * SecretVault: AES-GCM 256 + PBKDF2 600k (mode passphrase) atau
 * device-key non-extractable di IndexedDB (mode perangkat).
 * Ciphertext saja yang disimpan di chrome.storage.local.
 */
export class SecretVault {
  constructor(storage) {
    this.storage = storage;
    this.meta = null;
    this.mode = 'device';
    this.key = null;
    this.secrets = null;
    this.autoLockMs = AUTO_LOCK_MS;
    this.timer = 0;
    this.listeners = new Set();
  }

  async init() {
    this.meta = await this.storage.get(VAULT_KEY, null);
    if (!this.meta) {
      this.meta = { v: 1, mode: 'device', salt: '', iv: '', cipher: '', names: [], updatedAt: null };
      await this.storage.set(VAULT_KEY, this.meta);
    }
    this.mode = this.meta.mode || 'device';
    return this;
  }

  get configured() {
    return Boolean(this.meta?.cipher);
  }

  get isLocked() {
    if (!this.configured) return false;
    return !this.key;
  }

  get names() {
    return this.meta?.names || [];
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this));
  }

  touch() {
    clearTimeout(this.timer);
    if (this.mode !== 'passphrase') return;
    this.timer = setTimeout(() => this.lock(), this.autoLockMs);
  }

  lock() {
    this.key = null;
    this.secrets = null;
    clearTimeout(this.timer);
    this.emit();
  }

  async deviceKey() {
    const db = await openDb(DEVICE_DB, 1, (database) => {
      if (!database.objectStoreNames.contains(DEVICE_STORE)) database.createObjectStore(DEVICE_STORE);
    });
    let key = await idbGet(db, DEVICE_STORE, 'primary');
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await idbPut(db, DEVICE_STORE, key, 'primary');
    }
    return key;
  }

  async deriveKey(passphrase, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async ensureKey() {
    if (this.key) return this.key;
    if (this.mode === 'passphrase') {
      throw new AppError('vault_locked', 'Buka SecretVault dengan passphrase terlebih dahulu.');
    }
    this.key = await this.deviceKey();
    await this.loadSecrets();
    return this.key;
  }

  async loadSecrets() {
    if (this.secrets) return this.secrets;
    if (!this.meta?.cipher) {
      this.secrets = {};
      return this.secrets;
    }
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromB64(this.meta.iv) },
        this.key,
        fromB64(this.meta.cipher)
      );
      this.secrets = JSON.parse(dec.decode(plain));
    } catch {
      this.key = null;
      throw new AppError('vault_bad_key', 'Kunci vault tidak cocok untuk data yang tersimpan.');
    }
    return this.secrets;
  }

  async unlock(passphrase = '') {
    if (this.mode === 'device' || !this.configured) {
      await this.ensureKey();
      this.emit();
      return true;
    }
    if (!passphrase) throw new AppError('vault_locked', 'Masukkan passphrase.');
    const salt = fromB64(this.meta.salt);
    const key = await this.deriveKey(passphrase, salt);
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromB64(this.meta.iv) },
        key,
        fromB64(this.meta.cipher)
      );
      this.key = key;
      this.secrets = JSON.parse(dec.decode(plain));
      this.touch();
      this.emit();
      return true;
    } catch {
      throw new AppError('vault_bad_passphrase', 'Passphrase salah. Coba lagi.');
    }
  }

  async save() {
    if (!this.key) throw new AppError('vault_locked', 'Vault terkunci.');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      enc.encode(JSON.stringify(this.secrets || {}))
    );
    this.meta = {
      ...this.meta,
      iv: toB64(iv),
      cipher: toB64(cipher),
      names: Object.keys(this.secrets || {}),
      updatedAt: new Date().toISOString()
    };
    await this.storage.set(VAULT_KEY, this.meta);
    this.touch();
    this.emit();
  }

  async get(name) {
    await this.ensureKey();
    await this.loadSecrets();
    this.touch();
    return this.secrets[name] || '';
  }

  async set(name, value) {
    await this.ensureKey();
    await this.loadSecrets();
    if (!name) throw new AppError('bad_secret', 'Nama secret wajib diisi.');
    this.secrets[name] = String(value ?? '');
    await this.save();
    return true;
  }

  async remove(name) {
    await this.ensureKey();
    await this.loadSecrets();
    delete this.secrets[name];
    await this.save();
  }

  async list() {
    const unlocked = !this.isLocked;
    if (unlocked) await this.loadSecrets();
    return this.names.map((name) => {
      const value = unlocked ? this.secrets?.[name] || '' : '';
      return {
        name,
        masked: value ? `••••••${value.slice(-4)}` : '••••••',
        hasValue: unlocked ? Boolean(value) : true
      };
    });
  }

  async setPassphrase(passphrase) {
    if (passphrase && passphrase.length < 8) {
      throw new AppError('weak_passphrase', 'Passphrase minimal 8 karakter.');
    }
    if (this.configured && this.isLocked) {
      throw new AppError('vault_locked', 'Buka vault dengan passphrase lama sebelum mengubah mode.');
    }
    await this.ensureKey();
    await this.loadSecrets();
    if (passphrase) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      this.key = await this.deriveKey(passphrase, salt);
      this.mode = 'passphrase';
      this.meta.salt = toB64(salt);
    } else {
      this.key = await this.deviceKey();
      this.mode = 'device';
      this.meta.salt = '';
    }
    this.meta.mode = this.mode;
    await this.save();
    return this.mode;
  }

  async importEnv(text) {
    const entries = {};
    String(text || '').split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) return;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      entries[match[1]] = value;
    });
    await this.ensureKey();
    await this.loadSecrets();
    Object.assign(this.secrets, entries);
    await this.save();
    return Object.keys(entries);
  }

  async exportEnv(includeValues = false) {
    const names = this.names;
    const lines = [
      '# Creator Harness — export .env',
      `# Dibuat: ${new Date().toISOString()}`,
      '# Hati-hati: jika nilai disertakan, file ini berisi secret plaintext.'
    ];
    if (includeValues) await this.ensureKey();
    for (const name of names) {
      const value = includeValues ? await this.get(name) : '';
      lines.push(`${name}=${value}`);
    }
    Logger.record('info', 'vault', includeValues ? 'Export .env dengan nilai' : 'Export .env tanpa nilai');
    return lines.join('\n');
  }
}
