import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { PLATFORMS, platformLabel } from '../../config/creator.js';
import { fmtCompact, fmtMoney, fmtNumber, todayKey, addDays } from '../../core/Format.js';
import { barChart } from '../../ui/Chart.js';
import { field, input, select, meter, badge, iconButton, itemRow, note } from './PanelKit.js';

const NUMBER_FIELDS = [
  ['followers', 'Followers'],
  ['views', 'Views / tayangan'],
  ['likes', 'Likes'],
  ['comments', 'Komentar'],
  ['shares', 'Share / simpan'],
  ['revenue', 'Pendapatan']
];

export class AnalyticsPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Analitik';
    this.subtitle = 'Ukur pertumbuhan & pendapatan';
    this.helpText = 'Catat metrik harian per platform. Grafik dan rasio engagement dihitung lokal, tidak dikirim ke mana pun.';
  }

  async build() {
    this.capacityNode = el('div');
    this.add(this.capacityNode);
    this.statsNode = el('div', { class: 'hx-stats' });
    this.add(this.statsNode);
    this.chartNode = el('div');
    this.add(this.chartNode);
    this.form = el('div', { class: 'hx-card is-flat' });
    this.buildForm();
    this.add(this.form);
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    this.track(this.services.license.onChange(() => this.refreshCapacity()));
    await this.refreshCapacity();
    await this.render();
  }

  buildForm() {
    this.dateInput = input({ type: 'date', value: todayKey() });
    this.platformInput = select([['all', 'Semua platform'], ...PLATFORMS.map((p) => [p.id, p.label])], 'all');
    this.numberInputs = {};
    const grid = el('div', { class: 'hx-grid hx-grid-2' },
      field('Tanggal', this.dateInput),
      field('Platform', this.platformInput)
    );
    NUMBER_FIELDS.forEach(([key, label]) => {
      this.numberInputs[key] = input({ type: 'number', min: 0, step: key === 'revenue' ? 1000 : 1 });
      grid.append(field(label, this.numberInputs[key]));
    });
    this.form.append(grid,
      el('div', { class: 'hx-row' },
        el('button', { class: 'hx-btn is-primary is-small', type: 'button', text: 'Simpan metrik', onclick: () => this.save() }),
        el('button', { class: 'hx-btn is-small', type: 'button', text: 'Muat data tanggal ini', onclick: () => this.loadExisting() })
      ),
      note('Isi angka apa adanya. Kosong dianggap nol saat disimpan.')
    );
    this.dateInput.addEventListener('change', () => this.loadExisting());
    this.platformInput.addEventListener('change', () => this.loadExisting());
  }

  async refreshCapacity() {
    const cap = await this.services.capacity('metrics');
    this.capacityNode.replaceChildren(meter(cap.percent, Number.isFinite(cap.max)
      ? `${cap.used}/${cap.max} catatan metrik (${this.services.license.edition})`
      : `${cap.used} catatan · ${this.services.license.edition}`));
  }

  async loadExisting() {
    const rows = await this.services.collections.metrics.list();
    const row = rows.find((item) => item.date === this.dateInput.value
      && (item.platform || 'all') === this.platformInput.value);
    NUMBER_FIELDS.forEach(([key]) => { this.numberInputs[key].value = row?.[key] ?? ''; });
  }

  async save() {
    const patch = { date: this.dateInput.value || todayKey(), platform: this.platformInput.value };
    NUMBER_FIELDS.forEach(([key]) => { patch[key] = Number(this.numberInputs[key].value) || 0; });
    try {
      await this.services.saveMetric(patch);
      await this.refreshCapacity();
      await this.render();
      this.toast('success', 'Metrik disimpan.');
    } catch (error) {
      this.toast('error', error.message);
    }
  }

  async render() {
    const currency = this.settings.get('general.currency', 'IDR');
    const rows = (await this.services.collections.metrics.list())
      .slice()
      .sort((a, b) => `${b.date}${b.platform}`.localeCompare(`${a.date}${a.platform}`));
    if (!rows.length) {
      this.statsNode.replaceChildren();
      this.chartNode.replaceChildren(this.empty('Belum ada metrik', 'Isi angka hari ini untuk melihat tren.'));
      this.listNode.replaceChildren();
      return;
    }
    const latestByPlatform = new Map();
    rows.forEach((row) => {
      const key = row.platform || 'all';
      if (!latestByPlatform.has(key) || row.date > latestByPlatform.get(key).date) latestByPlatform.set(key, row);
    });
    const totalFollowers = [...latestByPlatform.values()].reduce((sum, row) => sum + (Number(row.followers) || 0), 0);
    const weekStart = addDays(todayKey(), -6);
    const week = rows.filter((row) => row.date >= weekStart);
    const views = week.reduce((sum, row) => sum + (Number(row.views) || 0), 0);
    const interactions = week.reduce((sum, row) => sum + (Number(row.likes) || 0) + (Number(row.comments) || 0) + (Number(row.shares) || 0), 0);
    const engagement = views ? ((interactions / views) * 100).toFixed(2) : '0.00';
    const revenue = rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    this.statsNode.replaceChildren(
      el('div', { class: 'hx-stat' }, el('div', { class: 'hx-stat-value', text: fmtCompact(totalFollowers) }), el('div', { class: 'hx-stat-label', text: 'Followers' })),
      el('div', { class: 'hx-stat is-accent' }, el('div', { class: 'hx-stat-value', text: fmtCompact(views) }), el('div', { class: 'hx-stat-label', text: 'Views 7 hari' })),
      el('div', { class: 'hx-stat' }, el('div', { class: 'hx-stat-value', text: `${engagement}%` }), el('div', { class: 'hx-stat-label', text: 'Engagement' })),
      el('div', { class: 'hx-stat' }, el('div', { class: 'hx-stat-value', text: fmtMoney(revenue, currency) }), el('div', { class: 'hx-stat-label', text: 'Total pendapatan' }))
    );

    const byDate = {};
    rows.filter((row) => row.date >= addDays(todayKey(), -13)).forEach((row) => {
      byDate[row.date] = (byDate[row.date] || 0) + (Number(row.views) || 0);
    });
    const items = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ label: date.slice(5), value }));
    this.chartNode.replaceChildren(el('div', { class: 'hx-card' },
      el('div', { class: 'hx-section-head' }, el('h3', { class: 'hx-section-title', text: 'Views 14 hari' })),
      barChart(items, { height: 110, format: fmtCompact })
    ));

    this.listNode.replaceChildren(...rows.slice(0, 12).map((row) => {
      const eng = row.views
        ? (((Number(row.likes) || 0) + (Number(row.comments) || 0) + (Number(row.shares) || 0)) / row.views * 100).toFixed(2)
        : '0.00';
      return itemRow({
        title: `${row.date} · ${platformLabel(row.platform === 'all' ? '' : row.platform)}`,
        meta: `${fmtNumber(row.views || 0)} views`,
        subtitle: `${fmtCompact(row.followers || 0)} followers · ${eng}% engagement · ${fmtMoney(row.revenue || 0, currency)}`,
        actions: [badge(row.platform === 'all' ? 'Total' : platformLabel(row.platform)), iconButton('trash', 'Hapus', () => this.remove(row))]
      });
    }));
  }

  async remove(row) {
    const ok = await this.confirm(`Hapus metrik ${row.date} (${row.platform || 'all'})?`, 'Hapus metrik');
    if (!ok) return;
    await this.services.removeItem('metrics', row.id);
    await this.refreshCapacity();
    await this.render();
  }
}
