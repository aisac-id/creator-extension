import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { fmtDate, wordCount } from '../../core/Format.js';
import { platformLabel, statusMeta } from '../../config/creator.js';
import { badge, meter, itemRow, iconButton, toolbar, searchBox } from './PanelKit.js';
import { openScriptEditor } from './ScriptEditor.js';

export class ScriptPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Naskah';
    this.subtitle = 'Dari ide menjadi naskah siap rekam';
    this.helpText = 'Naskah menyimpan hook, isi, CTA, dan shot list. AI bisa membantu menyusun atau mempertajam.';
    this.query = '';
  }

  async build() {
    this.capacityNode = el('div');
    this.add(this.capacityNode);
    this.add(toolbar(
      searchBox('Cari naskah…', (value) => {
        this.query = value;
        this.refresh();
      }),
      el('button', { class: 'hx-btn is-small is-primary', type: 'button', text: '+ Naskah', onclick: () => this.open(null) })
    ));
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    this.track(this.services.license.onChange(() => this.refreshCapacity()));
    await this.refreshCapacity();
    await this.refresh();
    await this.consumeIntent();
  }

  async refreshCapacity() {
    const cap = await this.services.capacity('scripts');
    this.capacityNode.replaceChildren(meter(cap.percent, Number.isFinite(cap.max)
      ? `${cap.used}/${cap.max} naskah (${this.services.license.edition})`
      : `${cap.used} naskah · ${this.services.license.edition}`));
  }

  async refresh() {
    const rows = await this.services.collections.scripts.list();
    const needle = this.query.trim().toLowerCase();
    const visible = rows.filter((row) => !needle || `${row.title} ${row.body} ${row.hook}`.toLowerCase().includes(needle));
    this.listNode.replaceChildren();
    if (!visible.length) {
      this.listNode.append(this.empty('Belum ada naskah', 'Mulai dari ide, atau buat naskah kosong lalu minta AI mengisi.'));
      return;
    }
    visible.forEach((row) => {
      const meta = statusMeta(row.status || 'naskah');
      const words = wordCount(`${row.hook} ${row.body} ${row.cta}`);
      const seconds = Math.round((words / Math.max(80, this.settings.get('general.wpm', 150))) * 60);
      this.listNode.append(itemRow({
        title: row.title || 'Tanpa judul',
        meta: `${platformLabel(row.platform)} · ${row.format || '—'}`,
        subtitle: `${words} kata · ±${seconds}s · ${fmtDate(row.updatedAt, 'short')}`,
        actions: [
          badge(meta.label),
          iconButton('edit', 'Buka editor', () => this.open(row)),
          iconButton('trash', 'Hapus naskah', () => this.remove(row))
        ]
      }));
    });
  }

  async consumeIntent() {
    const intent = await this.services.storage.get('hx.intent.script', null);
    if (!intent) return;
    await this.services.storage.remove('hx.intent.script');
    this.open(null, intent);
  }

  open(row, prefill = null) {
    openScriptEditor(this, row, {
      prefill,
      onSave: async (values) => {
        const saved = await this.services.saveItem('scripts', { ...(row || {}), ...values });
        await this.refreshCapacity();
        await this.refresh();
        return saved;
      },
      onDelete: row ? async () => {
        await this.services.removeItem('scripts', row.id);
        await this.refreshCapacity();
        await this.refresh();
      } : null
    });
  }

  async remove(row) {
    const ok = await this.confirm(`Hapus naskah "${row.title}"?`, 'Hapus naskah');
    if (!ok) return;
    await this.services.removeItem('scripts', row.id);
    await this.refreshCapacity();
    await this.refresh();
    this.toast('success', 'Naskah dihapus.');
  }
}
