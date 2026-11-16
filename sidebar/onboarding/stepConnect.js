import { el } from '../../ui/Dom.js';
import { RpaEngine } from '../../rpa/RpaEngine.js';
import { lead, note, field, logBox, pushLog, checkLine, demoFrame } from './Ui.js';

const KEY_NAMES = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };
const PROVIDERS = [['openai', 'OpenAI-compatible'], ['anthropic', 'Anthropic'], ['gemini', 'Gemini'], ['ollama', 'Ollama lokal']];

function llmStep(flow) {
  const settings = flow.services.settings;
  const vault = flow.services.vault;
  const provider = el('select', { class: 'hx-select' }, PROVIDERS.map(([id, label]) => el('option', {
    value: id,
    text: label,
    selected: settings.get('llm.defaultProvider', 'openai') === id
  })));
  const key = el('input', { class: 'hx-input', type: 'password', placeholder: 'API key (disimpan terenkripsi)', autocomplete: 'off' });
  const status = el('p', { class: 'hx-help', text: 'Opsional. Bisa dilewati dan diatur nanti di Koneksi.' });
  const sync = () => {
    const id = provider.value;
    key.disabled = id === 'ollama';
    key.placeholder = id === 'ollama' ? 'Ollama tidak perlu API key' : 'API key (disimpan terenkripsi)';
  };
  provider.addEventListener('change', sync);
  sync();
  const test = el('button', { class: 'hx-btn', type: 'button', text: 'Simpan & uji' });
  test.addEventListener('click', async () => {
    const id = provider.value;
    test.disabled = true;
    status.textContent = 'Menyimpan kredensial dan menguji koneksi...';
    status.className = 'hx-help';
    try {
      if (id !== 'ollama' && key.value.trim()) await vault.set(KEY_NAMES[id], key.value.trim());
      await settings.set(`llm.providers.${id}.enabled`, true);
      await settings.set('llm.defaultProvider', id);
      const result = await flow.services.llm.test(id);
      flow.state.llmTested = result.ok;
      status.textContent = `${id}: ${result.detail}`;
      status.className = `hx-help ${result.ok ? 'is-ok' : 'is-error'}`;
      if (result.ok) key.value = '';
    } catch (error) {
      status.textContent = `Gagal: ${error.message}`;
      status.className = 'hx-help is-error';
    } finally {
      test.disabled = false;
    }
  });
  return el('div', {},
    lead('AI membantu ide, naskah, caption, dan riset. Kunci disimpan di SecretVault (AES-GCM 256), bukan di sync.'),
    field('Provider', provider),
    field('API key', key, 'Kosongkan jika memakai Ollama lokal atau ingin memakai kunci yang sudah tersimpan.'),
    el('div', { class: 'hx-toolbar' }, test),
    status,
    note('Provider lain dan fallback berurutan tersedia di Koneksi. Import .env juga didukung.')
  );
}

