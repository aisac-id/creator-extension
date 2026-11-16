import { AppError } from '../core/AppError.js';
import { uid } from '../core/Format.js';

const OUTBOX_KEY = 'hx.outbox';

/** Platform Bridge: kirim hasil ke platform lewat ingest token, dengan outbox idempoten. */
export class PlatformBridge {
  constructor({ settings, vault, storage }) {
    this.id = 'platform';
    this.label = 'Platform (ingest token)';
    this.settings = settings;
    this.vault = vault;
    this.storage = storage;
  }

  get enabled() {
    return Boolean(this.settings.get('platform.enabled', false));
  }

  url() {
    return String(this.settings.get('platform.url', '') || '').replace(/\/+$/, '');
  }

  validateUrl() {
    const url = this.url();
    if (!url) throw new AppError('platform_url', 'Platform URL belum diisi.');
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new AppError('platform_url', 'Platform URL tidak valid.');
    }
    const loopback = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) {
      throw new AppError('platform_https', 'Platform URL wajib HTTPS (http://127.0.0.1 hanya untuk development).');
    }
    return url;
  }

  async token() {
    return this.vault.get('INGEST_TOKEN');
  }

  async request(path, { method = 'GET', body = null } = {}) {
    if (!this.enabled) throw new AppError('platform_off', 'Platform Bridge dimatikan di Pengaturan.');
    const base = this.validateUrl();
    const token = await this.token();
    if (!token) throw new AppError('platform_token', 'Ingest token belum diisi di Koneksi.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      });
      if (!response.ok) throw new AppError('platform_http', `Platform menolak (${response.status}).`);
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (error.name === 'AbortError') throw new AppError('platform_timeout', 'Platform tidak merespons.');
      throw error instanceof AppError ? error : new AppError('platform_network', error.message);
    } finally {
      clearTimeout(timer);
    }
  }

  async test() {
    const data = await this.request('/jobs?limit=0');
    const count = Array.isArray(data?.jobs) ? data.jobs.length : 0;
    return { ok: true, detail: `Terhubung (${count} job menunggu)` };
  }

  envelope(action, payload, jobId = null) {
    const id = uid('env');
    return {
      id,
      type: 'request',
      action,
      payload,
      jobId,
      idempotencyKey: `${action}:${jobId || id}`,
      createdAt: new Date().toISOString()
    };
  }

  async outbox() {
    return this.storage.get(OUTBOX_KEY, []);
  }

  async pushOutbox(envelope) {
    const queue = await this.outbox();
    queue.push(envelope);
    await this.storage.set(OUTBOX_KEY, queue.slice(-100));
  }

  async send(action, payload, jobId = null) {
    const envelope = this.envelope(action, payload, jobId);
    try {
      await this.request('/ingest', { method: 'POST', body: envelope });
      return { ok: true, id: envelope.id };
    } catch (error) {
      await this.pushOutbox(envelope);
      return { ok: false, id: envelope.id, error: error.message };
    }
  }

  async flushOutbox() {
    if (!this.enabled) return { sent: 0, failed: 0 };
    const queue = await this.outbox();
    if (!queue.length) return { sent: 0, failed: 0 };
    const remaining = [];
    let sent = 0;
    for (const envelope of queue) {
      try {
        await this.request('/ingest', { method: 'POST', body: envelope });
        sent += 1;
      } catch {
        remaining.push(envelope);
      }
    }
    await this.storage.set(OUTBOX_KEY, remaining);
    return { sent, failed: remaining.length };
  }

  async jobs() {
    const data = await this.request('/jobs?limit=20');
    return Array.isArray(data?.jobs) ? data.jobs : [];
  }

  async sendHarvest(dataset, items) {
    const payload = {
      dataset: {
        id: dataset.id,
        kind: dataset.kind,
        title: dataset.title,
        sourceUrl: dataset.sourceUrl,
        count: dataset.count,
        bytes: dataset.bytes,
        createdAt: dataset.createdAt
      },
      items: items.slice(0, 200).map((item) => ({
        kind: item.kind,
        title: item.title,
        url: item.url,
        alt: item.alt,
        text: item.text ? String(item.text).slice(0, 2000) : undefined
      }))
    };
    return this.send('harvest.result', payload);
  }
}
