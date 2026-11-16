import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { PLATFORMS, DEAL_STATUS, dealMeta, platformLabel } from '../../config/creator.js';
import { fmtDate, fmtMoney } from '../../core/Format.js';
import { field, input, select, textarea, toolbar, itemRow, iconButton, badge, segmented, meter } from './PanelKit.js';
import { openRateCard, openInvoice } from './RateCard.js';

export class DealsPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Deal & Rate Card';
    this.subtitle = 'Pipeline kerja sama dan invoice';
    this.helpText = 'Catat prospek, negosiasi, dan deal. Nilai pipeline dihitung otomatis; invoice bisa dibuat dari deal.';
    this.filter = 'semua';
  }

  async build() {
    this.capacityNode = el('div');
    this.add(this.capacityNode);
    this.statsNode = el('div', { class: 'hx-stats' });
    this.add(this.statsNode);
    this.add(toolbar(
      el('button', { class: 'hx-btn is-small is-primary', type: 'button', text: '+ Deal', onclick: () => this.openEditor() }),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'AI rate card', onclick: () => openRateCard(this.app) })
    ));
    this.filterNode = el('div');
    this.add(this.filterNode);
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    this.track(this.services.license.onChange(() => this.refreshCapacity()));
    await this.refreshCapacity();
    await this.render();
  }

  async refreshCapacity() {
    const cap = await this.services.capacity('deals');
    this.capacityNode.replaceChildren(meter(cap.percent, Number.isFinite(cap.max)
      ? `${cap.used}/${cap.max} deal (${this.services.license.edition})`
      : `${cap.used} deal · ${this.services.license.edition}`));
  }

  renderFilter() {
    this.filterNode.replaceChildren(segmented(
      [['semua', 'Semua'], ...DEAL_STATUS.map((status) => [status.id, status.label])],
      this.filter,
      (key) => {
        this.filter = key;
        this.render();
      }
    ));
  }

  async render() {
    this.renderFilter();
    const all = await this.services.collections.deals.list();
    const currency = this.settings.get('general.currency', 'IDR');
    const active = all.filter((row) => !['batal'].includes(row.status || 'prospek'));
    const paid = all.filter((row) => row.status === 'terbayar');
    const pipeline = active.filter((row) => row.status !== 'terbayar').reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    const earned = paid.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    this.statsNode.replaceChildren(
      el('div', { class: 'hx-stat' }, el('div', { class: 'hx-stat-value', text: fmtMoney(pipeline, currency) }), el('div', { class: 'hx-stat-label', text: 'Pipeline' })),
      el('div', { class: 'hx-stat is-accent' }, el('div', { class: 'hx-stat-value', text: fmtMoney(earned, currency) }), el('div', { class: 'hx-stat-label', text: 'Terbayar' })),
      el('div', { class: 'hx-stat' }, el('div', { class: 'hx-stat-value', text: String(active.length) }), el('div', { class: 'hx-stat-label', text: 'Deal aktif' }))
    );
    const rows = all.filter((row) => this.filter === 'semua' || (row.status || 'prospek') === this.filter);
    this.listNode.replaceChildren();
    if (!rows.length) {
      this.listNode.append(this.empty('Belum ada deal', 'Catat prospek pertama, lalu ubah statusnya seiring proses.'));
      return;
    }
    rows.forEach((row) => {
      const meta = dealMeta(row.status || 'prospek');
      this.listNode.append(itemRow({
        title: row.brand || row.campaign || 'Deal tanpa nama',
        meta: fmtMoney(row.value || 0, currency),
        subtitle: `${row.campaign || '—'} · ${platformLabel(row.platform)}${row.due ? ` · tenggat ${fmtDate(row.due, 'short')}` : ''}`,
        actions: [
          badge(meta.label),
          iconButton('download', 'Buat invoice', () => this.invoice(row)),
          iconButton('edit', 'Edit deal', () => this.openEditor(row)),
          iconButton('trash', 'Hapus deal', () => this.remove(row))
        ]
      }));
    });
  }

  async invoice(row) {
    if (!this.app.requirePro('invoice', 'Invoice')) return;
    await openInvoice(this.app, row, { onSaved: async () => this.render() });
  }

  async remove(row) {
    const ok = await this.confirm(`Hapus deal "${row.brand}"?`, 'Hapus deal');
    if (!ok) return;
    await this.services.removeItem('deals', row.id);
    await this.refreshCapacity();
    await this.render();
  }

  openEditor(row = null) {
    const modal = new Modal(this.app, { title: row ? 'Edit deal' : 'Deal baru', wide: true });
    const form = el('div', {},
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Brand / klien', input({ 'data-field': 'brand', value: row?.brand || '' })),
        field('Kampanye', input({ 'data-field': 'campaign', value: row?.campaign || '' }))
      ),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Platform', select(PLATFORMS.map((p) => [p.id, p.label]), row?.platform || 'instagram', { 'data-field': 'platform' })),
        field('Status', select(DEAL_STATUS.map((s) => [s.id, s.label]), row?.status || 'prospek', { 'data-field': 'status' }))
      ),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Nilai (angka)', input({ type: 'number', min: 0, 'data-field': 'value', value: row?.value || 0 })),
        field('Tenggat', input({ type: 'date', 'data-field': 'due', value: row?.due || '' }))
      ),
      field('Deliverable', textarea({ 'data-field': 'deliverables', rows: 2, value: row?.deliverables || '', placeholder: '1 Reels + 3 Story, revisi 1x' })),
      field('Catatan', textarea({ 'data-field': 'notes', rows: 3, value: row?.notes || '' }))
    );
    modal.setBody(form);
    modal.action('Batal', () => modal.close(), 'is-ghost');
    modal.action('Simpan', () => this.guard(async () => {
      const values = {};
      form.querySelectorAll('[data-field]').forEach((node) => { values[node.dataset.field] = node.value; });
      if (!values.brand.trim()) throw new Error('Nama brand wajib diisi.');
      values.value = Number(values.value) || 0;
      await this.services.saveItem('deals', { ...(row || {}), ...values });
      modal.close();
      await this.refreshCapacity();
      await this.render();
    }, 'Deal disimpan.'), 'is-primary');
    modal.open();
  }
}