function platformStep(flow) {
  const settings = flow.services.settings;
  const url = el('input', { class: 'hx-input', type: 'url', placeholder: 'https://platform-kamu.example.com', value: settings.get('platform.url', '') });
  const token = el('input', { class: 'hx-input', type: 'password', placeholder: 'INGEST_TOKEN', autocomplete: 'off' });
  const status = el('p', { class: 'hx-help', text: `Saat ini ${settings.get('platform.enabled', false) ? 'aktif' : 'nonaktif'} (default nonaktif).` });
  const test = el('button', { class: 'hx-btn', type: 'button', text: 'Aktifkan & uji' });
  const off = el('button', { class: 'hx-btn is-ghost is-small', type: 'button', text: 'Biarkan nonaktif' });
  test.addEventListener('click', async () => {
    test.disabled = true;
    status.textContent = 'Menguji koneksi platform...';
    status.className = 'hx-help';
    try {
      await settings.set('platform.url', url.value.trim());
      await settings.set('platform.enabled', true);
      if (token.value.trim()) await flow.services.vault.set('INGEST_TOKEN', token.value.trim());
      const result = await flow.services.connectionHub.test('platform');
      flow.state.platformTested = Boolean(result.ok);
      status.textContent = result.detail || (result.ok ? 'Terhubung.' : 'Gagal terhubung.');
      status.className = `hx-help ${result.ok ? 'is-ok' : 'is-error'}`;
    } catch (error) {
      status.textContent = `Belum terhubung: ${error.message}`;
      status.className = 'hx-help is-error';
    } finally {
      test.disabled = false;
    }
  });
  off.addEventListener('click', async () => {
    await settings.set('platform.enabled', false);
    status.textContent = 'Platform tetap nonaktif. Semua fitur lokal tetap berjalan.';
    status.className = 'hx-help';
  });
  return el('div', {},
    lead('Opsional: kirim hasil panen ke platform milikmu lewat ingest token. Tanpa ini pun semua fitur lokal tetap penuh.'),
    field('Platform URL', url, 'Wajib HTTPS agar token tidak lewat koneksi terbuka.'),
    field('Ingest token', token, 'Hanya disimpan terenkripsi; outbox memakai idempotencyKey.'),
    el('div', { class: 'hx-toolbar' }, test, off),
    status,
    note('Koneksi gagal otomatis menjeda pengiriman. Antrean outbox bisa dikirim ulang dari panel Koneksi.')
  );
}

const RPA_SCRIPT = [
  { action: 'waitForSelector', selector: '#demo-search' },
  { action: 'type', selector: '#demo-search', value: 'konten' },
  { action: 'click', selector: '#demo-search-btn' },
  { action: 'waitForSelector', selector: '.demo-hit' },
  { action: 'extract', selector: '.demo-hit', options: { all: true }, as: 'hasil' }
];

function rpaStep(flow) {
  const frame = demoFrame();
  const log = logBox({ height: 104 });
  const status = el('p', { class: 'hx-help', text: 'Jalankan untuk melihat aksi nyata: isi kolom, klik tombol, lalu ekstrak hasil.' });
  let engine = null;
  const start = el('button', { class: 'hx-btn is-primary', type: 'button', text: 'Jalankan RPA demo' });
  const pause = el('button', { class: 'hx-btn is-small', type: 'button', text: 'Jeda', disabled: true });
  const stop = el('button', { class: 'hx-btn is-danger is-small', type: 'button', text: 'Stop', disabled: true });
  flow.cleanup = () => { engine?.stop(); frame.cancel(); };
  pause.addEventListener('click', () => {
    if (!engine) return;
    if (pause.textContent === 'Jeda') {
      engine.pause();
      pause.textContent = 'Lanjut';
    } else {
      engine.resume();
      pause.textContent = 'Jeda';
    }
  });
  stop.addEventListener('click', () => {
    engine?.stop();
    stop.disabled = true;
    pause.disabled = true;
  });
  start.addEventListener('click', async () => {
    start.disabled = true;
    log.replaceChildren();
    status.textContent = 'Menjalankan...';
    status.className = 'hx-help';
    try {
      await frame.ready;
      const settings = flow.services.settings;
      const config = {
        delayMin: settings.get('rpa.delayMin', 300),
        delayMax: settings.get('rpa.delayMax', 800),
        retry: settings.get('rpa.retry', 3),
        timeoutMs: settings.get('rpa.timeoutMs', 10000),
        maxActionsPerHour: settings.get('rpa.maxActionsPerHour', 120),
        jitter: settings.get('rpa.jitter', true)
      };
      engine = new RpaEngine({ doc: frame.iframe.contentDocument, win: frame.iframe.contentWindow, config, onLog: (entry) => {
        if (entry.level !== 'info' || /Langkah|Mulai|Selesai/.test(entry.message)) pushLog(log, entry.message);
      } });
      pause.disabled = false;
      stop.disabled = false;
      pause.textContent = 'Jeda';
      const summary = await engine.run(RPA_SCRIPT);
      const extracted = summary.results.find((item) => item.action === 'extract')?.data || [];
      flow.state.rpaDone = summary.failed === 0 && !summary.stopped;
      status.textContent = flow.state.rpaDone
        ? `Selesai: ${summary.done}/${summary.total} langkah, ${extracted.length} hasil diekstrak.`
        : `Berhenti: ${summary.done}/${summary.total} langkah, ${summary.failed} gagal.`;
      status.className = `hx-help ${flow.state.rpaDone ? 'is-ok' : 'is-error'}`;
      if (flow.state.rpaDone && !flow.state.rpaSaved) {
        await flow.services.rpaScripts.save({ name: 'Demo — cari & ekstrak', description: 'Script contoh dari panduan awal.', steps: RPA_SCRIPT });
        flow.state.rpaSaved = true;
      }
    } catch (error) {
      status.textContent = `RPA gagal: ${error.message}`;
      status.className = 'hx-help is-error';
      pushLog(log, `Error: ${error.message}`);
    } finally {
      start.disabled = false;
      pause.disabled = true;
      stop.disabled = true;
      engine = null;
    }
  });
  return el('div', {},
    lead('Otomasi memakai lapisan RPA wajib: selector tahan perubahan, pacing, retry, jeda, dan stop. Script tersimpan bisa dijalankan ulang dari panel Otomasi.'),
    frame.wrap,
    el('div', { class: 'hx-toolbar' }, start, pause, stop),
    log,
    status,
    note('Script demo juga disimpan ke panel Otomasi agar bisa diedit atau diekspor sebagai JSON.')
  );
}

