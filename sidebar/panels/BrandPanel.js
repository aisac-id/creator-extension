import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { TONES } from '../../config/creator.js';
import { field, input, select, textarea, meter, note } from './PanelKit.js';

const FIELDS = [
  ['name', 'Nama brand / kreator'],
  ['handle', 'Handle (@)'],
  ['niche', 'Niche'],
  ['audience', 'Audiens utama'],
  ['city', 'Kota / cakupan'],
  ['cta', 'Call to action favorit']
];

export class BrandPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Profil Brand';
    this.subtitle = 'Konteks untuk semua AI dan naskah';
    this.helpText = 'Profil brand dipakai sebagai system prompt AI. Semakin lengkap, semakin konsisten hasilnya.';
  }

  async build() {
    const brand = this.services.brand.get();
    this.completenessNode = el('div');
    this.add(this.completenessNode);
    this.renderCompleteness();

    const form = el('div', {});
    FIELDS.forEach(([key, label]) => {
      form.append(field(label, input({ 'data-brand': key, value: brand[key] || '' })));
    });
    form.append(
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Bahasa', select([['id', 'Indonesia'], ['en', 'English'], ['keduanya', 'Campuran']], brand.language || 'id', { 'data-brand': 'language' })),
        field('Gaya bahasa', select(TONES.map((tone) => [tone, tone]), brand.tone || TONES[0], { 'data-brand': 'tone' }))
      ),
      field('Nilai / prinsip', textarea({ 'data-brand': 'values', rows: 2, value: brand.values || '', placeholder: 'mis. jujur, praktis, tanpa istilah rumit' })),
      field('Produk / penawaran', textarea({ 'data-brand': 'offers', rows: 2, value: brand.offers || '', placeholder: 'kelas, jasa, affiliate, merchandise…' })),
      field('Ciri khas', input({ 'data-brand': 'signature', value: brand.signature || '', placeholder: 'frasa/format yang selalu muncul' })),
      field('Kata/frasa yang dihindari', input({ 'data-brand': 'banned', value: brand.banned || '', placeholder: 'mis. "murah banget", "auto kaya"' })),
      field('Bio', textarea({ 'data-brand': 'bio', rows: 3, value: brand.bio || '' })),
      field('Tautan penting', textarea({ 'data-brand': 'links', rows: 2, value: (brand.links || []).join('\n'), placeholder: 'Satu URL per baris' })),
      note('Profil hanya tersimpan lokal. AI memakai data ini sesuai provider yang kamu aktifkan.')
    );
    this.form = form;
    this.add(form);

    this.add(el('div', { class: 'hx-row' },
      el('button', { class: 'hx-btn is-primary', type: 'button', text: 'Simpan profil', onclick: () => this.save() }),
      el('button', { class: 'hx-btn', type: 'button', text: 'AI buat bio', onclick: () => this.makeBio() }),
      el('button', { class: 'hx-btn is-ghost', type: 'button', text: 'Muat ulang', onclick: () => this.app.go('brand') })
    ));
  }

  renderCompleteness() {
    const info = this.services.brand.completeness();
    this.completenessNode.replaceChildren(meter(info.percent,
      info.missing?.length ? `${info.filled}/${info.total} terisi` : `${info.filled}/${info.total} lengkap`
    ));
  }

  collect() {
    const values = {};
    this.form.querySelectorAll('[data-brand]').forEach((node) => { values[node.dataset.brand] = node.value; });
    values.links = values.links.split('\n').map((line) => line.trim()).filter(Boolean);
    return values;
  }

  async save() {
    try {
      const values = this.collect();
      if (!values.name.trim()) throw new Error('Nama brand wajib diisi.');
      await this.services.brand.save(values);
      this.renderCompleteness();
      this.toast('success', 'Profil brand disimpan.');
    } catch (error) {
      this.toast('error', error.message);
    }
  }

  async makeBio() {
    await this.services.brand.save(this.collect());
    const status = el('p', { class: 'hx-muted hx-small', text: 'AI menulis bio…' });
    const modal = new Modal(this.app, { title: 'Pilihan bio', subtitle: 'Klik untuk memakai' });
    modal.setBody(status);
    modal.action('Tutup', () => modal.close(), 'is-ghost');
    modal.open();
    try {
      const result = await this.services.askJson('bio', {});
      const bios = result.data?.bios || [];
      modal.setBody(
        el('div', { class: 'hx-list' }, bios.map((bio) => el('button', {
          class: 'hx-item is-clickable', type: 'button', text: bio,
          onclick: () => {
            this.form.querySelector('[data-brand="bio"]').value = bio;
            modal.close();
            this.toast('info', 'Bio dimasukkan ke form. Jangan lupa simpan.');
          }
        }))),
        result.data?.links?.length ? el('div', { class: 'hx-chips' }, result.data.links.map((link) => el('span', { class: 'hx-chip', text: link }))) : null
      );
    } catch (error) {
      modal.setBody(el('p', { class: 'hx-danger', text: error.message }));
    }
  }
}
