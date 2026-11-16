import { el } from '../../ui/Dom.js';
import { ScraperHub } from '../../scrapers/ScraperHub.js';
import { lead, note, logBox, pushLog, demoFrame } from './Ui.js';

const MODE_LABEL = { rail: 'Rail', sidebar: 'Sidebar', full: 'Layar Penuh' };

function modeStep(flow) {
  const active = el('span', { text: 'Memeriksa tab aktif...' });
  const noteLine = el('p', { class: 'hx-help', text: '' });
  flow.services.activeTab().then((tab) => {
    if (!tab) {
      active.textContent = 'Tidak ada tab aktif';
      return;
    }
    active.textContent = tab.title || tab.url || 'Tab tanpa judul';
    if (!/^https?:/i.test(tab.url || '')) {
      noteLine.textContent = 'Halaman internal browser tidak bisa disuntik. Buka situs biasa untuk mencoba panen nyata.';
    }
  }).catch(() => { active.textContent = 'Tidak dapat membaca tab aktif'; });

  const mark = el('span', { class: 'hx-onboard-mark', text: '•' });
  const text = el('span', { text: 'Mode tampilan belum dicoba.' });
  const check = el('div', { class: 'hx-onboard-check' }, mark, text);
  const buttons = Object.entries(MODE_LABEL).map(([mode, label]) => {
    const button = el('button', { class: 'hx-btn is-small', type: 'button', text: label });
    button.addEventListener('click', async () => {
      await flow.app.applyMode(mode);
      mark.textContent = '✓';
      text.textContent = `Mode ${label} aktif. Klik tombol mode di header kapan saja.`;
      check.classList.add('is-done');
    });
    return button;
  });
  return el('div', {},
    lead('Sidebar menempel di kanan halaman. Coba ketiga mode untuk melihat mana yang paling nyaman di layarmu.'),
    el('div', { class: 'hx-card is-flat' },
      el('div', { class: 'hx-kv' }, el('span', { text: 'Halaman aktif' }), active),
      el('div', { class: 'hx-help', text: 'Alt+Shift+S = Sidebar · Alt+Shift+F = Layar Penuh · Esc = tutup' })
    ),
    el('div', { class: 'hx-toolbar' }, buttons),
    noteLine,
    check
  );
}

async function harvestDemo(flow, iframe, log) {
  const doc = iframe.contentDocument;
  if (!doc) throw new Error('Halaman demo belum siap.');
  const settings = {
    get: (key, fallback) => (key === 'scraper.autoScroll' ? false : flow.services.settings.get(key, fallback))
  };
  const hub = new ScraperHub({ doc, win: iframe.contentWindow, settings, log });
  log('Memindai gambar, teks, dan tabel...');
  const result = await hub.harvest({ images: true, text: true });
  const created = [];
  const sourceUrl = result.sourceUrl || 'demo/index.html';
  if (result.images?.items?.length) {
    const dataset = await flow.services.pipeline.ingestImages({
      sourceUrl,
      title: 'Demo — Galeri Studio',
      items: result.images.items,
      onProgress: (done, total) => log(`Gambar ${done}/${total} tersimpan`)
    });
    created.push(dataset);
  }
  if (result.text?.text || result.text?.tables?.length) {
    created.push(await flow.services.pipeline.ingestText({
      sourceUrl,
      title: 'Demo — Artikel Studio',
      text: result.text.text,
      tables: result.text.tables,
      meta: result.text.meta
    }));
  }
  const count = created.reduce((sum, dataset) => sum + (Number(dataset.count) || 0), 0);
  return { created, count };
}

