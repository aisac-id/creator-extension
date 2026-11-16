import { el, copyText } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { PLATFORMS, FORMATS, TONES, CONTENT_STATUS } from '../../config/creator.js';
import { wordCount } from '../../core/Format.js';
import { field, input, select, textarea, formValues, note } from './PanelKit.js';

const shotsToText = (shots = []) => shots
  .map((shot) => `${shot.visual || ''} | ${shot.text || ''} | ${shot.seconds || ''}`)
  .join('\n');

const textToShots = (text = '') => text.split('\n').filter((line) => line.trim()).map((line) => {
  const [visual = '', label = '', seconds = ''] = line.split('|').map((part) => part.trim());
  return { visual, text: label, seconds: Number(seconds) || 5 };
});

function aiButton(label, handler) {
  return el('button', { class: 'hx-btn is-small', type: 'button', text: label, onclick: handler });
}

/** Editor naskah: form lengkap + alat AI (naskah, hook, caption/hashtag). */
export function openScriptEditor(panel, row, { prefill = null, onSave, onDelete = null } = {}) {
  const app = panel.app;
  const data = {
    title: '', platform: 'instagram', format: 'Reels / Shorts', duration: 45,
    tone: 'Santai & akrab', idea: '', hook: '', body: '', cta: '',
    shots: [], caption: '', hashtags: [], status: 'naskah', ...(row || {}), ...(prefill || {})
  };
  const modal = new Modal(app, {
    title: row ? 'Edit naskah' : 'Naskah baru',
    subtitle: 'Hook · isi · CTA · shot list',
    wide: true
  });
  const status = el('p', { class: 'hx-muted hx-small', text: 'Siap menulis.' });

  const titleInput = input({ 'data-field': 'title', value: data.title, placeholder: 'Judul konten' });
  const platformSelect = select(PLATFORMS.map((p) => [p.id, p.label]), data.platform, { 'data-field': 'platform' });
  const formatSelect = select(FORMATS.map((f) => [f, f]), data.format, { 'data-field': 'format' });
  const toneSelect = select(TONES.map((t) => [t, t]), data.tone, { 'data-field': 'tone' });
  const statusSelect = select(CONTENT_STATUS.map((s) => [s.id, s.label]), data.status, { 'data-field': 'status' });
  const durationInput = input({ 'data-field': 'duration', type: 'number', min: 5, max: 3600, value: data.duration });
  const ideaInput = textarea({ 'data-field': 'idea', rows: 2, value: data.idea, placeholder: 'Ide/poin utama, opsional' });
  const hookInput = textarea({ 'data-field': 'hook', rows: 2, value: data.hook, placeholder: '3 detik pertama…' });
  const bodyInput = textarea({ 'data-field': 'body', rows: 8, value: data.body, placeholder: 'Isi naskah / poin-poin' });
  const ctaInput = textarea({ 'data-field': 'cta', rows: 2, value: data.cta, placeholder: 'Call to action' });
  const shotsInput = textarea({ 'data-field': 'shots', rows: 4, value: shotsToText(data.shots), placeholder: 'visual | teks di layar | detik' });
  const captionInput = textarea({ 'data-field': 'caption', rows: 3, value: data.caption });
  const tagsInput = input({ 'data-field': 'hashtags', value: (data.hashtags || []).join(' '), placeholder: '#tag1 #tag2' });

  const form = el('div', {},
    field('Judul', titleInput),
    el('div', { class: 'hx-grid hx-grid-2' },
      field('Platform', platformSelect),
      field('Format', formatSelect)
    ),
    el('div', { class: 'hx-grid hx-grid-3' },
      field('Durasi (detik)', durationInput),
      field('Gaya', toneSelect),
      field('Status', statusSelect)
    ),
    field('Ide / poin utama', ideaInput),
    el('div', { class: 'hx-row' },
      aiButton('AI tulis naskah', () => runScript()),
      aiButton('10 opsi hook', () => runHooks()),
      aiButton('Caption + hashtag', () => runCaption())
    ),
    field('Hook', hookInput),
    field('Isi naskah', bodyInput),
    field('CTA', ctaInput),
    field('Shot list', shotsInput, 'Satu baris per shot: visual | teks di layar | detik'),
    field('Caption', captionInput),
    field('Hashtag', tagsInput),
    note('Word count & estimasi durasi mengikuti kecepatan bicara di Setelan → Umum.')
  );
  modal.setBody(form, status);

  const updateCount = () => {
    const words = wordCount(`${hookInput.value} ${bodyInput.value} ${ctaInput.value}`);
    const seconds = Math.round((words / Math.max(80, panel.settings.get('general.wpm', 150))) * 60);
    status.textContent = `${words} kata · ±${seconds} detik.`;
  };
  [hookInput, bodyInput, ctaInput].forEach((node) => node.addEventListener('input', updateCount));
  updateCount();

  const runAi = async (label, fn) => {
    status.textContent = `${label}…`;
    status.className = 'hx-muted hx-small';
    try {
      await fn();
      status.textContent = `${label} selesai.`;
    } catch (error) {
      status.textContent = error.message;
      status.className = 'hx-danger';
    }
  };

  const runScript = () => runAi('AI menulis naskah', async () => {
    const result = await app.services.askJson('script', {
      title: titleInput.value || ideaInput.value,
      platform: platformSelect.value,
      format: formatSelect.value,
      duration: Number(durationInput.value) || 45,
      idea: ideaInput.value
    });
    const script = result.data?.script || result.data || {};
    hookInput.value = script.hook || hookInput.value;
    bodyInput.value = script.body || result.text;
    ctaInput.value = script.cta || ctaInput.value;
    if (Array.isArray(script.shots)) shotsInput.value = shotsToText(script.shots);
    updateCount();
  });

  const runHooks = () => runAi('Membuat hook', async () => {
    const result = await app.services.askJson('hooks', {
      title: titleInput.value || ideaInput.value,
      platform: platformSelect.value,
      count: 10
    });
    const hooks = Array.isArray(result.data) ? result.data : result.data?.hooks || [];
    if (!hooks.length) throw new Error('Tidak ada hook yang dihasilkan.');
    const picker = new Modal(app, { title: 'Pilih hook' });
    picker.setBody(el('div', { class: 'hx-list' }, hooks.map((hook) => el('button', {
      class: 'hx-item is-clickable', type: 'button', text: String(hook),
      onclick: () => {
        hookInput.value = String(hook);
        updateCount();
        picker.close();
      }
    }))));
    picker.action('Tutup', () => picker.close(), 'is-ghost');
    picker.open();
  });

  const runCaption = () => runAi('Membuat caption', async () => {
    const result = await app.services.askJson('caption', {
      title: titleInput.value || ideaInput.value,
      platform: platformSelect.value,
      tone: toneSelect.value
    });
    const payload = result.data || {};
    captionInput.value = payload.caption || result.text;
    const tags = payload.hashtags || [];
    tagsInput.value = (Array.isArray(tags) ? tags : []).map((tag) => `#${String(tag).replace(/^#/, '')}`).join(' ');
  });

  const collect = () => {
    const values = formValues(form);
    values.shots = textToShots(values.shots);
    values.hashtags = values.hashtags.split(/\s+/).filter(Boolean);
    values.duration = Number(values.duration) || 45;
    return values;
  };

  modal.action('Batal', () => modal.close(), 'is-ghost');
  if (onDelete) {
    modal.action('Hapus', async () => {
      const ok = await app.confirm({ title: 'Hapus naskah', message: 'Naskah ini akan dihapus permanen.' });
      if (!ok) return;
      await onDelete();
      modal.close();
      panel.toast('success', 'Naskah dihapus.');
    }, 'is-danger');
  }
  modal.action('Salin MD', async () => {
    const values = collect();
    const md = `# ${values.title || 'Naskah'}\n\n**Hook:** ${values.hook}\n\n${values.body}\n\n**CTA:** ${values.cta}\n\n## Shot list\n${values.shots.map((s) => `- ${s.visual} — ${s.text} (${s.seconds}s)`).join('\n')}`;
    await copyText(md);
    panel.toast('success', 'Naskah disalin sebagai Markdown.');
  });
  modal.action('Simpan', async () => {
    try {
      const values = collect();
      if (!values.title.trim()) throw new Error('Judul wajib diisi.');
      await onSave(values);
      modal.close();
      panel.toast('success', 'Naskah disimpan.');
    } catch (error) {
      status.textContent = error.message;
      status.className = 'hx-danger';
    }
  }, 'is-primary');
  modal.open();
  return modal;
}
