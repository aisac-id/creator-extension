import { el, clear, mountIcon } from './Dom.js';

/** Toast ringan untuk umpan balik aksi. */
export class Toast {
  constructor(root) {
    this.layer = el('div', { class: 'hx-toasts', role: 'status', 'aria-live': 'polite' });
    root.append(this.layer);
  }

  show(message, kind = 'info', timeout = 3600) {
    const node = el('div', { class: `hx-toast hx-toast-${kind}` },
      el('span', { class: 'hx-toast-dot' }),
      el('span', { class: 'hx-toast-text', text: message })
    );
    this.layer.append(node);
    requestAnimationFrame(() => node.classList.add('is-in'));
    setTimeout(() => {
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 220);
    }, timeout);
    return node;
  }

  success(message) { return this.show(message, 'success'); }
  info(message) { return this.show(message, 'info'); }
  warn(message) { return this.show(message, 'warn', 4600); }
  error(message) { return this.show(message, 'error', 5600); }
}

/** Modal dengan fokus, Esc, dan footer tombol. */
export class Modal {
  constructor(app, { title = '', subtitle = '', wide = false, onClose = null } = {}) {
    this.app = app;
    this.onClose = onClose;
    this.overlay = el('div', { class: 'hx-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
    this.card = el('div', { class: `hx-modal${wide ? ' is-wide' : ''}` });
    this.head = el('div', { class: 'hx-modal-head' });
    this.title = el('div', { class: 'hx-modal-title', text: title });
    this.subtitle = el('div', { class: 'hx-modal-sub', text: subtitle });
    this.closeBtn = el('button', { class: 'hx-icon-btn', type: 'button', 'aria-label': 'Tutup' }, mountIcon('close'));
    this.body = el('div', { class: 'hx-modal-body' });
    this.footer = el('div', { class: 'hx-modal-foot' });
    this.head.append(el('div', { class: 'hx-modal-headtext' }, this.title, this.subtitle), this.closeBtn);
    this.card.append(this.head, this.body, this.footer);
    this.overlay.append(this.card);
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });
    this.keyHandler = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    };
    document.addEventListener('keydown', this.keyHandler, true);
    requestAnimationFrame(() => this.overlay.classList.add('is-open'));
  }

  setBody(...children) {
    clear(this.body);
    this.body.append(...children.flat(3).filter(Boolean));
    return this;
  }

  setFooter(...children) {
    clear(this.footer);
    this.footer.append(...children.flat(3).filter(Boolean));
    return this;
  }

  action(label, handler, kind = '') {
    const button = el('button', { class: `hx-btn ${kind}`, type: 'button', text: label });
    button.addEventListener('click', handler);
    this.footer.append(button);
    return button;
  }

  open() {
    (this.app.overlayRoot || document.body).append(this.overlay);
    setTimeout(() => this.body.querySelector('input, textarea, select, button')?.focus(), 30);
    return this;
  }

  close() {
    this.overlay.classList.remove('is-open');
    document.removeEventListener('keydown', this.keyHandler, true);
    setTimeout(() => this.overlay.remove(), 160);
    this.onClose?.();
  }

  static confirm(app, { title, message, confirmLabel = 'Hapus', danger = true } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const modal = new Modal(app, { title });
      modal.setBody(el('p', { class: 'hx-muted', text: message }));
      modal.action('Batal', () => {
        answered = true;
        modal.close();
        resolve(false);
      });
      modal.action(confirmLabel, () => {
        answered = true;
        modal.close();
        resolve(true);
      }, danger ? 'is-danger' : 'is-primary');
      modal.onClose = () => {
        if (!answered) resolve(false);
      };
      modal.open();
    });
  }
}
