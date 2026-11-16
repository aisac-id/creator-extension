import { BasePanel } from '../../ui/BasePanel.js';
import { el, downloadText, readFile, chooseFile } from '../../ui/Dom.js';
import { SECTIONS } from '../../core/SettingsSchema.js';
import { BRANDING } from '../../config/branding.js';
import { searchBox, note } from './PanelKit.js';
import { SettingsFields } from './SettingsFields.js';

export class SettingsPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Setelan';
    this.subtitle = 'Semua perilaku bisa diatur';
    this.helpText = 'Setelan terskema: perubahan langsung berlaku tanpa reload. Export/import JSON untuk pindah perangkat.';
    this.sectionId = 'umum';
    this.query = '';
    this.fields = new SettingsFields(this);
  }

  async build() {
    this.add(searchBox('Cari setelan…', (value) => {
      this.query = value;
      this.refresh();
    }));
    this.tabsNode = el('div', { class: 'hx-seg' });
    this.add(this.tabsNode);
    this.fieldsNode = el('div');
    this.add(this.fieldsNode);
    this.add(el('div', { class: 'hx-row' },
      el('button', { class: 'hx-btn is-small is-danger', type: 'button', text: 'Reset bagian', onclick: () => this.resetSection() }),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Export setelan', onclick: () => this.exportSettings() }),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Import setelan', onclick: () => this.importSettings() })
    ));
    this.add(el('div', { class: 'hx-section' },
      el('div', { class: 'hx-section-head' }, el('h3', { class: 'hx-section-title', text: 'Backup' })),
      note('Backup berisi ide, naskah, kalender, deal, metrik, riset, dan setelan. Kunci rahasia & lisensi tidak ikut.'),
      el('div', { class: 'hx-row' },
        el('button', { class: 'hx-btn is-small', type: 'button', text: 'Unduh backup', onclick: () => this.exportBackup() }),
        el('button', { class: 'hx-btn is-small', type: 'button', text: 'Pulihkan backup', onclick: () => this.importBackup() })
      )
    ));
    this.add(el('div', { class: 'hx-section' },
      el('div', { class: 'hx-section-head' }, el('h3', { class: 'hx-section-title', text: 'Tentang' })),
      el('div', { class: 'hx-card is-flat' },
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Produk' }), el('span', { text: BRANDING.product })),
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Versi' }), el('span', { text: BRANDING.version })),
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Standar' }), el('span', { text: BRANDING.standard })),
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Edition' }), el('span', { text: this.services.license.edition })),
        el('div', { class: 'hx-row' },
          el('button', { class: 'hx-btn is-small', type: 'button', text: 'Ulangi tur', onclick: () => this.app.startOnboarding(true) }),
          el('button', { class: 'hx-btn is-small', type: 'button', text: 'Lisensi', onclick: () => this.app.openLicense() }),
          el('button', { class: 'hx-btn is-small', type: 'button', text: 'Dokumentasi', onclick: () => this.app.openTab(BRANDING.docsUrl) })
        )
      )
    ));
    this.refresh();
  }

  renderTabs() {
    this.tabsNode.replaceChildren(...SECTIONS.map((section) => el('button', {
      class: `hx-seg-btn${this.sectionId === section.id && !this.query ? ' is-on' : ''}`,
      type: 'button', text: section.label,
      onclick: () => {
        this.sectionId = section.id;
        this.query = '';
        this.refresh();
      }
    })));
  }

  refresh() {
    this.renderTabs();
    this.fields.render(this.fieldsNode, this.sectionId, this.query.trim());
  }

  async resetSection() {
    const label = SECTIONS.find((section) => section.id === this.sectionId)?.label || this.sectionId;
    const ok = await this.confirm(`Kembalikan setelan bagian ${label} ke default?`, 'Reset setelan');
    if (!ok) return;
    try {
      await this.services.settings.reset(this.sectionId);
      this.app.applyAppearance();
      this.refresh();
      this.toast('success', `Setelan ${label} direset.`);
    } catch (error) {
      this.toast('error', error.message);
    }
  }

  exportSettings() {
    downloadText(this.services.settings.exportJson(), 'creator-settings.json', 'application/json');
    this.toast('success', 'Setelan diexport.');
  }

  async importSettings() {
    const file = await chooseFile('.json,application/json');
    if (!file) return;
    try {
      await this.services.settings.importJson(await readFile(file));
      this.app.applyAppearance();
      this.refresh();
      this.toast('success', 'Setelan diimpor.');
    } catch (error) {
      this.toast('error', error.message);
    }
  }

  async exportBackup() {
    try {
      const text = await this.services.exportBackup();
      downloadText(text, `creator-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
      this.toast('success', 'Backup diunduh.');
    } catch (error) {
      this.toast('error', error.message);
    }
  }

  async importBackup() {
    const file = await chooseFile('.json,application/json');
    if (!file) return;
    const ok = await this.confirm('Pulihkan backup? Data dengan kunci yang sama akan ditimpa.', 'Pulihkan backup');
    if (!ok) return;
    try {
      const count = await this.services.importBackup(await readFile(file));
      this.app.applyAppearance();
      this.refresh();
      this.toast('success', `${count} kelompok data dipulihkan.`);
    } catch (error) {
      this.toast('error', error.message);
    }
  }
}
