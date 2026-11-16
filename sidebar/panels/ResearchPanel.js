import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { PLATFORMS, platformLabel } from '../../config/creator.js';
import { fmtDate } from '../../core/Format.js';
import { field, input, select, textarea, toolbar, itemRow, iconButton, badge } from './PanelKit.js';

export class ResearchPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Riset';
    this.subtitle = 'Sudut, celah, dan hook dari AI atau kutipan';
    this.helpText = 'Riset mengumpulkan sudut konten yang belum ramai. Kutipan seleksi halaman juga masuk ke sini dari Panen Aset.';
  }

  async build() {
    const ai = this.card(
      el('div', { class: 'hx-section-head' },
        el('h3', { class: 'hx-section-title', text: 'Riset cepat' }),
        badge('Pro / Trial', 'is-pro')
      ),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Topik', input({ 'data-r': 'topic', placeholder: 'mis. budgeting untuk freelancer' })),
        field('Platform', select(PLATFORMS.map((p) => [p.id, p.label]), 'tiktok', { 'data-r': 'platform' }))
      ),
      toolbar(
        el('button', { class: 'hx-btn is-primary is-small', type: 'button', text: 'Riset dengan AI', onclick: () => this.run() }),
        el('button', { class: 'hx-btn is-small', type: 'button', text: '+ Catatan', onclick: () => this.openEditor() })
      )
    );
    this.aiCard = ai;
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    await this.render();
  }

  async render() {
    const rows = await this.services.collections.research.list();
    this.listNode.replaceChildren();
    if (!rows.length) {
      this.listNode.append(this.empty('Belum ada riset', 'Mulai dengan riset AI atau simpan kutipan dari halaman.'));
      return;
    }
    rows.forEach((row) => this.listNode.append(itemRow({
      title: row.title || row.topic || 'Riset',
      meta: `${platformLabel(row.platform)} · ${fmtDate(row.createdAt, 'short')}`,
      subtitle: (row.notes || '').slice(0, 140) || 'Tanpa catatan',
      actions: [
        badge(row.kind === 'quote' ? 'Kutipan' : 'AI', row.kind === 'quote' ? '' : 'is-pro'),
        iconButton('eye', 'Buka detail', () => this.detail(row)),
        iconButton('trash', 'Hapus', () => this.remove(row))
      ]
    })));
  }

  values() {
    const out = {};
    this.aiCard.querySelectorAll('[data-r]').forEach((node) => { out[node.dataset.r] = node.value; });
    return out;
  }

  async run() {
    const { topic, platform } = this.values();
    if (!topic.trim()) {
      this.toast('warn', 'Isi topik riset terlebih dahulu.');
      return;
    }
    this.toast('info', 'AI sedang meriset…');
    try {
      const result = await this.services.askJson('research', { topic, platform });
      const data = result.data || {};
      const summary = [
        ...(data.angles || []).map((item) => `Angle: ${item}`),
        ...(data.gaps || []).map((item) => `Celah: ${item}`)
      ].join('\n');
      await this.services.saveItem('research', {
        title: `Riset — ${topic}`,
        topic,
        platform,
        kind: 'ai',
        data: {
          angles: data.angles || [],
          gaps: data.gaps || [],
          hooks: data.hooks || []
        },
        notes: summary || result.text,
        source: `ai:${result.provider}`
      });
      await this.render();
      this.toast('success', 'Riset tersimpan.');
    } catch (error) {
      this.toast('error', error.message);
    }
  }

  detail(row) {
    const modal = new Modal(this.app, { title: row.title || 'Riset', subtitle: platformLabel(row.platform), wide: true });
    const section = (label, values, type = 'idea') => {
      if (!values?.length) return null;
      return el('div', { class: 'hx-section' },
        el('div', { class: 'hx-section-head' }, el('h3', { class: 'hx-section-title', text: label })),
        el('div', { class: 'hx-list' }, values.map((value) => itemRow({
          title: String(value),
          actions: [iconButton('plus', 'Jadikan ide', () => this.toIdea(row, value, type))]
        })))
      );
    };
    modal.setBody(
      row.data?.angles?.length ? section('Sudut', row.data.angles) : null,
      row.data?.gaps?.length ? section('Celah', row.data.gaps) : null,
      row.data?.hooks?.length ? section('Hook', row.data.hooks) : null,
      row.notes ? el('div', { class: 'hx-card is-flat' },
        el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Catatan' }), el('span', { text: '' })),
        el('p', { class: 'hx-muted hx-small', text: row.notes })
      ) : null,
      row.url ? el('p', { class: 'hx-small' }, el('a', { href: row.url, target: '_blank', rel: 'noreferrer', text: row.url })) : null
    );
    modal.action('Tutup', () => modal.close(), 'is-ghost');
    modal.open();
  }

  async toIdea(row, value, type) {
    await this.services.saveItem('ideas', {
      title: String(value).slice(0, 140),
      notes: `Dari riset: ${row.title} (${type})`,
      platform: row.platform === 'web' ? 'instagram' : row.platform,
      url: row.url || '',
      status: 'ide'
    });
    this.toast('success', 'Ditambahkan ke Bank Ide.');
  }

  openEditor() {
    const modal = new Modal(this.app, { title: 'Catatan riset' });
    const form = el('div', {},
      field('Judul', input({ 'data-field': 'title' })),
      field('Topik', input({ 'data-field': 'topic' })),
      field('Platform', select([['web', 'Web'], ...PLATFORMS.map((p) => [p.id, p.label])], 'web', { 'data-field': 'platform' })),
      field('URL sumber', input({ 'data-field': 'url' })),
      field('Catatan', textarea({ 'data-field': 'notes', rows: 6 }))
    );
    modal.setBody(form);
    modal.action('Batal', () => modal.close(), 'is-ghost');
    modal.action('Simpan', () => this.guard(async () => {
      const values = {};
      form.querySelectorAll('[data-field]').forEach((node) => { values[node.dataset.field] = node.value; });
      if (!values.title.trim()) throw new Error('Judul wajib diisi.');
      await this.services.saveItem('research', { ...values, kind: 'manual' });
      modal.close();
      await this.render();
    }, 'Catatan riset disimpan.'), 'is-primary');
    modal.open();
  }

  async remove(row) {
    const ok = await this.confirm('Hapus riset ini?', 'Hapus riset');
    if (!ok) return;
    await this.services.removeItem('research', row.id);
    await this.render();
  }
}
