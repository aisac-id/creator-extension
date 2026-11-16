import { AppError } from '../core/AppError.js';
import { todayKey } from '../core/Format.js';
import { Logger } from '../core/Logger.js';
import { OpenAICompatProvider } from './providers/OpenAICompatProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';

const KEY_NAMES = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY'
};

const CLASSES = {
  openai: OpenAICompatProvider,
  anthropic: AnthropicProvider,
  gemini: GeminiProvider,
  ollama: OllamaProvider
};

/** LlmHub: registri provider, routing per tugas, fallback, batas biaya harian. */
export class LlmHub {
  constructor({ settings, vault, storage }) {
    this.id = 'llm';
    this.label = 'AI multi-provider';
    this.settings = settings;
    this.vault = vault;
    this.storage = storage;
    this.usageKey = 'hx.ai.usage';
  }

  get enabled() {
    return Boolean(this.settings.get('llm.enabled', true));
  }

  config(id) {
    return this.settings.get(`llm.providers.${id}`, {}) || {};
  }

  chain(preferred) {
    const fallback = String(this.settings.get('llm.fallbackChain', ''))
      .split(',')
      .map((item) => item.trim())
      .filter((item) => CLASSES[item]);
    const ids = [...new Set([preferred || this.settings.get('llm.defaultProvider'), ...fallback])];
    const localOnly = this.settings.get('llm.localOnly', false);
    return ids.filter((id) => {
      if (localOnly && id !== 'ollama') return false;
      return this.config(id).enabled !== false;
    });
  }

  async providerFor(id) {
    const config = this.config(id);
    const ClassRef = CLASSES[id];
    if (!ClassRef) throw new AppError('llm_provider', `Provider ${id} tidak dikenal.`);
    const apiKey = id === 'ollama' ? '' : await this.vault.get(KEY_NAMES[id] || '');
    if (id !== 'ollama' && !apiKey) {
      throw new AppError('llm_no_key', `API key ${config.label || id} belum diisi. Buka Koneksi -> AI.`);
    }
    return new ClassRef({
      id,
      label: config.label || id,
      baseURL: config.baseURL,
      model: config.model,
      apiKey,
      temperature: this.settings.get('llm.temperature', 0.7),
      maxTokens: this.settings.get('llm.maxTokens', 1200)
    });
  }

  async usage() {
    const today = todayKey();
    const saved = await this.storage.get(this.usageKey, null);
    if (!saved || saved.date !== today) {
      return { date: today, calls: 0, inTokens: 0, outTokens: 0, costUsd: 0, byProvider: {} };
    }
    return saved;
  }

  async recordUsage(id, usage) {
    const config = this.config(id);
    const priceIn = Number(config.priceIn) || 0;
    const priceOut = Number(config.priceOut) || 0;
    const inTokens = Number(usage?.in) || 0;
    const outTokens = Number(usage?.out) || 0;
    const cost = (inTokens * priceIn + outTokens * priceOut) / 1e6;
    const current = await this.usage();
    const entry = current.byProvider[id] || { calls: 0, inTokens: 0, outTokens: 0, costUsd: 0 };
    entry.calls += 1;
    entry.inTokens += inTokens;
    entry.outTokens += outTokens;
    entry.costUsd += cost;
    current.calls += 1;
    current.inTokens += inTokens;
    current.outTokens += outTokens;
    current.costUsd += cost;
    current.byProvider[id] = entry;
    await this.storage.set(this.usageKey, current);
    return current;
  }

  async complete({ system = '', messages = [], task = 'generate', provider = null, temperature = null, maxTokens = null, onToken = null }) {
    if (!this.enabled) throw new AppError('llm_off', 'Fitur AI dimatikan di Pengaturan -> AI & LLM.');
    const usage = await this.usage();
    const cap = Number(this.settings.get('llm.dailyCostCapUsd', 1));
    if (cap > 0 && usage.costUsd >= cap) {
      throw new AppError('llm_cap', `Batas biaya harian ($${cap}) tercapai. Naikkan di Pengaturan -> AI & LLM.`);
    }
    const chain = this.chain(provider);
    if (!chain.length) throw new AppError('llm_no_provider', 'Tidak ada provider AI aktif. Aktifkan salah satu di Koneksi.');
    const payload = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const failures = [];
    for (const id of chain) {
      try {
        const client = await this.providerFor(id);
        const options = {
          temperature: temperature ?? this.settings.get('llm.temperature', 0.7),
          maxTokens: maxTokens ?? this.settings.get('llm.maxTokens', 1200)
        };
        const stream = Boolean(onToken) && this.settings.get('llm.streaming', true);
        const result = stream
          ? await client.stream(payload, options, onToken)
          : await client.chat(payload, options);
        if (!result.text?.trim()) throw new AppError('llm_empty', 'Jawaban kosong.');
        await this.recordUsage(id, result.usage);
        Logger.record('info', 'llm', `Jawaban dari ${id}`, { task, model: client.model });
        return { text: result.text, provider: id, model: client.model, usage: result.usage };
      } catch (error) {
        failures.push(`${this.config(id).label || id}: ${error.message}`);
        Logger.record('warn', 'llm', `Provider ${id} gagal`, { message: error.message });
      }
    }
    throw new AppError('llm_failed', `Semua provider gagal. ${failures.join(' | ')}`);
  }

  async test(id) {
    try {
      const client = await this.providerFor(id);
      const result = await client.testConnection();
      return { ok: true, detail: result.detail || 'Terhubung' };
    } catch (error) {
      return { ok: false, detail: error.message };
    }
  }

  async models(id) {
    const client = await this.providerFor(id);
    return client.listModels();
  }

  async usageToday() {
    return this.usage();
  }
}
