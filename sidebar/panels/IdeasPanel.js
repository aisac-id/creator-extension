import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { PLATFORMS, FORMATS, CONTENT_STATUS, platformLabel, statusMeta } from '../../config/creator.js';
import { fmtDate } from '../../core/Format.js';
import { badge, field, input, select, segmented, textarea, toolbar, searchBox, meter, itemRow, iconButton } from './PanelKit.js';

export class IdeasPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Bank Ide';
    this.subtitle = 'Simpan, saring, dan kembangkan ide';
    this.helpText = 'Ide bisa datang dari AI, halaman web, atau catatanmu. Ide yang matang bisa langsung dijadikan naskah.';
    this.query = '';
    this.filter = 'semua';
  }

  async build() {
    this.capacityNode = el('div');
    this.add(this.capacityNode);

    const aiCard = this.card(
      el('div', { class: 'hx-section-head' },
        el('h3', { class: 'hx-section-title', text: 'Cari ide dengan AI' }),
        badge('Pro / Trial', 'is-pro')
      ),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Topik / niche', input({ 'data-ai': 'topic', placeholder: 'mis. kopi rumahan untuk pemula' })),
        field('Platform', select(PLATFORMS.map((p) => [p.id, p.label]), 'instagram', { 'data-ai': 'platform' }))
      ),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Format', select(FORMATS.map((f) => [f, f]), 'Reels / Shorts', { 'data-ai': 'format' })),
        field('Jumlah', input({ type: 'number', min: 3, max: 12, value: 6, 'data-ai': 'count' }))
      ),
      toolbar(el('button', {
        class: 'hx-btn is-primary', type: 'button', text: 'Buat & simpan ide',
        onclick: () => this.generate()
      }))
    );
    this.aiCard = aiCard;

    const tools = toolbar(
      searchBox('Cari ide…', (value) => {
        this.query = value;
        this.refresh();
      }),
      el('button', { class: 'hx-btn is-small is-primary', type: 'button', text: '+ Ide', onclick: () => this.openEditor() })
    );
    this.add(tools);

    this.filterNode = el('div');
    this.add(this.filterNode);
    this.renderFilter();

    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);

    this.track(this.services.license.onChange(() => this.refreshCapacity()));
    await this.refreshCapacity();
    await this.refresh();
  }

  renderFilter() {
    this.filterNode.replaceChildren(segmented(
      [['semua', 'Semua'], ...CONTENT_STATUS.map((status) => [status.id, status.label])],
      this.filter,
      (key) => {
        this.filter = key;
        this.renderFilter();
        this.refresh();
      }
    ));
  }

  async refreshCapacity() {
    const cap = await this.services.capacity('ideas');
    this.capacityNode.replaceChildren(
      meter(cap.percent, Number.isFinite(cap.max)
        ? `${cap.used}/${cap.max} ide (${this.services.license.edition})`
        : `${cap.used} ide · ${this.services.license.edition}`)
    );
  }

  async refresh() {
    const all = await this.services.collections.ideas.list();
    const needle = this.query.trim().toLowerCase();
    const rows = all
      .filter((row) => this.filter === 'semua' || (row.status || 'ide') === this.filter)
      .filter((row) => !needle || `${row.title} ${row.notes} ${row.hook}`.toLowerCase().includes(needle));
    this.listNode.replaceChildren();
    if (!rows.length) {
      this.listNode.append(this.empty('Tidak ada ide cocok', 'Ubah filter atau buat ide baru.'));
      return;
    }
    rows.forEach((row) => {
      const meta = statusMeta(row.status || 'ide');
      this.listNode.append(itemRow({
        title: row.title || 'Tanpa judul',
        meta: `${platformLabel(row.platform)} · ${row.format || '—'}`,
        subtitle: row.hook || row.notes || `Dibuat ${fmtDate(row.createdAt, 'short')}`,
        actions: [
          badge(meta.label, ''),
          iconButton('script', 'Jadikan naskah', () => this.toScript(row)),
          iconButton('edit', 'Edit ide', () => this.openEditor(row)),
          iconButton('trash', 'Hapus ide', () => this.remove(row))
        ]
      }));
    });
  }

  collectAi() {
    const values = {};
    this.aiCard.querySelectorAll('[data-ai]').forEach((node) => { values[node.dataset.ai] = node.value; });
    return values;
  }

  async generate() {
    const values = this.collectAi();
    const ai = el('p', { class: 'hx-muted hx-small', text: 'AI sedang menyusun ide…' });
    this.aiCard.append(ai);
    try {
      const result = await this.services.askJson('ideas', {
        topic: values.topic,
        platform: values.platform,
        format: values.format,
        count: Number(values.count) || 6
      });
      const raw = Array.isArray(result.data) ? result.data : result.data?.items || result.data?.ideas || [];
      const items = raw.filter((item) => item && (item.judul || item.title)).slice(0, 12);
      if (!items.length) throw new Error('AI tidak mengembalikan daftar ide. Coba lagi.');
      for (const item of items) {
        await this.services.saveItem('ideas', {
          title: item.judul || item.title,
          hook: item.hook || '',
          angle: item.angle || '',
          cta: item.cta || '',
          format: item.format || values.format,
          platform: values.platform,
          status: 'ide',
          source: `ai:${result.provider}`
        });
      }
      await this.refreshCapacity();
      await this.refresh();
      ai.remove();
      this.toast('success', `${items.length} ide tersimpan.`);
    } catch (error) {
      ai.textContent = error.message;
      ai.className = 'hx-danger';
    }
  }

  async toScript(row) {
    await this.services.storage.set('hx.intent.script', {
      title: row.title,
      idea: [row.hook, row.angle, row.notes].filter(Boolean).join('\n'),
      platform: row.platform,
      format: row.format
    });
    this.app.go('script');
  }

  async remove(row) {
    const ok = await this.confirm(`Hapus ide "${row.title}"?`, 'Hapus ide');
    if (!ok) return;
    await this.services.removeItem('ideas', row.id);
    await this.refreshCapacity();
    await this.refresh();
    this.toast('success', 'Ide dihapus.');
  }

  openEditor(row = null) {
    const modal = new Modal(this.app, { title: row ? 'Edit ide' : 'Ide baru' });
    const form = el('div', {},
      field('Judul', input({ 'data-field': 'title', value: row?.title || '' })),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Platform', select(PLATFORMS.map((p) => [p.id, p.label]), row?.platform || 'instagram', { 'data-field': 'platform' })),
        field('Format', select(FORMATS.map((f) => [f, f]), row?.format || 'Reels / Shorts', { 'data-field': 'format' }))
      ),
      field('Status', select(CONTENT_STATUS.map((s) => [s.id, s.label]), row?.status || 'ide', { 'data-field': 'status' })),
      field('Hook', input({ 'data-field': 'hook', value: row?.hook || '', placeholder: 'Kalimat pembuka yang bikin berhenti scroll' })),
      field('Angle / sudut', textarea({ 'data-field': 'angle', rows: 2, value: row?.angle || '' })),
      field('Catatan', textarea({ 'data-field': 'notes', rows: 3, value: row?.notes || '' }))
    );
    modal.setBody(form);
    modal.action('Batal', () => modal.close(), 'is-ghost');
    modal.action('Simpan', () => this.guard(async () => {
      const values = {};
      form.querySelectorAll('[data-field]').forEach((node) => { values[node.dataset.field] = node.value; });
      if (!values.title.trim()) throw new Error('Judul wajib diisi.');
      await this.services.saveItem('ideas', { ...(row || {}), ...values });
      modal.close();
      await this.refreshCapacity();
      await this.refresh();
    }, 'Ide disimpan.'), 'is-primary');
    modal.open();
  }
}
