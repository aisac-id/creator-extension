/** Ringkasan brand untuk konteks prompt LLM. */
export function brandSummary(brand = {}) {
  const parts = [];
  if (brand.name) parts.push(`Nama brand/kreator: ${brand.name}`);
  if (brand.niche) parts.push(`Niche: ${brand.niche}`);
  if (brand.audience) parts.push(`Audiens: ${brand.audience}`);
  if (brand.tone) parts.push(`Gaya bahasa: ${brand.tone}`);
  if (brand.pillars?.length) parts.push(`Pilar konten: ${[].concat(brand.pillars).join(', ')}`);
  const ctas = brand.ctas || brand.cta;
  if (ctas && [].concat(ctas).join('').trim()) parts.push(`CTA yang biasa dipakai: ${[].concat(ctas).join(' | ')}`);
  if (brand.offers) parts.push(`Produk/penawaran: ${brand.offers}`);
  if (brand.values) parts.push(`Nilai brand: ${brand.values}`);
  if (brand.signature) parts.push(`Ciri khas: ${brand.signature}`);
  if (brand.bio) parts.push(`Bio: ${brand.bio}`);
  if (brand.banned && [].concat(brand.banned).join('').trim()) parts.push(`Hindari kata/frasa: ${[].concat(brand.banned).join(', ')}`);
  if (brand.links?.length) parts.push(`Tautan penting: ${[].concat(brand.links).join(', ')}`);
  return parts.length ? parts.join('\n') : 'Belum ada brand kit. Pakai gaya netral, ramah, dan praktis.';
}

export function systemPrompt(brand, extra = '') {
  return [
    'Kamu adalah asisten kreator konten profesional berbahasa Indonesia.',
    'Tulis ringkas, konkret, tanpa basa-basi, dan siap dipakai.',
    'Jangan mengarang angka, nama merek, atau klaim yang tidak diberikan.',
    'Ikuti format output yang diminta. Jika diminta JSON, balas JSON valid tanpa penjelasan tambahan.',
    '',
    brandSummary(brand),
    extra
  ].filter(Boolean).join('\n');
}
