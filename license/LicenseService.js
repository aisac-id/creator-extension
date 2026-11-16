import { AppError } from '../core/AppError.js';
import { Logger } from '../core/Logger.js';
import { LICENSING } from '../config/branding.js';
import { verifyEd25519, base64UrlToBytes } from './ed25519.js';

const DAY = 86400000;
const enc = new TextEncoder();

/**
 * Lisensi offline Ed25519: CH1.<payload-b64url>.<signature-b64url>
 * Payload ditandatangani sebagai string base64url, bukan JSON mentah.
 */
export class LicenseService {
  constructor(storage) {
    this.storage = storage;
    this.key = 'hx.license';
    this.state = null;
    this.listeners = new Set();
  }

  async init() {
    this.state = await this.storage.get(this.key, null);
    if (!this.state) {
      this.state = { edition: 'trial', startedAt: Date.now(), license: null };
      await this.storage.set(this.key, this.state);
    }
    return this.state;
  }

  get trialDaysLeft() {
    if (!this.state) return 0;
    const end = this.state.startedAt + LICENSING.trialDays * DAY;
    return Math.max(0, Math.ceil((end - Date.now()) / DAY));
  }

  get license() {
    return this.state?.license || null;
  }

  get isLicenseValid() {
    const license = this.license;
    if (!license) return false;
    if (license.exp) {
      const end = new Date(license.exp).getTime();
      if (Number.isFinite(end) && end < Date.now()) return false;
    }
    return true;
  }

  get edition() {
    if (this.isLicenseValid) return this.license.edition;
    return this.trialDaysLeft > 0 ? 'trial' : 'free';
  }

  get isPro() {
    return ['trial', 'pro', 'bundle', 'enterprise'].includes(this.edition);
  }

  can(feature) {
    const allowed = LICENSING.features[feature];
    if (!allowed) return true;
    return allowed.includes(this.edition);
  }

  require(feature) {
    if (this.can(feature)) return true;
    throw new AppError('license_required', 'Fitur ini tersedia di Pro. Aktifkan lisensi atau coba trial 14 hari.');
  }

  limits() {
    return this.edition === 'free'
      ? LICENSING.freeLimits
      : { ideas: Infinity, scripts: Infinity, calendar: Infinity, deals: Infinity, metrics: Infinity };
  }

  ensureCapacity(kind, currentCount) {
    const max = this.limits()[kind];
    if (max !== undefined && Number.isFinite(max) && currentCount >= max) {
      throw new AppError(
        'free_limit',
        `Batas edition Free tercapai (${max} ${kind}). Data lama tetap bisa di-export; aktifkan Pro untuk menambah.`
      );
    }
  }

  label() {
    const edition = this.edition;
    if (edition === 'trial') return { code: 'TRIAL', text: `Trial ${this.trialDaysLeft} hari`, tone: 'warn' };
    if (edition === 'free') return { code: 'FREE', text: 'Free', tone: 'muted' };
    if (edition === 'bundle') return { code: 'BUNDLE', text: this.license.bundleId || 'Bundle', tone: 'pro' };
    if (edition === 'enterprise') return { code: 'ENT', text: 'Enterprise', tone: 'pro' };
    return { code: 'PRO', text: 'Pro', tone: 'pro' };
  }

  async activate(rawKey) {
    const parsed = await this.parse(rawKey);
    this.state = {
      ...this.state,
      edition: parsed.edition,
      license: { ...parsed, rawKey: rawKey.trim(), activatedAt: Date.now() }
    };
    await this.storage.set(this.key, this.state);
    Logger.record('info', 'license', 'Lisensi aktif', { edition: parsed.edition, to: parsed.to });
    this.emit();
    return parsed;
  }

  async deactivate() {
    this.state = { ...this.state, edition: 'free', license: null };
    await this.storage.set(this.key, this.state);
    this.emit();
  }

  async parse(rawKey) {
    const key = String(rawKey || '').trim();
    const parts = key.split('.');
    if (parts.length !== 3 || parts[0] !== LICENSING.keyPrefix) {
      throw new AppError('license_format', 'Format kode lisensi tidak dikenali (CH1.payload.signature).');
    }
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
    } catch {
      throw new AppError('license_payload', 'Isi lisensi rusak atau bukan JSON.');
    }
    const valid = await verifyEd25519(LICENSING.publicKeyB64, enc.encode(parts[1]), base64UrlToBytes(parts[2]));
    if (!valid) throw new AppError('license_signature', 'Tanda tangan lisensi tidak valid.');
    if (!['pro', 'bundle', 'enterprise'].includes(payload.edition)) {
      throw new AppError('license_edition', 'Edition pada lisensi tidak didukung.');
    }
    if (payload.exp) {
      const end = new Date(payload.exp).getTime();
      if (Number.isFinite(end) && end < Date.now()) {
        throw new AppError('license_expired', 'Lisensi sudah kedaluwarsa.');
      }
    }
    if (payload.seats && Number(payload.seats) < 1) {
      throw new AppError('license_seats', 'Jumlah seat tidak valid.');
    }
    return payload;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this));
  }
}
