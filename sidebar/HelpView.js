import { el } from '../ui/Dom.js';
import { Modal } from '../ui/Modal.js';
import { BRANDING } from '../config/branding.js';

const SHORTCUTS = [
  ['Alt+Shift+S', 'Tampilkan / sembunyikan sidebar'],
  ['Alt+Shift+F', 'Mode layar penuh'],
  ['Esc', 'Kembali ke sidebar / tutup'],
  ['Klik ikon rail', 'Pindah panel tanpa reload halaman']
];

/** Modal bantuan global (tombol ? di header). */
export function showHelp(app, title = null, body = null) {
  const modal = new Modal(app, {
    title: title || `Bantuan ${BRANDING.product}`,
    subtitle: BRANDING.tagline,
    wide: true
  });
  modal.setBody(
    el('p', { class: 'hx-muted', text: body || 'Semua pekerjaan konten dalam satu sidebar: ide, naskah, kalender, panen aset, riset, deal, analitik, automasi, dan AI.' }),
    el('div', { class: 'hx-card' }, SHORTCUTS.map(([key, text]) => el('div', { class: 'hx-kv' },
      el('span', { class: 'hx-code', text: key }),
      el('span', { text })
    ))),
    el('p', { class: 'hx-muted hx-small', text: `${BRANDING.product} ${BRANDING.version} · standar ${BRANDING.standard}` }),
    el('div', { class: 'hx-row' },
      el('button', {
        class: 'hx-btn', type: 'button', text: 'Panduan lengkap',
        onclick: () => app.openTab(BRANDING.docsUrl)
      }),
      el('button', {
        class: 'hx-btn', type: 'button', text: 'Mulai ulang tur',
        onclick: () => {
          modal.close();
          app.startOnboarding(true);
        }
      })
    )
  );
  modal.action('Tutup', () => modal.close(), 'is-primary');
  modal.open();
  return modal;
}
