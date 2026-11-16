import { el } from '../ui/Dom.js';
import { Modal } from '../ui/Modal.js';
import { LICENSING } from '../config/branding.js';

const EDITIONS = [
  { id: 'free', name: 'Free', detail: 'Data tidak pernah dikunci. Batas jumlah item & tanpa AI/Platform.' },
  { id: 'pro', name: 'Pro', detail: 'AI multi-provider, panen & export lanjutan, invoice. 1 pengguna.' },
  { id: 'bundle', name: 'Bundle', detail: 'Semua fitur Pro untuk beberapa seat / tim kecil.' },
  { id: 'enterprise', name: 'Enterprise', detail: 'White-label, seat besar, dukungan prioritas.' }
];

function statusRow(label, value, tone = '') {
  return el('div', { class: 'hx-kv' },
    el('span', { class: 'hx-muted', text: label }),
    value instanceof Node ? value : el('span', { class: `hx-badge${tone ? ` ${tone}` : ''}`, text: value })
  );
}

function toneClass(tone) {
  if (tone === 'pro') return 'is-pro';
  if (tone === 'warn') return 'is-warn';
  return '';
}

/** Modal lisensi: aktivasi offline, status edition, dan perbandingan singkat. */
export function openLicenseModal(app) {
  const license = app.services.license;
  const modal = new Modal(app, {
    title: 'Lisensi',
    subtitle: 'Verifikasi offline Ed25519 — tidak ada data yang dikirim ke server.'
  });
  const message = el('p', { class: 'hx-muted', text: '' });
  const input = el('textarea', {
    class: 'hx-textarea',
    rows: 3,
    placeholder: 'Tempel kode lisensi CH1.xxxxxxxx.yyyyyyyy',
    spellcheck: 'false'
  });
  const body = el('div', {},
    el('div', { class: 'hx-card' },
      statusRow('Edition', license.label().text, toneClass(license.label().tone)),
      statusRow('Sisa trial', license.trialDaysLeft ? `${license.trialDaysLeft} hari` : 'habis', license.trialDaysLeft ? 'is-warn' : 'is-danger'),
      license.license?.to ? statusRow('Terdaftar untuk', license.license.to) : null,
      license.license?.exp ? statusRow('Berlaku sampai', license.license.exp) : null
    ),
    el('div', { class: 'hx-field' },
      el('label', { class: 'hx-label', text: 'Kode lisensi' }),
      input
    ),
    message,
    el('p', { class: 'hx-muted hx-small', text: `Kode diawali ${LICENSING.keyPrefix}. Butuh bantuan? Hubungi pembuat lewat tautan dukungan di README.` }),
    el('div', { class: 'hx-grid hx-grid-2' }, EDITIONS.map((edition) => el('div', { class: 'hx-card is-flat' },
      el('strong', { text: edition.name }),
      el('p', { class: 'hx-muted hx-small', text: edition.detail })
    )))
  );
  if (license.license?.rawKey) input.value = license.license.rawKey;
  modal.setBody(body);

  modal.action('Tutup', () => modal.close(), 'is-ghost');
  if (license.license) {
    modal.action('Nonaktifkan', async () => {
      await license.deactivate();
      app.refreshLicense();
      app.toast.info('Lisensi dinonaktifkan. Data tetap aman.');
      modal.close();
    }, 'is-danger');
  }
  modal.action('Aktifkan', async () => {
    message.textContent = 'Memverifikasi…';
    try {
      const parsed = await license.activate(input.value);
      app.refreshLicense();
      app.toast.success(`Lisensi ${parsed.edition.toUpperCase()} aktif.`);
      modal.close();
    } catch (error) {
      message.textContent = error.message || 'Kode tidak valid.';
      message.className = 'hx-text hx-danger';
    }
  }, 'is-primary');
  modal.open();
  return modal;
}
