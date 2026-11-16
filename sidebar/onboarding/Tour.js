import { el } from '../../ui/Dom.js';

/** Coach-mark tour: menyorot elemen nyata di sidebar, satu langkah per waktu. */
export class Tour {
  constructor(app, steps, onDone = null) {
    this.app = app;
    this.steps = steps;
    this.onDone = onDone;
    this.index = 0;
    this.layer = null;
    this.target = null;
    this.onKey = (event) => {
      if (event.key === 'Escape') this.close();
    };
  }

  start() {
    if (this.layer) return;
    this.layer = el('div', { class: 'hx-tour-layer', role: 'dialog', 'aria-label': 'Tur singkat' });
    this.card = el('div', { class: 'hx-tour-card' });
    this.layer.append(this.card);
    document.body.append(this.layer);
    document.addEventListener('keydown', this.onKey);
    this.show();
  }

  clearTarget() {
    this.target?.classList.remove('hx-tour-target');
    this.target = null;
  }

  show() {
    this.clearTarget();
    const step = this.steps[this.index];
    this.target = document.querySelector(step.target);
    this.target?.classList.add('hx-tour-target');
    const label = el('div', { class: 'hx-tour-step', text: `Tur ${this.index + 1}/${this.steps.length}` });
    const title = el('div', { class: 'hx-tour-title', text: step.title });
    const text = el('p', { class: 'hx-tour-text', text: step.text });
    const actions = el('div', { class: 'hx-tour-actions' },
      el('button', { class: 'hx-btn is-ghost is-small', type: 'button', text: 'Lewati', onclick: () => this.close() }),
      el('span', { class: 'hx-tour-spacer' }),
      this.index > 0 ? el('button', { class: 'hx-btn is-small', type: 'button', text: 'Kembali', onclick: () => this.back() }) : null,
      el('button', {
        class: 'hx-btn is-primary is-small',
        type: 'button',
        text: this.index >= this.steps.length - 1 ? 'Selesai' : 'Lanjut',
        onclick: () => this.next()
      })
    );
    this.card.replaceChildren(label, title, text, actions);
    this.place();
  }

  place() {
    const width = Math.min(248, window.innerWidth - 24);
    this.card.style.width = `${width}px`;
    const rect = this.target?.getBoundingClientRect();
    if (!rect) {
      this.card.style.left = `${Math.max(12, (window.innerWidth - width) / 2)}px`;
      this.card.style.top = '80px';
      return;
    }
    const height = this.card.offsetHeight || 170;
    let left = rect.right + 10;
    if (left + width > window.innerWidth - 8) left = Math.max(8, rect.left - width - 10);
    if (left + width > window.innerWidth - 8) left = Math.max(8, (window.innerWidth - width) / 2);
    let top = rect.top;
    if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  }

  next() {
    if (this.index >= this.steps.length - 1) return this.close();
    this.index += 1;
    this.show();
  }

  back() {
    if (this.index <= 0) return;
    this.index -= 1;
    this.show();
  }

  close() {
    this.clearTarget();
    this.layer?.remove();
    this.layer = null;
    document.removeEventListener('keydown', this.onKey);
    this.onDone?.();
  }
}

export const TOUR_STEPS = [
  { target: '#rail', title: 'Semua fitur di rail ini', text: 'Ide, naskah, panen, data, jadwal, deal, analitik, otomasi, dan koneksi tersusun vertikal. Klik salah satu untuk pindah panel.' },
  { target: '[data-tab="ideas"]', title: 'Mulai dari ide', text: 'Bank Ide menyimpan ide dari halaman atau dari AI, lalu bisa langsung diubah menjadi naskah.' },
  { target: '[data-tab="harvest"]', title: 'Panen aset & data', text: 'Panel Panen mengambil gambar, teks, dan tabel dari tab aktif, lalu menyimpannya ke Data.' },
  { target: '[data-tab="data"]', title: 'Data tersimpan lokal', text: 'Semua hasil panen ada di Data dan bisa dianalisis, diekspor, atau dikirim ke platform.' },
  { target: '#btnMode', title: 'Tiga mode tampilan', text: 'Rail, Sidebar, atau Layar Penuh. Gunakan Alt+Shift+S / Alt+Shift+F kapan saja.' },
  { target: '#btnHelp', title: 'Bantuan kontekstual', text: 'Tombol ? di setiap panel membuka panduan singkat. Panduan ini juga bisa diulang dari sini.' }
];
