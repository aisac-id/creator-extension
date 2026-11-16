import { systemPrompt } from './CreatorContext.js';

const json = (lines) => `Balas HANYA JSON valid dengan bentuk:\n${lines.join('\n')}`;

/**
 * PromptLibrary: template prompt per tugas kreator, disimpan sebagai data
 * sehingga mudah ditambah tanpa mengubah LlmHub.
 */
export class PromptLibrary {
  task(name, input = {}, brand = {}) {
    const builder = this[name];
    if (typeof builder !== 'function') {
      return { system: systemPrompt(brand), user: String(input.prompt || '') };
    }
    return builder.call(this, input, brand);
  }

  ideas({ topic = '', platform = 'instagram', format = 'Reels', count = 6 }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu ahli ide konten yang scroll-stopping, bukan clickbait murahan.'),
      user: [
        `Buat ${count} ide konten untuk ${platform} format ${format}.`,
        topic ? `Topik/niche: ${topic}` : 'Gunakan niche brand di atas.',
        json([
          '[',
          '  {"judul":"...","hook":"...","angle":"...","format":"...","cta":"..."}',
          ']'
        ])
      ].join('\n')
    };
  }

  hooks({ title = '', platform = 'tiktok', count = 10 }, brand) {
    return {
      system: systemPrompt(brand, 'Hook harus spesifik, maksimal 12 kata, dan memancing penasaran tanpa menipu.'),
      user: `Judul konten: ${title}\nPlatform: ${platform}\nBuat ${count} variasi hook pembuka.\n${json(['["hook 1","hook 2"]'])}`
    };
  }

  script({ title = '', platform = 'tiktok', format = 'Reels / Shorts', duration = 45, idea = '' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu penulis naskah short-form yang disiplin struktur Hook-Body-CTA.'),
      user: [
        `Buat naskah ${format} untuk ${platform}, target ${duration} detik.`,
        `Judul/ide: ${title || idea}`,
        'Body harus berisi 2–4 poin praktis dengan contoh konkret.',
        json([
          '{',
          '  "hook":"...","body":"...","cta":"...",',
          '  "shots":[{"visual":"...","text":"...","seconds":5}]',
          '}'
        ])
      ].join('\n')
    };
  }

  caption({ title = '', platform = 'instagram', tone = '' }, brand) {
    return {
      system: systemPrompt(brand, `Gaya caption: ${tone || 'sesuai brand'}.`),
      user: [
        `Buat caption ${platform} untuk konten: ${title}`,
        'Sertakan baris pembuka kuat, isi singkat, CTA, dan 5–8 hashtag.',
        json(['{"caption":"...","hashtags":["..."],"cta":"..."}'])
      ].join('\n')
    };
  }

  hashtags({ niche = '', platform = 'instagram', tier = 'sedang' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu peneliti hashtag yang menghindari tag spam dan shadowban.'),
      user: [
        `Buat 3 set hashtag untuk ${platform}, niche: ${niche || brand.niche || 'umum'}, ukuran akun: ${tier}.`,
        'Set: broad (jangkauan besar), niche (spesifik), lokal/komunitas.',
        json(['{"broad":["..."],"niche":["..."],"lokal":["..."],"rekomendasi":["..."]}'])
      ].join('\n')
    };
  }

  titles({ topic = '', platform = 'youtube' }, brand) {
    return {
      system: systemPrompt(brand, 'Judul harus jelas, mengandung kata kunci, dan tidak menjebak.'),
      user: [
        `Buat 8 judul ${platform} untuk topik: ${topic}`,
        'Sertakan 5 opsi teks thumbnail (maks 4 kata).',
        json(['{"titles":["..."],"thumbnailTexts":["..."]}'])
      ].join('\n')
    };
  }

  repurpose({ title = '', content = '', platforms = ['instagram', 'tiktok', 'linkedin'] }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu ahli repurposing: satu ide jadi banyak format tanpa terasa duplikat.'),
      user: [
        `Ide/konten utama: ${title}`,
        content ? `Isi/transkrip:\n${String(content).slice(0, 4000)}` : '',
        `Buat rencana repurpose untuk: ${platforms.join(', ')}.`,
        json(['{"items":[{"platform":"...","format":"...","angle":"...","outline":["..."]}]}'])
      ].filter(Boolean).join('\n')
    };
  }

  ratecard({ followers = 0, engagement = 0, platform = 'instagram', niche = '' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu konsultan monetisasi kreator yang realistis terhadap pasar Indonesia.'),
      user: [
        `Buat rekomendasi rate card untuk ${platform}.`,
        `Followers: ${followers}, engagement rate: ${engagement}%, niche: ${niche || brand.niche || 'umum'}.`,
        'Buat 3 paket (basic, standar, premium) dengan deliverable dan rentang harga Rupiah.',
        json(['{"packages":[{"nama":"...","deliverable":["..."],"hargaMin":0,"hargaMax":0}],"catatan":"..."}'])
      ].join('\n')
    };
  }

  research({ topic = '', platform = 'tiktok' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu analis tren konten yang fokus pada sudut yang belum ramai.'),
      user: [
        `Riset konten untuk topik: ${topic} di ${platform}.`,
        'Beri 6 sudut/angle, 5 celah yang belum banyak dibahas, dan 5 ide hook.',
        json(['{"angles":["..."],"gaps":["..."],"hooks":["..."]}'])
      ].join('\n')
    };
  }

  improve({ text = '', platform = 'instagram' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu editor naskah: pertajam tanpa mengubah suara penulis.'),
      user: [
        `Perbaiki teks berikut untuk ${platform}.`,
        'Kembalikan versi final + 3 catatan perbaikan singkat.',
        `Teks:\n${String(text).slice(0, 6000)}`
      ].join('\n')
    };
  }

  reply({ message = '', tone = 'ramah', context = '' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu admin sosial media: membalas hangat, singkat, dan menjaga reputasi.'),
      user: [
        `Balas pesan/komentar berikut dengan gaya ${tone}.`,
        context ? `Konteks: ${context}` : '',
        `Pesan: ${message}`,
        'Beri 3 opsi balasan (singkat, ramah, profesional).'
      ].filter(Boolean).join('\n')
    };
  }

  calendar({ niche = '', platform = 'instagram', days = 7, start = '' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu perencana konten yang menyeimbangkan edukasi, hiburan, dan penjualan.'),
      user: [
        `Buat rencana konten ${days} hari untuk ${platform}${start ? ` mulai ${start}` : ''}.`,
        `Niche: ${niche || brand.niche || 'umum'}.`,
        json(['{"slots":[{"hari":1,"judul":"...","format":"...","pilar":"...","status":"ide"}]}'])
      ].join('\n')
    };
  }

  bio(brand) {
    return {
      system: systemPrompt(brand, 'Kamu copywriter profil: jelas siapa kamu, untuk siapa, dan apa aksi berikutnya.'),
      user: 'Buat 4 opsi bio sosial media (maks 150 karakter) + 3 opsi link-in-bio satu baris.\n' +
        json(['{"bios":["..."],"links":["..."]}'])
    };
  }

  thumbnail({ title = '', platform = 'youtube' }, brand) {
    return {
      system: systemPrompt(brand, 'Kamu desainer thumbnail: teks maks 4 kata, kontras tinggi, emosi jelas.'),
      user: [
        `Beri 6 konsep thumbnail untuk ${platform}: ${title}`,
        'Setiap konsep: teks utama, elemen visual, ekspresi/subjek, warna dominan.',
        json(['[{"teks":"...","visual":"...","subjek":"...","warna":"..."}]'])
      ].join('\n')
    };
  }
}
