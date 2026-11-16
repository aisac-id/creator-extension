import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { fmtMoney, fmtNumber, fmtDate } from '../../core/Format.js';
import { BRANDING } from '../../config/branding.js';
import { meter, stat } from './PanelKit.js';

const QUICK = [
  ['ideas', 'Cari ide'],
  ['script', 'Tulis naskah'],
  ['calendar', 'Atur jadwal'],
  ['harvest', 'Panen aset'],
  ['deals', 'Catat deal'],
  ['analytics', 'Isi metrik']
];

export class StudioPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Studio';
    this.subtitle = BRANDING.tagline;
    this.helpText = 'Studio merangkum semua pekerjaan: ide, naskah, jadwal, aset, deal, dan kondisi brand.';
  }

  async build() {
    const data = await this.services.dashboard();
    const usage = await this.services.llm.usageToday();
    const brand = this.services.brand.get();
    const name = brand.name || 'Kreator';

    this.add(el('div', { class: 'hx-card is-accent' },
      el('strong', { text: `Halo, ${name}` }),
      el('p', { class: 'hx-muted', text: 'Semua kebutuhan konten ada di rail kiri. Mulai dari ide, lalu naskah, produksi, terbit, dan ukur hasilnya.' }),
      el('div', { class: 'hx-row' },
        el('button', { class: 'hx-btn is-primary', type: 'button', text: 'Ide cepat', onclick: () => this.app.go('ideas') }),
        el('button', { class: 'hx-btn', type: 'button', text: 'Panen dari tab aktif', onclick: () => this.app.go('harvest') })
      )
    ));

    const counts = data.counts;
    this.add(el('div', { class: 'hx-stats' },
      stat(counts.ideas, 'Ide', 'Bank ide'),
      stat(counts.scripts, 'Naskah', 'Siap produksi', true),
      stat(counts.calendar, 'Jadwal', 'Slot kalender'),
      stat(counts.datasets, 'Dataset', 'Hasil panen')
    ));

    const quick = this.section('Aksi cepat');
    quick.append(el('div', { class: 'hx-quick' }, QUICK.map(([tab, label]) => el('button', {
      class: 'hx-quick-btn', type: 'button', text: label, onclick: () => this.app.go(tab)
    }))));

    const upcoming = this.section('Jadwal terdekat', [
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Buka kalender', onclick: () => this.app.go('calendar') })
    ]);
    if (!data.upcoming.length) {
      upcoming.append(this.empty('Belum ada jadwal', 'Tambahkan slot dari Kalender atau minta AI menyusun rencana 7 hari.'));
    } else {
      const list = el('div', { class: 'hx-list' });
      data.upcoming.forEach((slot) => list.append(el('div', { class: 'hx-item' },
        el('div', { class: 'hx-item-top' },
          el('div', { class: 'hx-item-title', text: slot.title || 'Tanpa judul' }),
          el('span', { class: 'hx-muted hx-small', text: fmtDate(slot.date, 'short') })
        ),
        el('div', { class: 'hx-item-sub', text: `${slot.platform || '—'} · ${slot.format || '—'} · ${slot.status || 'ide'}` })
      )));
      upcoming.append(list);
    }

    const pipeline = this.section('Pipeline & brand');
    pipeline.append(el('div', { class: 'hx-card is-flat' },
      el('div', { class: 'hx-kv' },
        el('span', { class: 'hx-muted', text: 'Deal berjalan' }),
        el('span', { text: `${data.pipeline.count} · ${fmtMoney(data.pipeline.value, this.settings.get('general.currency', 'IDR'))}` })
      ),
      el('div', { class: 'hx-kv' },
        el('span', { class: 'hx-muted', text: 'Profil brand' }),
        el('span', { text: `${data.brand.percent}% lengkap` })
      ),
      meter(data.brand.percent, data.brand.percent < 100 ? `Lengkapi: ${this.services.brand.missing().slice(0, 2).join(', ')}` : 'Siap dipakai AI'),
      el('button', {
        class: 'hx-btn is-small', type: 'button', text: 'Lengkapi profil brand',
        onclick: () => this.app.go('brand')
      })
    ));

    const ai = this.section('AI hari ini');
    ai.append(el('div', { class: 'hx-card is-flat' },
      el('div', { class: 'hx-kv' },
        el('span', { class: 'hx-muted', text: 'Panggilan' }),
        el('span', { text: fmtNumber(usage.calls) })
      ),
      el('div', { class: 'hx-kv' },
        el('span', { class: 'hx-muted', text: 'Token masuk/keluar' }),
        el('span', { text: `${fmtNumber(usage.inTokens)} / ${fmtNumber(usage.outTokens)}` })
      ),
      el('div', { class: 'hx-kv' },
        el('span', { class: 'hx-muted', text: 'Biaya estimasi' }),
        el('span', { text: `$${(usage.costUsd || 0).toFixed(3)}` })
      ),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Kelola AI', onclick: () => this.app.go('connections') })
    ));

    this.add(el('p', { class: 'hx-muted hx-small', text: `Edition ${this.services.license.edition.toUpperCase()} · ${this.services.license.label().text}` }));
  }
}
