import { BasePanel } from '../../ui/BasePanel.js';
import { el, downloadText, readFile } from '../../ui/Dom.js';
import { chooseFile } from '../../ui/Dom.js';
import { Modal } from '../../ui/Modal.js';
import { RpaClient } from '../../rpa/RpaClient.js';
import { field, input, textarea, toolbar, itemRow, iconButton, badge, note } from './PanelKit.js';

export class RpaPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Automasi (RPA)';
    this.subtitle = 'Script JSON untuk halaman aktif';
    this.helpText = 'RPA menjalankan langkah click/type/scroll/extract di tab aktif. Selalu ada pause, resume, stop, dan pacing.';
    this.client = new RpaClient();
    this.running = false;
  }

  async build() {
    this.add(toolbar(
      el('button', { class: 'hx-btn is-small is-primary', type: 'button', text: '+ Script', onclick: () => this.openEditor() }),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Import', onclick: () => this.importScripts() }),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Export', onclick: () => this.exportScripts() })
    ));
    this.controls = el('div', { class: 'hx-row' },
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Pause', onclick: () => this.client.pause() }),
      el('button', { class: 'hx-btn is-small', type: 'button', text: 'Resume', onclick: () => this.client.resume() }),
      el('button', { class: 'hx-btn is-small is-danger', type: 'button', text: 'Stop', onclick: () => this.client.stop() }),
      badge('Idle', 'is-ok')
    );
    this.statusBadge = this.controls.lastChild;
    this.add(this.controls);
    this.add(note('Jeda, retry, timeout, dan batas aksi per jam diatur di Setelan → Otomasi. Patuhi ketentuan situs.'));
    this.logNode = el('div', { class: 'hx-list' });
    this.add(this.logNode);
    this.listNode = el('div', { class: 'hx-list' });
    this.add(this.listNode);
    this.track(this.client.onEvent((event) => this.onEvent(event)));
    await this.render();
  }

  log(text) {
    this.logNode.prepend(el('div', { class: 'hx-item' }, el('div', { class: 'hx-item-sub', text: `${new Date().toLocaleTimeString()} · ${text}` })));
  }

  onEvent(event) {
    if (event.type === 'started') {
      this.running = true;
      this.statusBadge.textContent = 'Berjalan';
      this.statusBadge.className = 'hx-badge is-warn';
      this.log(`Mulai: ${event.name}`);
    } else if (event.type === 'log') {
      this.log(event.message || event.step || 'Langkah');
    } else if (event.type === 'done') {
      this.running = false;
      this.statusBadge.textContent = 'Selesai';
      this.statusBadge.className = 'hx-badge is-ok';
      this.log(`Selesai. ${event.summary ? JSON.stringify(event.summary) : ''}`);
    } else if (event.type === 'error') {
      this.running = false;
      this.statusBadge.textContent = 'Error';
      this.statusBadge.className = 'hx-badge is-danger';
      this.log(`Error: ${event.message || 'tidak diketahui'}`);
    } else if (event.type === 'disconnected') {
      this.running = false;
      this.statusBadge.textContent = 'Terputus';
      this.statusBadge.className = 'hx-badge';
      this.log('Koneksi ke halaman terputus.');
    }
  }

  async render() {
    const rows = await this.services.rpaScripts.list();
    this.listNode.replaceChildren();
    if (!rows.length) {
      this.listNode.append(this.empty('Belum ada script', 'Tambahkan script baru atau import dari file JSON.'));
      return;
    }
    rows.forEach((row) => this.listNode.append(itemRow({
      title: row.name || 'Script',
      meta: `${row.steps?.length || 0} langkah`,
      subtitle: row.description || 'Tanpa deskripsi',
      actions: [
        iconButton('play', 'Jalankan di tab aktif', () => this.run(row)),
        iconButton('edit', 'Edit script', () => this.openEditor(row)),
        iconButton('trash', 'Hapus', () => this.remove(row))
      ]
    })));
  }

  async run(script) {
    try {
      const tab = await this.services.activeTab();
      if (!tab?.id) throw new Error('Tidak ada tab aktif.');
      if (!/^https?:/i.test(tab.url || '')) throw new Error('Buka halaman http/https biasa untuk menjalankan RPA.');
      if (!Array.isArray(script.steps) || !script.steps.length) throw new Error('Script tidak punya langkah.');
      await this.client.start(tab.id, script);
    } catch (error) {
      this.onEvent({ type: 'error', message: error.message });
      this.toast('error', error.message);
    }
  }

  async exportScripts() {
    downloadText(await this.services.rpaScripts.exportJson(), 'creator-rpa.json', 'application/json');
    this.toast('success', 'Script diexport.');
  }

  async importScripts() {
    const file = await chooseFile('.json');
    if (!file) return;
    try {
      const count = await this.services.rpaScripts.importJson(await readFile(file));
      await this.render();
      this.toast('success', `${count} script diimpor.`);
    } catch (error) {
      this.toast('error', error.message);
    }
  }

  async remove(row) {
    const ok = await this.confirm(`Hapus script "${row.name}"?`, 'Hapus script');
    if (!ok) return;
    await this.services.rpaScripts.remove(row.id);
    await this.render();
  }

  openEditor(row = null) {
    const modal = new Modal(this.app, { title: row ? 'Edit script' : 'Script baru', wide: true });
    const name = input({ value: row?.name || '' });
    const description = input({ value: row?.description || '' });
    const steps = textarea({ rows: 12, value: JSON.stringify(row?.steps || [{ action: 'scroll', value: 700 }], null, 2) });
    const status = el('p', { class: 'hx-muted hx-small', text: 'Aksi: click, type, select, scroll, wait, waitForSelector, extract, navigate, loop, if, screenshot.' });
    modal.setBody(field('Nama', name), field('Deskripsi', description), field('Langkah (JSON array)', steps), status);
    modal.action('Batal', () => modal.close(), 'is-ghost');
    modal.action('Simpan', async () => {
      try {
        const parsed = JSON.parse(steps.value);
        if (!Array.isArray(parsed)) throw new Error('Langkah harus berupa array JSON.');
        if (!name.value.trim()) throw new Error('Nama script wajib diisi.');
        await this.services.rpaScripts.save({ ...(row || {}), name: name.value.trim(), description: description.value, steps: parsed });
        modal.close();
        await this.render();
        this.toast('success', 'Script disimpan.');
      } catch (error) {
        status.textContent = error.message;
        status.className = 'hx-danger';
      }
    }, 'is-primary');
    modal.open();
  }

  destroy() {
    this.client.stop();
    super.destroy();
  }
}
