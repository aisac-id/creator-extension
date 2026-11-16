import { el } from '../../ui/Dom.js';
import { BRANDING } from '../../config/branding.js';
import { lead, note, field, segmented, checkLine } from './Ui.js';

function welcome(flow) {
  const items = [
    ['Ide & naskah', 'Bank ide, hook, naskah, caption, hashtag.'],
    ['Panen & data', 'Gambar, teks, tabel, analisis, ekspor.'],
    ['Jadwal & produksi', 'Kalender, checklist syuting, aset.'],
    ['Deal & analitik', 'Pipeline klien, invoice, metrik harian.']
  ];
  return el('div', {},
    lead(`Satu tempat untuk seluruh alur kerja kreator. ${BRANDING.product} menyimpan data secara lokal, tanpa akun wajib.`),
    el('div', { class: 'hx-onboard-grid' }, items.map(([title, text]) => el('div', { class: 'hx-card is-flat' },
      el('strong', { text: title }),
      el('div', { class: 'hx-help', text })
    ))),
    note('Panduan ini memakai data contoh dan bisa diselesaikan 2 menit. Kamu bisa melewati bagian yang belum dibutuhkan.')
  );
}

function languageTheme(flow) {
  const settings = flow.services.settings;
  const theme = settings.get('ui.theme', 'system');
  const choices = segmented([
    ['system', 'Sistem'],
    ['light', 'Terang'],
    ['dark', 'Gelap']
  ], theme, async (value) => {
    await settings.set('ui.theme', value);
    flow.app.applyAppearance();
  });
  const language = el('select', { class: 'hx-select' },
    el('option', { value: 'id', text: 'Bahasa Indonesia', selected: settings.get('general.language', 'id') === 'id' }),
    el('option', { value: 'en', text: 'English', selected: settings.get('general.language', 'id') === 'en' })
  );
  language.addEventListener('change', () => settings.set('general.language', language.value));
  return el('div', {},
    lead('Pilih bahasa dan tema yang nyaman. Perubahan langsung terlihat di sidebar ini.'),
    field('Bahasa antarmuka', language, 'Teks panduan dan panel mengikuti pilihan ini.'),
    field('Tema tampilan', choices),
    note('Tema Gelap cocok untuk kerja malam; Sistem mengikuti pengaturan perangkat.')
  );
}

function license(flow) {
  const license = flow.services.license;
  const label = license.label();
  const limits = license.limits();
  const key = el('input', { class: 'hx-input', type: 'password', placeholder: 'CH1.payload.signature', autocomplete: 'off' });
  const status = el('div', { class: 'hx-help' });
  const activate = el('button', { class: 'hx-btn', type: 'button', text: 'Aktifkan kode' });
  activate.addEventListener('click', async () => {
    activate.disabled = true;
    status.textContent = 'Memeriksa tanda tangan lisensi...';
    try {
      const parsed = await license.activate(key.value);
      flow.app.refreshLicense();
      status.textContent = `Berhasil: edition ${parsed.edition}${parsed.exp ? ` sampai ${parsed.exp}` : ''}.`;
      status.className = 'hx-help is-ok';
    } catch (error) {
      status.textContent = error.message;
      status.className = 'hx-help is-error';
    } finally {
      activate.disabled = false;
    }
  });
  const freeNote = Number.isFinite(limits.ideas)
    ? `Edition Free tetap bisa dipakai: ${limits.ideas} ide, ${limits.scripts} naskah, ${limits.calendar} jadwal. Data tidak pernah dikunci.`
    : 'Semua batas sedang terbuka.';
  return el('div', {},
    lead(`Status saat ini: ${label.text}. Trial 14 hari otomatis aktif untuk mencoba semua fitur Pro.`),
    el('div', { class: 'hx-card is-accent' },
      el('div', { class: 'hx-kv' }, el('span', { text: 'Edition' }), el('span', { text: label.code })),
      el('div', { class: 'hx-kv' }, el('span', { text: 'Sisa trial' }), el('span', { text: `${license.trialDaysLeft} hari` })),
      el('div', { class: 'hx-help', text: freeNote })
    ),
    field('Punya kode lisensi?', el('div', { class: 'hx-toolbar' }, key, activate), 'Opsional. Kode diverifikasi offline, tanpa mengirim data.'),
    status,
    note('Enterprise / bundle memakai format kode yang sama. Refund dan aktivasi ulang dijelaskan di README.')
  );
}

function tour(flow) {
  const line = checkLine(Boolean(flow.state.tourDone), 'Tur singkat sudah dijalankan.');
  const button = el('button', {
    class: 'hx-btn is-primary',
    type: 'button',
    text: flow.state.tourDone ? 'Ulangi tur' : 'Jalankan tur singkat'
  });
  button.addEventListener('click', async () => {
    button.disabled = true;
    await flow.runTour();
    line.replaceWith(checkLine(true, 'Tur singkat sudah dijalankan.'));
    button.disabled = false;
    button.textContent = 'Ulangi tur';
  });
  return el('div', {},
    lead('Kenali lima area utama: rail fitur, ide, panen, data, dan tombol mode. Tur menyorot elemen aslinya, bukan gambar.'),
    el('div', { class: 'hx-toolbar' }, button),
    line,
    note('Tur bisa diulang kapan saja dari tombol ? → Panduan singkat.')
  );
}

export const CORE_STEPS = [
  { id: 'welcome', title: 'Selamat datang di Creator Harness', build: welcome, nextLabel: 'Mulai (2 menit)' },
  { id: 'language', title: 'Bahasa & tema', build: languageTheme },
  { id: 'license', title: 'Lisensi & trial', build: license },
  { id: 'tour', title: 'Tur singkat antarmuka', build: tour }
];
