import { AppError } from '../core/AppError.js';

/** Status semua connector: llm, platform (dan mudah ditambah untuk desktop/terminal). */
export class ConnectionHub {
  constructor({ settings, vault, llm, platform }) {
    this.settings = settings;
    this.vault = vault;
    this.llm = llm;
    this.platform = platform;
    this.registry = new Map();
    this.states = new Map();
    this.register(llm);
    this.register(platform);
  }

  register(connector) {
    this.registry.set(connector.id, connector);
    this.states.set(connector.id, { status: 'off', detail: 'Belum diuji', at: null });
    return this;
  }

  setStatus(id, status, detail = '') {
    this.states.set(id, { status, detail, at: Date.now() });
  }

  statuses() {
    return Array.from(this.registry.entries()).map(([id, connector]) => ({
      id,
      label: connector.label,
      ...(this.states.get(id) || {})
    }));
  }

  async test(id) {
    const connector = this.registry.get(id);
    if (!connector) throw new AppError('connector_unknown', `Connector ${id} tidak dikenal.`);
    this.setStatus(id, 'testing', 'Menguji...');
    try {
      const result = await connector.test();
      this.setStatus(id, result.ok ? 'connected' : 'error', result.detail || '');
      return result;
    } catch (error) {
      this.setStatus(id, 'error', error.message);
      throw error;
    }
  }
}
