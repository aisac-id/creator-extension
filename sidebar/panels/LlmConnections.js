import { el } from '../../ui/Dom.js';
import { field, input, note } from './PanelKit.js';

const PROVIDERS = [
  ['openai', 'OpenAI-compatible', true],
  ['anthropic', 'Anthropic', false],
  ['gemini', 'Google Gemini', false],
  ['ollama', 'Ollama lokal', false]
];

const KEY_NAME = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };

/** Kartu semua provider AI: kredensial, model, uji, dan daftar model. */
export class LlmConnections {
  constructor(panel) {
    this.panel = panel;
    this.app = panel.app;
    this.services = panel.services;
  }

  async render() {
    const wrap = el('div', {});
    for (const [id, label] of PROVIDERS) {
      wrap.append(await this.card(id, label));
    }
    wrap.append(note('Fallback berurutan: provider default lalu urutan di Setelan → AI. Kunci hanya disimpan terenkripsi.'));
    return wrap;
  }

  async card(id, label) {
    const settings = this.services.settings;
    const vault = this.services.vault;
    const basePath = `llm.providers.${id}`;
    const enabled = el('input', { type: 'checkbox', checked: settings.get(`${basePath}.enabled`, false) });
    const baseURL = input({ value: settings.get(`${basePath}.baseURL`, ''), placeholder: 'Base URL' });
    const model = input({ value: settings.get(`${basePath}.model`, ''), placeholder: 'Model' });
    const keyInput = el('input', {
      class: 'hx-input',
      type: 'password',
      placeholder: id === 'ollama' ? 'Tidak perlu API key' : 'API key (disimpan di vault)',
      disabled: id === 'ollama'
    });
    const status = el('p', { class: 'hx-muted hx-small', text: 'Belum diuji.' });
    const save = async () => {
      await settings.set(`${basePath}.enabled`, enabled.checked);
      await settings.set(`${basePath}.baseURL`, baseURL.value.trim());
      await settings.set(`${basePath}.model`, model.value.trim());
      if (id !== 'ollama' && keyInput.value.trim()) {
        await vault.set(KEY_NAME[id], keyInput.value.trim());
        keyInput.value = '';
      }
    };
    const card = el('div', { class: 'hx-card' },
      el('div', { class: 'hx-section-head' },
        el('h3', { class: 'hx-section-title', text: label }),
        el('label', { class: 'hx-chip' }, enabled, el('span', { text: 'Aktif' }))
      ),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Base URL', baseURL),
        field('Model', model)
      ),
      id === 'ollama' ? null : field('API key', keyInput, vault.isLocked ? 'Vault terkunci.' : 'Kosongkan bila tidak ingin mengubah.'),
      el('div', { class: 'hx-row' },
        el('button', {
          class: 'hx-btn is-small is-primary', type: 'button', text: 'Simpan',
          onclick: async () => {
            try {
              await save();
              this.app.toast.success(`${label} disimpan.`);
            } catch (error) {
              this.app.toast.error(error.message);
            }
          }
        }),
        el('button', {
          class: 'hx-btn is-small', type: 'button', text: 'Uji',
          onclick: async () => {
            status.textContent = 'Menguji…';
            status.className = 'hx-muted hx-small';
            try {
              await save();
              const result = await this.services.llm.test(id);
              status.textContent = result.detail;
              status.className = result.ok ? 'hx-muted hx-small' : 'hx-danger';
            } catch (error) {
              status.textContent = error.message;
              status.className = 'hx-danger';
            }
          }
        }),
        el('button', {
          class: 'hx-btn is-small', type: 'button', text: 'Model',
          onclick: async () => {
            status.textContent = 'Mengambil daftar model…';
            try {
              await save();
              const models = await this.services.llm.models(id);
              status.textContent = models.length ? models.slice(0, 8).join(', ') : 'Tidak ada model terdaftar.';
              status.className = 'hx-muted hx-small';
            } catch (error) {
              status.textContent = error.message;
              status.className = 'hx-danger';
            }
          }
        })
      ),
      status
    );
    if (id === 'openai') {
      const hint = note('Bisa juga untuk Groq, DeepSeek, dan OpenRouter.');
      hint.style.margin = '2px 0 8px';
      card.querySelector('.hx-section-head').after(hint);
    }
    return card;
  }
}