function demoStep(flow) {
  const frame = demoFrame();
  const log = logBox({ height: 92 });
  const status = el('div', { class: 'hx-help', text: 'Belum dijalankan.' });
  const button = el('button', { class: 'hx-btn is-primary', type: 'button', text: 'Panen dari halaman demo' });
  button.addEventListener('click', async () => {
    button.disabled = true;
    log.replaceChildren();
    status.textContent = 'Memproses...';
    try {
      await frame.ready;
      const { created, count } = await harvestDemo(flow, frame.iframe, (message) => pushLog(log, message));
      flow.state.demoIds = created.map((dataset) => dataset.id);
      flow.state.demoCount = count;
      status.textContent = `Berhasil: ${count} item tersimpan dari halaman demo.`;
      status.className = 'hx-help is-ok';
      flow.gate(count >= 3);
      flow.app.toast.success(`Demo panen: ${count} item masuk ke Data.`);
    } catch (error) {
      status.textContent = `Gagal: ${error.message}`;
      status.className = 'hx-help is-error';
      pushLog(log, `Error: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
  flow.gate(flow.state.demoCount >= 3);
  return el('div', {},
    lead('Ini panen sungguhan dari halaman demo lokal: gambar, teks, dan tabel disimpan ke perpustakaan Data.'),
    frame.wrap,
    el('div', { class: 'hx-toolbar' }, button),
    log,
    status,
    note('Minimal 3 item agar lanjut. Tidak ada data yang dikirim ke internet.')
  );
}

function dataStep(flow) {
  const lines = el('div', {});
  const render = (datasets) => {
    lines.replaceChildren(...datasets.slice(0, 4).map((dataset) => el('div', { class: 'hx-kv' },
      el('span', { text: dataset.title || dataset.kind }),
      el('span', { text: `${dataset.count || 0} item` })
    )));
    if (!datasets.length) lines.append(el('p', { class: 'hx-help', text: 'Belum ada dataset. Jalankan langkah panen demo.' }));
  };
  flow.services.library.listDatasets().then((datasets) => {
    render(datasets);
    if (!flow.state.demoCount) {
      flow.state.demoCount = datasets.reduce((sum, dataset) => sum + (Number(dataset.count) || 0), 0);
    }
  });
  const open = el('button', { class: 'hx-btn is-primary', type: 'button', text: 'Buka panel Data' });
  open.addEventListener('click', () => flow.peek('data'));
  return el('div', {},
    lead('Semua hasil panen masuk ke perpustakaan lokal. Buka panel Data untuk melihat galeri, teks, tabel, dan analisisnya.'),
    el('div', { class: 'hx-card is-flat' }, lines),
    el('div', { class: 'hx-toolbar' }, open),
    note('Panel Data punya tombol ? untuk penjelasan format ekspor dan penyimpanan.')
  );
}

function exportStep(flow) {
  const status = el('p', { class: 'hx-help', text: 'Pilih format untuk mengunduh hasil demo.' });
  const buttons = [['json', 'JSON'], ['csv', 'CSV'], ['md', 'Markdown']].map(([format, label]) => {
    const button = el('button', { class: 'hx-btn', type: 'button', text: label, disabled: !flow.state.exportId });
    button.addEventListener('click', async () => {
      buttons.forEach((item) => { item.disabled = true; });
      status.textContent = 'Menyiapkan berkas...';
      try {
        const filename = await flow.services.exporter.export(flow.state.exportId, format);
        flow.state.exported = filename;
        status.textContent = `Berkas dibuat: ${filename}. Pilih lokasi di dialog unduhan.`;
        status.className = 'hx-help is-ok';
        flow.gate(true);
        flow.app.toast.success('Ekspor dimulai.');
      } catch (error) {
        status.textContent = `Ekspor gagal: ${error.message}`;
        status.className = 'hx-help is-error';
      } finally {
        buttons.forEach((item) => { item.disabled = false; });
      }
    });
    return button;
  });
  flow.gate(Boolean(flow.state.exported));
  return el('div', {},
    lead('Ekspor data demo ke berkas nyata. Format JSON cocok untuk arsip, CSV untuk spreadsheet, Markdown untuk catatan.'),
    el('div', { class: 'hx-card is-flat' },
      el('div', { class: 'hx-kv' }, el('span', { text: 'Dataset' }), el('span', { text: flow.state.exportId ? 'siap' : 'tidak ada' })),
      el('div', { class: 'hx-help', text: 'ZIP (gambar + manifest) tersedia di panel Data untuk edition Pro/Trial.' })
    ),
    el('div', { class: 'hx-toolbar' }, buttons),
    status,
    note('Semua ekspor dibuat lokal lewat chrome.downloads; tidak ada unggahan.')
  );
}

export const SETUP_STEPS = [
  { id: 'mode', title: 'Buka sidebar & layar penuh', build: modeStep },
  { id: 'demo', title: 'Panen demo pertama', build: demoStep },
  { id: 'data', title: 'Lihat hasil di Data', build: dataStep },
  {
    id: 'export',
    title: 'Ekspor berkas nyata',
    build: exportStep,
    async enter(flow) {
      if (!flow.state.demoIds?.length || !flow.state.exportId) {
        const datasets = await flow.services.library.listDatasets();
        if (!flow.state.demoIds?.length) flow.state.demoIds = datasets.slice(0, 2).map((dataset) => dataset.id);
        flow.state.exportId = flow.state.demoIds[0] || datasets[0]?.id || null;
      }
    }
  }
];
