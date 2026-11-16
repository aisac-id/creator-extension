import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { fmtBytes, fmtDate, fmtNumber } from '../../core/Format.js';
import { badge, itemRow, iconButton, toolbar } from './PanelKit.js';

export class DataPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Data & Export';
    this.subtitle = 'Perpustakaan hasil panen';
    this.helpText = 'Semua hasil panen tersimpan lokal di IndexedDB. Export ke JSON, CSV, Markdown, TXT, atau ZIP.';
    this.selectedId = null;
    this.urls = [];
  }

  async build() {
    this.usageNode = el('div');
    this.add(this.usageNode);
    this.add(toolbar(
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Muat ulang', onclick: () => this.refresh() }),
      el('button', { class: 'hx-btn is-small is-danger', type: 'button', text: 'Bersihkan semua', onclick: () => this.clearAll() })
    ));
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    this.detailNode = el('div');
    this.add(this.detailNode);
    await this.refresh();
  }

  releaseUrls() {
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls = [];
  }

  destroy() {
    this.releaseUrls();
    super.destroy();
  }

  async refresh() {
    const [usage, datasets] = await Promise.all([this.services.library.usage(), this.services.library.listDatasets()]);
    this.usageNode.replaceChildren(el('div', { class: 'hx-card is-flat' },
      el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Dataset' }), el('span', { text: fmtNumber(datasets.length) })),
      el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Ukuran' }), el('span', { text: fmtBytes(usage.bytes) }))
    ));
    this.listNode.replaceChildren();
    if (!datasets.length) {
      this.listNode.append(this.empty('Perpustakaan kosong', 'Buka Panen Aset lalu simpan hasilnya ke perpustakaan.'));
      this.detailNode.replaceChildren();
      return;
    }
    datasets.forEach((dataset) => {
      this.listNode.append(itemRow({
        title: dataset.title || dataset.kind,
        meta: fmtDate(dataset.createdAt, 'short'),
        subtitle: `${dataset.count || 0} item · ${fmtBytes(dataset.bytes || 0)}`,
        active: dataset.id === this.selectedId,
        onClick: () => this.select(dataset.id),
        actions: [
          badge(dataset.kind === 'images' ? 'Gambar' : 'Teks'),
          iconButton('trash', 'Hapus dataset', () => this.remove(dataset))
        ]
      }));
    });
    const target = datasets.find((dataset) => dataset.id === this.selectedId) || datasets[0];
    if (target) await this.select(target.id);
  }

  async select(id) {
    this.selectedId = id;
    this.releaseUrls();
    const { dataset, stats } = await this.services.analysis.analyzeDataset(this.services.library, id);
    if (!dataset) {
      this.detailNode.replaceChildren();
      return;
    }
    const items = await this.services.library.itemsOf(id, { limit: 40 });
    const head = el('div', { class: 'hx-section-head' },
      el('h3', { class: 'hx-section-title', text: dataset.title || 'Dataset' }),
      el('div', { class: 'hx-section-actions' },
        badge(`${stats.count} item`, 'is-pro')
      )
    );
    const gallery = el('div', { class: 'hx-gallery' });
    const texts = el('div', { class: 'hx-list' });
    for (const item of items) {
      if (item.blobId) {
        const record = await this.services.library.getBlob(item.blobId);
        if (!record) continue;
        const url = URL.createObjectURL(record.thumb || record.blob);
        this.urls.push(url);
        gallery.append(el('div', { class: 'hx-thumb' },
          el('img', { src: url, alt: item.alt || item.title || 'aset', loading: 'lazy' }),
          el('div', { class: 'hx-thumb-meta', text: `${item.width || '?'}×${item.height || '?'}` })
        ));
      } else if (item.text) {
        texts.append(el('div', { class: 'hx-item' },
          el('div', { class: 'hx-item-sub', text: String(item.text).slice(0, 220) })
        ));
      }
    }
    const exports = el('div', { class: 'hx-row' },
      ['json', 'csv', 'md', 'txt', 'zip'].map((format) => el('button', {
        class: 'hx-btn is-small', type: 'button', text: format.toUpperCase(),
        onclick: () => this.export(format)
      }))
    );
    this.detailNode.replaceChildren(
      el('div', { class: 'hx-section' },
        head,
        el('div', { class: 'hx-card is-flat' },
          el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Sumber' }), el('span', { text: dataset.sourceUrl || '—' })),
          el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Kata' }), el('span', { text: fmtNumber(stats.words) })),
          el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Duplikat URL' }), el('span', { text: fmtNumber(stats.duplicates) })),
          el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Ukuran' }), el('span', { text: fmtBytes(stats.bytes) }))
        ),
        exports,
        gallery.childElementCount ? gallery : null,
        texts.childElementCount ? texts : null
      )
    );
  }

  async export(format) {
    if (format === 'zip' && !this.app.requirePro('bulkExport', 'Export ZIP')) return;
    try {
      const filename = await this.services.exporter.export(this.selectedId, format);
      this.toast('success', `Export ${format.toUpperCase()} disiapkan: ${filename}`);
    } catch (error) {
      this.toast('error', `Export gagal: ${error.message}`);
    }
  }

  async remove(dataset) {
    const ok = await this.confirm(`Hapus dataset "${dataset.title}" beserta blob?`, 'Hapus dataset');
    if (!ok) return;
    await this.services.library.deleteDataset(dataset.id);
    if (this.selectedId === dataset.id) this.selectedId = null;
    await this.refresh();
    this.toast('success', 'Dataset dihapus.');
  }

  async clearAll() {
    const ok = await this.confirm('Hapus SEMUA dataset dan blob di perpustakaan?', 'Bersihkan perpustakaan');
    if (!ok) return;
    await this.services.library.clearAll();
    this.selectedId = null;
    await this.refresh();
    this.toast('success', 'Perpustakaan dibersihkan.');
  }
}
