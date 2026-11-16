import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { CHECKLISTS, platformLabel } from '../../config/creator.js';
import { textarea, meter, itemRow, iconButton, badge, toolbar } from './PanelKit.js';

function buildChecklist(platform) {
  return (CHECKLISTS[platform] || CHECKLISTS.instagram).map(([id, label]) => ({ id, label, done: false }));
}

export class ProducePanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Produksi';
    this.subtitle = 'Checklist, shot list, dan aset';
    this.helpText = 'Produksi memastikan tidak ada langkah yang terlewat: checklist platform, shot list dari naskah, dan aset.';
  }

  async build() {
    this.add(toolbar(
      el('button', { class: 'hx-btn is-small is-primary', type: 'button', text: '+ Mulai produksi', onclick: () => this.pickSource() })
    ));
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    await this.render();
  }

  async render() {
    const rows = await this.services.collections.produce.list();
    this.listNode.replaceChildren();
    if (!rows.length) {
      this.listNode.append(this.empty('Belum ada produksi', 'Pilih naskah atau slot kalender untuk mulai menyiapkan konten.'));
      return;
    }
    rows.forEach((row) => {
      const total = row.checklist?.length || 0;
      const done = (row.checklist || []).filter((item) => item.done).length;
      const percent = total ? Math.round((done / total) * 100) : 0;
      this.listNode.append(itemRow({
        title: row.title || 'Produksi tanpa judul',
        meta: `${platformLabel(row.platform)} · ${done}/${total}`,
        subtitle: row.done ? 'Selesai diproduksi' : `${percent}% checklist · ${row.notes ? 'ada catatan' : 'tanpa catatan'}`,
        actions: [
          badge(row.done ? 'Selesai' : `${percent}%`, row.done ? 'is-ok' : ''),
          iconButton('eye', 'Buka produksi', () => this.open(row)),
          iconButton('trash', 'Hapus', () => this.remove(row))
        ]
      }));
    });
  }

  async pickSource() {
    const [scripts, calendar] = await Promise.all([
      this.services.collections.scripts.list(),
      this.services.collections.calendar.list()
    ]);
    const modal = new Modal(this.app, { title: 'Mulai produksi', subtitle: 'Pilih sumber konten' });
    const list = el('div', { class: 'hx-list' });
    const options = [
      ...scripts.map((row) => ({ type: 'script', row })),
      ...calendar.map((row) => ({ type: 'calendar', row }))
    ];
    if (!options.length) {
      list.append(this.empty('Belum ada konten', 'Buat naskah atau slot kalender terlebih dahulu.'));
    }
    options.forEach(({ type, row }) => {
      list.append(el('button', {
        class: 'hx-item is-clickable', type: 'button',
        onclick: async () => {
          await this.startFrom(type, row);
          modal.close();
        }
      },
        el('div', { class: 'hx-item-top' },
          el('div', { class: 'hx-item-title', text: row.title || 'Tanpa judul' }),
          el('span', { class: 'hx-muted hx-small', text: type === 'script' ? 'Naskah' : 'Kalender' })
        ),
        el('div', { class: 'hx-item-sub', text: `${platformLabel(row.platform)} · ${row.format || '—'}` })
      ));
    });
    modal.setBody(list);
    modal.action('Tutup', () => modal.close(), 'is-ghost');
    modal.open();
  }

  async startFrom(type, row) {
    const existing = (await this.services.collections.produce.list())
      .find((item) => item.sourceType === type && item.sourceId === row.id);
    if (existing) {
      this.open(existing);
      return;
    }
    const record = await this.services.saveItem('produce', {
      title: row.title,
      sourceType: type,
      sourceId: row.id,
      platform: row.platform || 'instagram',
      checklist: buildChecklist(row.platform),
      notes: '',
      done: false
    });
    await this.render();
    this.open(record);
  }

  async open(record) {
    let current = record;
    const modal = new Modal(this.app, {
      title: current.title || 'Produksi',
      subtitle: `${platformLabel(current.platform)} · ${current.sourceType === 'script' ? 'dari naskah' : 'dari kalender'}`,
      wide: true
    });
    const progress = el('div');
    const checkList = el('div', { class: 'hx-list' });
    const notes = textarea({ rows: 4, value: current.notes || '', placeholder: 'Brief, properti, lokasi, catatan editing…' });
    const aiStatus = el('p', { class: 'hx-muted hx-small', text: '' });

    const save = async (patch) => {
      current = await this.services.saveItem('produce', { ...current, ...patch });
      paint();
    };

    const paint = () => {
      const total = current.checklist.length;
      const done = current.checklist.filter((item) => item.done).length;
      progress.replaceChildren(meter(total ? Math.round((done / total) * 100) : 0, `${done}/${total} langkah selesai`));
      checkList.replaceChildren(...current.checklist.map((item) => el('label', {
        class: 'hx-item is-clickable'
      },
        el('input', {
          type: 'checkbox', checked: item.done,
          onchange: (event) => {
            const next = current.checklist.map((entry) => entry.id === item.id ? { ...entry, done: event.target.checked } : entry);
            save({ checklist: next });
          }
        }),
        el('div', {},
          el('div', { class: 'hx-item-title', text: item.label }),
          el('div', { class: 'hx-item-sub', text: item.id })
        )
      )));
    };

    modal.setBody(
      progress,
      el('div', { class: 'hx-section' },
        el('div', { class: 'hx-section-head' }, el('h3', { class: 'hx-section-title', text: 'Checklist platform' })),
        checkList
      ),
      el('div', { class: 'hx-section' },
        el('div', { class: 'hx-section-head' }, el('h3', { class: 'hx-section-title', text: 'Aset & catatan' })),
        notes,
        el('div', { class: 'hx-row' },
          el('button', {
            class: 'hx-btn is-small', type: 'button', text: 'Konsep thumbnail (AI)',
            onclick: () => this.thumbnailIdeas(current, aiStatus)
          }),
          el('button', {
            class: 'hx-btn is-small', type: 'button', text: 'Simpan catatan',
            onclick: () => save({ notes: notes.value })
          })
        ),
        aiStatus
      )
    );
    paint();
    modal.action('Tutup', () => modal.close(), 'is-ghost');
    modal.action(current.done ? 'Buka lagi' : 'Tandai selesai', async () => {
      await save({ done: !current.done });
      await this.render();
      modal.close();
    }, 'is-primary');
    modal.open();
  }

  async thumbnailIdeas(record, statusNode) {
    statusNode.textContent = 'AI menyusun konsep thumbnail…';
    statusNode.className = 'hx-muted hx-small';
    try {
      const result = await this.services.askJson('thumbnail', {
        title: record.title,
        platform: record.platform
      });
      const items = Array.isArray(result.data) ? result.data : [];
      const text = items.map((item, index) => `${index + 1}. ${item.teks || item.text || ''} — ${item.visual || ''} (${item.warna || item.color || ''})`).join('\n');
      statusNode.textContent = text || result.text;
      statusNode.className = 'hx-code';
    } catch (error) {
      statusNode.textContent = error.message;
      statusNode.className = 'hx-danger';
    }
  }

  async remove(row) {
    const ok = await this.confirm(`Hapus produksi "${row.title}"?`, 'Hapus produksi');
    if (!ok) return;
    await this.services.removeItem('produce', row.id);
    await this.render();
  }
}
