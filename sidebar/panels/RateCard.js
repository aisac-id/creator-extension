import { el, downloadText, copyText } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { PLATFORMS, platformLabel } from '../../config/creator.js';
import { fmtMoney, todayKey } from '../../core/Format.js';
import { field, input, select, note } from './PanelKit.js';

/** Rate card AI: rekomendasi 3 paket harga berdasarkan data akun. */
export function openRateCard(app) {
  const modal = new Modal(app, { title: 'Rate card', subtitle: 'Rekomendasi paket & harga', wide: true });
  const brand = app.services.brand.get();
  const followers = input({ type: 'number', min: 0, value: 10000 });
  const engagement = input({ type: 'number', min: 0, max: 100, step: 0.1, value: 3 });
  const platform = select(PLATFORMS.map((p) => [p.id, p.label]), 'instagram');
  const niche = input({ value: brand.niche || '' });
  const output = el('div', { class: 'hx-list' });
  const status = el('p', { class: 'hx-muted hx-small', text: '' });
  modal.setBody(
    el('div', { class: 'hx-grid hx-grid-2' },
      field('Followers', followers),
      field('Engagement (%)', engagement)
    ),
    el('div', { class: 'hx-grid hx-grid-2' },
      field('Platform', platform),
      field('Niche', niche)
    ),
    note(`CPM acuan di Setelan: ${fmtMoney(app.services.settings.get('deals.cpm', 75000), app.services.settings.get('general.currency', 'IDR'))}. Angka AI adalah saran, bukan jaminan.`),
    output,
    status
  );
  modal.action('Tutup', () => modal.close(), 'is-ghost');
  modal.action('Hitung', async () => {
    status.textContent = 'AI menghitung rate card…';
    status.className = 'hx-muted hx-small';
    try {
      const result = await app.services.askJson('ratecard', {
        followers: Number(followers.value) || 0,
        engagement: Number(engagement.value) || 0,
        platform: platform.value,
        niche: niche.value
      });
      const packages = result.data?.packages || [];
      output.replaceChildren(...packages.map((pack) => el('div', { class: 'hx-card is-flat' },
        el('div', { class: 'hx-item-top' },
          el('strong', { text: pack.nama || 'Paket' }),
          el('span', { class: 'hx-badge is-pro', text: `${fmtMoney(pack.hargaMin || 0)} – ${fmtMoney(pack.hargaMax || 0)}` })
        ),
        el('p', { class: 'hx-muted hx-small', text: (pack.deliverable || []).join(' · ') })
      )));
      if (result.data?.catatan) output.append(el('p', { class: 'hx-muted hx-small', text: result.data.catatan }));
      status.textContent = `Disusun oleh ${result.provider}.`;
    } catch (error) {
      status.textContent = error.message;
      status.className = 'hx-danger';
    }
  }, 'is-primary');
  modal.open();
}

function invoiceNumber(deal, prefix) {
  const date = todayKey().replace(/-/g, '');
  const suffix = String(deal.id || '').slice(-4).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

/** Invoice sederhana dari deal, siap diunduh sebagai Markdown. */
export async function openInvoice(app, deal, { onSaved = null } = {}) {
  const settings = app.services.settings;
  const prefix = settings.get('deals.invoicePrefix', 'INV');
  const taxPercent = Number(settings.get('deals.taxPercent', 0)) || 0;
  const seller = app.services.brand.get();
  const subtotal = Number(deal.value) || 0;
  const tax = Math.round((subtotal * taxPercent) / 100);
  const number = deal.invoiceNo || invoiceNumber(deal, prefix);

  const text = [
    `# INVOICE ${number}`,
    '',
    `Tanggal: ${todayKey()}`,
    deal.due ? `Jatuh tempo: ${deal.due}` : '',
    '',
    `**Dari:** ${seller.name || 'Kreator'}${seller.handle ? ` (@${seller.handle})` : ''}`,
    seller.city ? seller.city : '',
    '',
    `**Kepada:** ${deal.brand || 'Klien'}`,
    deal.campaign ? `Kampanye: ${deal.campaign}` : '',
    '',
    '| Deskripsi | Qty | Harga |',
    '| --- | --- | --- |',
    `| ${deal.deliverables || `${platformLabel(deal.platform)} content`} | 1 | ${fmtMoney(subtotal)} |`,
    '',
    `Subtotal: ${fmtMoney(subtotal)}`,
    taxPercent ? `Pajak (${taxPercent}%): ${fmtMoney(tax)}` : '',
    `**Total: ${fmtMoney(subtotal + tax)}**`,
    '',
    deal.notes ? `Catatan: ${deal.notes}` : '',
    '',
    'Terima kasih atas kerja samanya.'
  ].filter(Boolean).join('\n');

  const modal = new Modal(app, { title: 'Invoice', subtitle: number, wide: true });
  const preview = el('textarea', { class: 'hx-textarea', rows: 16, value: text });
  modal.setBody(preview);
  modal.action('Tutup', () => modal.close(), 'is-ghost');
  modal.action('Salin', async () => {
    await copyText(preview.value);
    app.toast.success('Invoice disalin.');
  });
  modal.action('Unduh .md', () => {
    downloadText(preview.value, `${number}.md`, 'text/markdown');
    app.toast.success('Invoice diunduh.');
  });
  modal.action('Tandai terbayar', async () => {
    await app.services.saveItem('deals', { ...deal, status: 'terbayar', invoiceNo: number, paidAt: new Date().toISOString() });
    modal.close();
    app.toast.success('Deal ditandai terbayar.');
    await onSaved?.();
  }, 'is-primary');
  modal.open();
}
