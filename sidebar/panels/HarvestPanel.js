import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { badge, note } from './PanelKit.js';

export class HarvestPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Panen Aset';
    this.subtitle = 'Ambil gambar, teks, dan tabel dari tab aktif';
    this.helpText = 'Panen berjalan di halaman yang sedang dibuka, lalu hasilnya masuk ke Data & Export. Halaman chrome:// tidak bisa dipanen.';
    this.result = null;
  }

  async build() {
    this.infoNode = el('div', { class: 'hx-card' }, el('p', { class: 'hx-muted', text: 'Mendeteksi tab aktif…' }));
    this.add(this.infoNode);

    this.imgToggle = el('input', { type: 'checkbox', checked: true });
    this.textToggle = el('input', { type: 'checkbox', checked: true });
    this.dlToggle = el('input', { type: 'checkbox' });
    this.add(el('div', { class: 'hx-card is-flat' },
      el('label', { class: 'hx-field' }, el('span', { class: 'hx-label', text: 'Jenis data' }),
        el('div', { class: 'hx-row' },
          el('label', { class: 'hx-chip' }, this.imgToggle, el('span', { text: 'Gambar' })),
          el('label', { class: 'hx-chip' }, this.textToggle, el('span', { text: 'Teks & tabel' }))
        )
      ),
      el('label', { class: 'hx-chip' }, this.dlToggle, el('span', { text: 'Unduh gambar (maks 20)' })),
      el('div', { class: 'hx-row' },
        el('button', { class: 'hx-btn is-primary', type: 'button', text: 'Panen sekarang', onclick: () => this.harvest() }),
        el('button', { class: 'hx-btn', type: 'button', text: 'Simpan seleksi', onclick: () => this.saveSelection() }),
        el('button', { class: 'hx-btn is-small', type: 'button', text: 'Buka Data', onclick: () => this.app.go('data') })
      ),
      note('Patuhi hak cipta dan ketentuan situs. Panen untuk arsip riset pribadi, bukan repost massal.')
    ));

    this.resultNode = el('div');
    this.add(this.resultNode);
    this.logNode = el('div', { class: 'hx-list' });
    this.add(this.logNode);
    await this.loadInfo();
  }

  log(text) {
    const line = el('div', { class: 'hx-item' }, el('div', { class: 'hx-item-sub', text: `${new Date().toLocaleTimeString()} · ${text}` }));
    this.logNode.prepend(line);
  }

  async loadInfo() {
    try {
      const tab = await this.services.activeTab();
      if (!tab) {
        this.infoNode.replaceChildren(el('p', { class: 'hx-muted', text: 'Tidak ada tab aktif.' }));
        return;
      }
      const title = tab.title || 'Tanpa judul';
      const url = tab.url || '';
      const restricted = /^(chrome|edge|about|chrome-extension|devtools):/i.test(url);
      this.infoNode.replaceChildren(...[
        el('div', { class: 'hx-item-top' },
          el('div', { class: 'hx-item-title', text: title }),
          badge(restricted ? 'Tidak bisa' : 'Siap panen', restricted ? 'is-danger' : 'is-ok')
        ),
        el('div', { class: 'hx-item-sub', text: url || '—' }),
        restricted ? el('p', { class: 'hx-muted hx-small', text: 'Buka halaman http/https biasa untuk memanen.' }) : null
      ].filter(Boolean));
    } catch (error) {
      this.infoNode.replaceChildren(el('p', { class: 'hx-danger', text: error.message }));
    }
  }

  async harvest() {
    if (!this.imgToggle.checked && !this.textToggle.checked) {
      this.toast('warn', 'Pilih minimal satu jenis data.');
      return;
    }
    this.log('Mulai panen…');
    this.resultNode.replaceChildren();
    try {
      const result = await this.services.harvest(null, {
        images: this.imgToggle.checked,
        text: this.textToggle.checked
      });
      const images = result?.images?.items?.length || 0;
      const tables = result?.text?.tables?.length || 0;
      const chars = result?.text?.text?.length || 0;
      this.log(`Halaman terbaca: ${images} gambar, ${tables} tabel, ${chars} karakter teks.`);
      this.result = result;
      this.resultNode.replaceChildren(el('div', { class: 'hx-card' },
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Gambar ditemukan' }), el('span', { text: String(images) })),
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Tabel' }), el('span', { text: String(tables) })),
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Teks' }), el('span', { text: `${chars} karakter` })),
        el('div', { class: 'hx-row' },
          el('button', {
            class: 'hx-btn is-primary', type: 'button', text: 'Simpan ke perpustakaan',
            onclick: () => this.ingest()
          })
        )
      ));
    } catch (error) {
      this.log(`Gagal: ${error.message}`);
      this.toast('error', error.message);
    }
  }

  async ingest() {
    if (!this.result) return;
    try {
      const created = await this.services.ingestHarvest(this.result, { downloadImages: this.dlToggle.checked });
      this.log(`${created.length} dataset dibuat.`);
      this.toast('success', 'Hasil panen tersimpan di Data.');
      this.app.go('data');
    } catch (error) {
      this.log(`Gagal menyimpan: ${error.message}`);
      this.toast('error', error.message);
    }
  }

  async saveSelection() {
    try {
      const text = await this.services.selection();
      if (!text || !String(text).trim()) {
        this.toast('warn', 'Tidak ada teks yang diseleksi di halaman.');
        return;
      }
      const tab = await this.services.activeTab();
      await this.services.saveItem('research', {
        title: `Kutipan — ${tab?.title || 'halaman'}`,
        topic: tab?.title || '',
        platform: 'web',
        url: tab?.url || '',
        notes: text,
        kind: 'quote'
      });
      this.log(`Seleksi ${String(text).length} karakter disimpan ke Riset.`);
      this.toast('success', 'Seleksi disimpan ke Riset.');
    } catch (error) {
      this.toast('error', error.message);
    }
  }
}
