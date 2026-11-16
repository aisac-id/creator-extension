import { el, mountIcon } from './Dom.js';

/** Kerangka panel: header tetap, isi scroll, helper form/kartu. */
export class BasePanel {
  constructor(app) {
    this.app = app;
    this.root = null;
    this.disposers = [];
    this.title = '';
    this.subtitle = '';
  }

  get services() {
    return this.app.services;
  }

  get settings() {
    return this.app.services.settings;
  }

  async mount(container) {
    this.root = el('div', { class: 'hx-panel' });
    container.replaceChildren(this.root);
    this.head = el('div', { class: 'hx-panel-head' });
    this.body = el('div', { class: 'hx-panel-body' });
    this.root.append(this.head, this.body);
    this.renderHead();
    await this.build();
    return this;
  }

  renderHead() {
    this.head.replaceChildren(
      el('div', { class: 'hx-head-text' },
        el('h2', { class: 'hx-panel-title', text: this.title }),
        this.subtitle ? el('p', { class: 'hx-panel-sub', text: this.subtitle }) : null
      ),
      el('div', { class: 'hx-head-actions' },
        el('button', {
          class: 'hx-icon-btn', type: 'button', 'aria-label': 'Bantuan panel',
          title: 'Bantuan panel', onclick: () => this.app.showHelp(this.title, this.helpText || this.subtitle)
        }, mountIcon('help'))
      )
    );
  }

  async build() {}

  add(...nodes) {
    this.body.append(...nodes.flat(4).filter(Boolean));
    return this.body;
  }

  section(title, actions = []) {
    const head = el('div', { class: 'hx-section-head' },
      el('h3', { class: 'hx-section-title', text: title }),
      el('div', { class: 'hx-section-actions' }, actions)
    );
    const section = el('section', { class: 'hx-section' }, head);
    this.body.append(section);
    return section;
  }

  card(...nodes) {
    const card = el('div', { class: 'hx-card' }, nodes);
    this.body.append(card);
    return card;
  }

  empty(title, hint = '') {
    return el('div', { class: 'hx-empty' },
      el('div', { class: 'hx-empty-title', text: title }),
      hint ? el('p', { class: 'hx-muted', text: hint }) : null
    );
  }

  track(disposer) {
    if (typeof disposer === 'function') this.disposers.push(disposer);
    return disposer;
  }

  toast(kind, message) {
    this.app.toast[kind]?.(message);
  }

  async guard(fn, successMessage = '') {
    try {
      const result = await fn();
      if (successMessage) this.toast('success', successMessage);
      return result;
    } catch (error) {
      this.toast('error', error.message || 'Terjadi kesalahan.');
      return null;
    }
  }

  async confirm(message, title = 'Konfirmasi') {
    if (!this.settings.get('general.confirmDelete', true)) return true;
    return this.app.confirm({ title, message });
  }

  destroy() {
    this.disposers.forEach((fn) => {
      try { fn(); } catch { /* diabaikan saat panel ditutup */ }
    });
    this.disposers = [];
    this.root?.remove();
  }
}
