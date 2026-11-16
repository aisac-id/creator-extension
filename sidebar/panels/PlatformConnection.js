import { el } from '../../ui/Dom.js';
import { field, input, badge, note } from './PanelKit.js';

/** Kartu koneksi Platform Bridge: URL ingest, token, dan uji koneksi. */
export class PlatformConnection {
  constructor(panel) {
    this.panel = panel;
    this.app = panel.app;
    this.services = panel.services;
    this.node = el('div', { class: 'hx-card' });
  }

  async render() {
    const platform = this.services.platform;
    const settings = this.services.settings;
    const locked = this.services.vault.isLocked;
    const urlInput = input({ value: settings.get('platform.url', ''), placeholder: 'https://platform.example.com' });
    const tokenInput = el('input', { class: 'hx-input', type: 'password', placeholder: 'INGEST_TOKEN' });
    const enabled = el('input', { type: 'checkbox', checked: Boolean(settings.get('platform.enabled', false)) });
    const autoSend = el('input', { type: 'checkbox', checked: Boolean(settings.get('platform.autoSend', false)) });
    const poll = input({ type: 'number', min: 15, max: 3600, value: settings.get('platform.pollSeconds', 60) });
    const status = el('p', { class: 'hx-muted hx-small', text: locked ? 'Vault terkunci — buka di bagian Secret Vault.' : 'Belum diuji.' });

    this.node.replaceChildren(
      el('div', { class: 'hx-section-head' },
        el('h3', { class: 'hx-section-title', text: 'Platform Bridge' }),
        badge('HTTPS + idempotency', 'is-pro')
      ),
      el('label', { class: 'hx-chip' }, enabled, el('span', { text: 'Aktifkan platform' })),
      field('URL platform', urlInput, 'Wajib HTTPS. http://127.0.0.1 hanya untuk development.'),
      field('Ingest token', tokenInput, 'Disimpan terenkripsi di SecretVault.'),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Poll (detik)', poll),
        el('label', { class: 'hx-chip' }, autoSend, el('span', { text: 'Kirim otomatis hasil panen' }))
      ),
      el('div', { class: 'hx-row' },
        el('button', {
          class: 'hx-btn is-small', type: 'button', text: 'Simpan',
          onclick: async () => {
            try {
              await settings.set('platform.enabled', enabled.checked);
              await settings.set('platform.url', urlInput.value.trim());
              await settings.set('platform.pollSeconds', Number(poll.value) || 60);
              await settings.set('platform.autoSend', autoSend.checked);
              if (tokenInput.value.trim()) await this.services.vault.set('INGEST_TOKEN', tokenInput.value.trim());
              tokenInput.value = '';
              this.app.toast.success('Koneksi platform disimpan.');
            } catch (error) {
              this.app.toast.error(error.message);
            }
          }
        }),
        el('button', {
          class: 'hx-btn is-small is-primary', type: 'button', text: 'Uji koneksi',
          onclick: async () => {
            status.textContent = 'Menguji…';
            status.className = 'hx-muted hx-small';
            try {
              await settings.set('platform.url', urlInput.value.trim());
              await settings.set('platform.enabled', true);
              if (tokenInput.value.trim()) await this.services.vault.set('INGEST_TOKEN', tokenInput.value.trim());
              const result = await this.services.platform.test();
              status.textContent = result.detail || 'Terhubung.';
              status.className = 'hx-muted hx-small';
              this.app.toast.success('Platform terhubung.');
            } catch (error) {
              status.textContent = error.message;
              status.className = 'hx-danger';
            }
          }
        }),
        platform.enabled ? el('button', {
          class: 'hx-btn is-small', type: 'button', text: 'Flush outbox',
          onclick: async () => {
            try {
              const result = await this.services.platform.flushOutbox();
              this.app.toast.success(`Outbox: ${result.sent} terkirim, ${result.failed} gagal.`);
            } catch (error) {
              this.app.toast.error(error.message);
            }
          }
        }) : null
      ),
      status,
      note('Platform menerima envelope berisi action, payload, dan idempotencyKey. Bila platform menolak, outbox otomatis dijeda.')
    );
    return this.node;
  }
}
