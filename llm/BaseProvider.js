import { AppError } from '../core/AppError.js';

/** Kontrak provider LLM. Provider baru cukup menambah satu class turunan. */
export class BaseProvider {
  constructor({ id, label, baseURL, model, apiKey = '', temperature = 0.7, maxTokens = 1200, timeoutMs = 60000 }) {
    this.id = id;
    this.label = label;
    this.baseURL = String(baseURL || '').replace(/\/+$/, '');
    this.model = model;
    this.apiKey = apiKey;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = 'POST', headers = {}, body = null } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(path, { method, headers, body, signal: controller.signal });
      if (!response.ok) {
        let detail = '';
        try {
          detail = (await response.text()).slice(0, 400);
        } catch {
          detail = '';
        }
        throw new AppError('provider_http', `${this.label} menolak permintaan (${response.status}). ${detail}`, {
          status: response.status
        });
      }
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AppError('provider_timeout', `${this.label} tidak merespons dalam ${Math.round(this.timeoutMs / 1000)} detik.`);
      }
      if (error instanceof AppError) throw error;
      throw new AppError('provider_network', `${this.label} tidak bisa dihubungi: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  estimateTokens(text) {
    return Math.ceil(String(text || '').length / 4);
  }

  async listModels() {
    throw new AppError('not_supported', `${this.label} belum mendukung daftar model.`);
  }

  async testConnection() {
    const models = await this.listModels();
    return { ok: true, detail: `${models.length} model tersedia` };
  }

  async chat() {
    throw new AppError('not_supported', 'Provider ini belum diimplementasikan.');
  }

  async stream(messages, options, onToken) {
    const result = await this.chat(messages, options);
    onToken?.(result.text);
    return result;
  }
}