function finishStep(flow) {
  const state = flow.state;
  const rows = [
    [state.tourDone, 'Tur antarmuka dijalankan'],
    [state.demoCount >= 3, `Panen demo (${state.demoCount || 0} item)`],
    [Boolean(state.exported), `Ekspor berkas${state.exported ? `: ${state.exported}` : ''}`],
    [state.llmTested, 'Koneksi AI diuji (opsional)'],
    [state.platformTested, 'Koneksi platform diuji (opsional)'],
    [state.rpaDone, 'RPA demo berjalan (opsional)']
  ];
  const repeat = el('button', { class: 'hx-btn', type: 'button', text: 'Ulangi tur' });
  repeat.addEventListener('click', () => flow.runTour());
  const help = el('button', { class: 'hx-btn is-ghost', type: 'button', text: 'Buka bantuan' });
  help.addEventListener('click', () => flow.app.showHelp());
  const label = flow.services.license.label();
  return el('div', {},
    lead('Kamu siap mulai. Berikut ringkasan langkah yang sudah dicoba dan hal yang bisa dilakukan berikutnya.'),
    el('div', { class: 'hx-card is-flat' }, rows.map(([ok, text]) => checkLine(Boolean(ok), text))),
    el('div', { class: 'hx-card' },
      el('div', { class: 'hx-kv' }, el('span', { text: 'Edition' }), el('span', { text: `${label.code} — ${label.text}` })),
      el('div', { class: 'hx-kv' }, el('span', { text: 'Data' }), el('span', { text: '100% lokal di perangkat' })),
      el('div', { class: 'hx-help', text: 'Setiap panel punya tombol ? untuk panduan singkat. Pengaturan lengkap ada di panel Setelan.' })
    ),
    el('div', { class: 'hx-toolbar' }, repeat, help),
    note('Panduan bisa diulang kapan saja dari Setelan atau tombol ?. Tekan Esc untuk menutup sidebar.')
  );
}

export const CONNECT_STEPS = [
  { id: 'llm', title: 'Hubungkan AI (opsional)', build: llmStep, nextLabel: 'Lanjut / lewati' },
  { id: 'platform', title: 'Kirim ke platform (opsional)', build: platformStep, nextLabel: 'Lanjut / lewati' },
  { id: 'rpa', title: 'Jalankan RPA pertama (opsional)', build: rpaStep, nextLabel: 'Lanjut / lewati' },
  { id: 'finish', title: 'Selesai — mulai berkarya', build: finishStep, nextLabel: 'Selesai' }
];
