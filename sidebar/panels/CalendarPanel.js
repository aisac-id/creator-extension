import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { PLATFORMS, FORMATS, CONTENT_STATUS, CONTENT_PILLARS, platformLabel, statusMeta } from '../../config/creator.js';
import { addDays, fmtDate, todayKey } from '../../core/Format.js';
import { field, input, select, textarea, toolbar, itemRow, iconButton, badge, segmented, meter } from './PanelKit.js';

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export class CalendarPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Kalender Konten';
    this.subtitle = 'Rencanakan, jadwalkan, terbitkan';
    this.helpText = 'Kalender menjaga ritme posting. Slot bisa dibuat manual atau lewat rencana 7 hari dari AI.';
    this.range = 'mendatang';
    this.dayFilter = null;
  }

  async build() {
    this.capacityNode = el('div');
    this.add(this.capacityNode);
    this.add(toolbar(
      el('button', { class: 'hx-btn is-small is-primary', type: 'button', text: '+ Slot', onclick: () => this.openEditor() }),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'AI rencana 7 hari', onclick: () => this.plan() })
    ));
    this.weekNode = el('div', { class: 'hx-cal' });
    this.add(this.weekNode);
    this.filterNode = el('div');
    this.add(this.filterNode);
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    this.track(this.services.license.onChange(() => this.refreshCapacity()));
    await this.refreshCapacity();
    await this.render();
  }

  async refreshCapacity() {
    const cap = await this.services.capacity('calendar');
    this.capacityNode.replaceChildren(meter(cap.percent, Number.isFinite(cap.max)
      ? `${cap.used}/${cap.max} slot (${this.services.license.edition})`
      : `${cap.used} slot · ${this.services.license.edition}`));
  }

  async rows() {
    const today = todayKey();
    const all = await this.services.collections.calendar.list();
    return all
      .filter((row) => (this.range === 'semua' ? true : (row.date || '') >= today))
      .filter((row) => !this.dayFilter || row.date === this.dayFilter)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  renderWeek(rows) {
    const start = new Date(`${todayKey()}T00:00:00`);
    const counts = {};
    rows.forEach((row) => { counts[row.date] = (counts[row.date] || 0) + 1; });
    this.weekNode.replaceChildren(el('div', { class: 'hx-daygrid' }, Array.from({ length: 7 }, (_, index) => {
      const date = addDays(todayKey(), index);
      const dayNum = new Date(`${date}T00:00:00`).getDate();
      const weekday = WEEKDAYS[(start.getDay() + index) % 7];
      const active = this.dayFilter === date;
      return el('button', {
        class: `hx-day${active ? ' is-on' : ''}`,
        type: 'button',
        title: fmtDate(date, 'long'),
        onclick: () => {
          this.dayFilter = active ? null : date;
          this.render();
        }
      },
        el('span', { text: weekday }),
        el('strong', { text: String(dayNum) }),
        el('span', { class: 'hx-muted', text: counts[date] ? `${counts[date]}` : '·' })
      );
    })));
  }

  renderFilter() {
    this.filterNode.replaceChildren(segmented(
      [['mendatang', 'Mendatang'], ['semua', 'Semua']],
      this.range,
      (key) => {
        this.range = key;
        this.dayFilter = null;
        this.render();
      }
    ));
  }

  async render() {
    this.renderFilter();
    const rows = await this.rows();
    this.renderWeek(await this.services.collections.calendar.list());
    this.listNode.replaceChildren();
    if (!rows.length) {
      this.listNode.append(this.empty(this.dayFilter ? 'Kosong di tanggal ini' : 'Belum ada jadwal', 'Tambahkan slot atau susun rencana 7 hari dengan AI.'));
      return;
    }
    let lastDate = '';
    rows.forEach((row) => {
      if (row.date !== lastDate) {
        lastDate = row.date;
        this.listNode.append(el('div', { class: 'hx-cal-date' },
          el('strong', { text: fmtDate(row.date, 'long') }),
          el('span', { class: 'hx-muted hx-small', text: row.date === todayKey() ? 'Hari ini' : '' })
        ));
      }
      const meta = statusMeta(row.status || 'ide');
      this.listNode.append(itemRow({
        title: row.title || 'Tanpa judul',
        meta: `${platformLabel(row.platform)} · ${row.format || '—'}`,
        subtitle: [row.pillar, row.notes].filter(Boolean).join(' · ') || 'Belum ada catatan',
        actions: [
          badge(meta.label),
          iconButton('script', 'Buat naskah', () => this.toScript(row)),
          iconButton('check', 'Tandai terbit', () => this.publish(row)),
          iconButton('edit', 'Edit slot', () => this.openEditor(row)),
          iconButton('trash', 'Hapus slot', () => this.remove(row))
        ]
      }));
    });
  }

  async toScript(row) {
    await this.services.storage.set('hx.intent.script', {
      title: row.title,
      platform: row.platform,
      format: row.format,
      idea: row.notes || ''
    });
    this.app.go('script');
  }

  async publish(row) {
    await this.services.saveItem('calendar', { ...row, status: 'terbit' });
    await this.render();
    this.toast('success', 'Ditandai terbit.');
  }

  async remove(row) {
    const ok = await this.confirm(`Hapus slot "${row.title}"?`, 'Hapus jadwal');
    if (!ok) return;
    await this.services.removeItem('calendar', row.id);
    await this.refreshCapacity();
    await this.render();
  }

  async plan() {
    const modal = new Modal(this.app, { title: 'Rencana konten 7 hari', subtitle: 'AI menyusun slot sesuai profil brand' });
    const platform = select(PLATFORMS.map((p) => [p.id, p.label]), 'instagram');
    const niche = input({ placeholder: 'Niche/topik (opsional)', value: this.services.brand.get().niche || '' });
    const status = el('p', { class: 'hx-muted hx-small', text: '' });
    modal.setBody(field('Platform', platform), field('Niche', niche), status);
    modal.action('Batal', () => modal.close(), 'is-ghost');
    modal.action('Susun rencana', async () => {
      status.textContent = 'AI menyusun rencana…';
      try {
        const result = await this.services.askJson('calendar', {
          niche: niche.value,
          platform: platform.value,
          days: 7,
          start: todayKey()
        });
        const slots = result.data?.slots || result.data?.items || [];
        if (!slots.length) throw new Error('AI tidak mengembalikan slot.');
        for (const slot of slots.slice(0, 14)) {
          const offset = Math.max(0, (Number(slot.hari) || 1) - 1);
          await this.services.saveItem('calendar', {
            date: addDays(todayKey(), offset),
            title: slot.judul || slot.title,
            format: slot.format || 'Reels / Shorts',
            platform: platform.value,
            pillar: slot.pilar || '',
            status: slot.status || 'ide',
            source: `ai:${result.provider}`
          });
        }
        await this.refreshCapacity();
        await this.render();
        modal.close();
        this.toast('success', 'Rencana 7 hari tersimpan.');
      } catch (error) {
        status.textContent = error.message;
        status.className = 'hx-danger';
      }
    }, 'is-primary');
    modal.open();
  }

  openEditor(row = null) {
    const modal = new Modal(this.app, { title: row ? 'Edit slot' : 'Slot baru' });
    const form = el('div', {},
      field('Tanggal', input({ type: 'date', 'data-field': 'date', value: row?.date || todayKey() })),
      field('Judul', input({ 'data-field': 'title', value: row?.title || '' })),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Platform', select(PLATFORMS.map((p) => [p.id, p.label]), row?.platform || 'instagram', { 'data-field': 'platform' })),
        field('Format', select(FORMATS.map((f) => [f, f]), row?.format || 'Reels / Shorts', { 'data-field': 'format' }))
      ),
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Pilar', select([['', '—'], ...CONTENT_PILLARS.map((p) => [p, p])], row?.pillar || '', { 'data-field': 'pillar' })),
        field('Status', select(CONTENT_STATUS.map((s) => [s.id, s.label]), row?.status || 'ide', { 'data-field': 'status' }))
      ),
      field('Catatan', textarea({ 'data-field': 'notes', rows: 3, value: row?.notes || '' }))
    );
    modal.setBody(form);
    modal.action('Batal', () => modal.close(), 'is-ghost');
    modal.action('Simpan', () => this.guard(async () => {
      const values = {};
      form.querySelectorAll('[data-field]').forEach((node) => { values[node.dataset.field] = node.value; });
      if (!values.title.trim() || !values.date) throw new Error('Tanggal dan judul wajib diisi.');
      await this.services.saveItem('calendar', { ...(row || {}), ...values });
      modal.close();
      await this.refreshCapacity();
      await this.render();
    }, 'Slot disimpan.'), 'is-primary');
    modal.open();
  }
}
