/* RPA halaman versi content-script: kontrol pause/resume/stop lewat port hx-rpa. */
(() => {
  if (window.HXRpa) return;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const esc = (value) => (window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&'));

  function resolve(selector, root = document) {
    if (!selector) return null;
    try {
      if (typeof selector === 'string') {
        if (selector.startsWith('xpath:')) return document.evaluate(selector.slice(6), root, null, 9, null).singleNodeValue;
        return root.querySelector(selector);
      }
      const candidates = [];
      if (selector.data) {
        const [name, value] = typeof selector.data === 'string' ? ['testid', selector.data] : Object.entries(selector.data)[0] || [];
        if (name) candidates.push(`[data-${name}="${esc(value)}"]`);
      }
      if (selector.id) candidates.push(`#${esc(selector.id)}`);
      if (selector.aria) candidates.push(`[aria-label="${esc(selector.aria)}"]`);
      if (selector.css) candidates.push(selector.css);
      if (selector.text) {
        const pool = Array.from(document.querySelectorAll('button, a, [role="button"], label, input, textarea, select, [aria-label]')).slice(0, 4000);
        return pool.find((node) => {
          const label = (node.getAttribute('aria-label') || node.value || node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          return label.includes(String(selector.text).toLowerCase());
        }) || null;
      }
      if (selector.xpath) return document.evaluate(selector.xpath, root, null, 9, null).singleNodeValue;
      for (const candidate of candidates) {
        const found = root.querySelector(candidate);
        if (found) return found;
      }
      return null;
    } catch {
      return null;
    }
  }

  function queryAll(selector, root = document) {
    try {
      if (typeof selector === 'string' && selector.startsWith('xpath:')) {
        const result = document.evaluate(selector.slice(6), root, null, 7, null);
        return Array.from({ length: result.snapshotLength }, (_, index) => result.snapshotItem(index));
      }
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  function setValue(element, value) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }

  class Runner {
    constructor(steps, settings) {
      this.steps = steps;
      this.settings = settings;
      this.control = { paused: false, stopped: false };
      this.vars = {};
      this.onLog = () => {};
      this.timeout = Number(settings.timeoutMs) || 10000;
    }

    pause() { this.control.paused = true; this.onLog('warn', 'Ditahan (pause)'); }
    resume() { this.control.paused = false; this.onLog('info', 'Dilanjutkan (resume)'); }
    stop() { this.control.stopped = true; this.onLog('warn', 'Dihentikan (stop)'); }

    async idle() {
      while (this.control.paused && !this.control.stopped) await sleep(150);
    }

    delay() {
      const min = Number(this.settings.delayMin) || 300;
      const max = Number(this.settings.delayMax) || 800;
      const span = this.settings.jitter === false ? min : min + Math.random() * Math.abs(max - min);
      return sleep(span);
    }

    condition(cond = {}) {
      if (cond.selector && !resolve(cond.selector)) return false;
      if (cond.notSelector && resolve(cond.notSelector)) return false;
      if (cond.textContains && !(document.body?.innerText || '').includes(cond.textContains)) return false;
      if (cond.urlContains && !location.href.includes(cond.urlContains)) return false;
      return true;
    }

    async runStep(step) {
      if (this.control.stopped) return { status: 'skipped', detail: 'Dihentikan' };
      const action = step.action;
      if (action === 'click') {
        const element = resolve(step.selector);
        if (!element) throw new Error(`Elemen tidak ditemukan: ${JSON.stringify(step.selector)}`);
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
        const opts = { bubbles: true, cancelable: true, view: window };
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((type) => element.dispatchEvent(new MouseEvent(type, opts)));
        element.click();
        return { status: 'ok', detail: `Klik ${element.tagName.toLowerCase()}` };
      }
      if (action === 'type') {
        const element = resolve(step.selector);
        if (!element) throw new Error('Kolom input tidak ditemukan.');
        const value = String(step.value ?? '');
        element.focus();
        setValue(element, step.options?.append ? `${element.value}${value}` : value);
        element.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { status: 'ok', detail: `Isi ${value.length} karakter` };
      }
      if (action === 'select') {
        const element = resolve(step.selector);
        if (!element) throw new Error('Elemen select tidak ditemukan.');
        element.value = String(step.value ?? '');
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { status: 'ok', detail: `Pilih ${element.value}` };
      }
      if (action === 'scroll') {
        window.scrollBy({ top: Number(step.value ?? 600), behavior: 'instant' });
        return { status: 'ok', detail: 'Scroll' };
      }
      if (action === 'wait') {
        const ms = Math.min(Number(step.value ?? 500), this.timeout * 6);
        await sleep(ms);
        return { status: 'ok', detail: `Tunggu ${ms}ms` };
      }
      if (action === 'waitForSelector') {
        const deadline = Date.now() + (Number(step.options?.timeoutMs) || this.timeout);
        while (Date.now() < deadline) {
          if (resolve(step.selector)) return { status: 'ok', detail: 'Elemen siap' };
          if (this.control.stopped) return { status: 'skipped', detail: 'Dihentikan' };
          await sleep(150);
        }
        throw new Error(`Menunggu elemen timeout: ${JSON.stringify(step.selector)}`);
      }
      if (action === 'extract') {
        const options = step.options || {};
        const nodes = options.all ? queryAll(step.selector) : [resolve(step.selector)];
        if (!nodes[0]) throw new Error('Elemen ekstrak tidak ditemukan.');
        const read = (node) => (options.attr ? node.getAttribute(options.attr) || ''
          : options.href ? node.href || node.getAttribute('href') || ''
            : options.raw ? node.innerHTML : (node.textContent || '').trim());
        const values = nodes.filter(Boolean).map(read);
        const key = step.as || 'last';
        this.vars[key] = options.all ? values : values[0] || '';
        return { status: 'ok', data: this.vars[key], detail: `Ekstrak ${values.length} item` };
      }
      if (action === 'navigate') {
        const url = String(step.value || '').trim();
        if (!/^https?:\/\//i.test(url)) throw new Error('Navigasi hanya boleh http/https.');
        location.href = url;
        return { status: 'ok', detail: `Buka ${url}` };
      }
      if (action === 'loop') {
        const times = Math.max(1, Number(step.value ?? step.times ?? 1));
        let done = 0;
        for (let index = 0; index < times && !this.control.stopped; index += 1) {
          for (const child of step.steps || []) {
            await this.runStep(child);
            done += 1;
          }
        }
        return { status: 'ok', detail: `Loop ${done} langkah` };
      }
      if (action === 'if') {
        if (!this.condition(step.condition || step.when || {})) return { status: 'skipped', detail: 'Kondisi tidak terpenuhi' };
        for (const child of step.steps || []) await this.runStep(child);
        return { status: 'ok', detail: 'Kondisi terpenuhi' };
      }
      if (action === 'screenshot') return { status: 'skipped', detail: 'Tidak tersedia di halaman' };
      throw new Error(`Aksi tidak dikenal: ${action}`);
    }

    async execute(step, index) {
      const retry = Math.max(1, Number(this.settings.retry) || 1);
      let last = '';
      for (let attempt = 1; attempt <= retry; attempt += 1) {
        try {
          const result = await this.runStep(step);
          return { ...result, attempt };
        } catch (error) {
          last = error.message;
          this.onLog('warn', `Langkah ${index + 1} gagal (percobaan ${attempt}): ${last}`);
          if (attempt < retry) await sleep(300 * attempt);
        }
      }
      return { status: 'failed', reason: last, detail: last };
    }

    async run() {
      const startedAt = Date.now();
      const results = [];
      this.onLog('info', `Mulai ${this.steps.length} langkah`);
      for (let index = 0; index < this.steps.length; index += 1) {
        if (this.control.stopped) break;
        await this.idle();
        const step = this.steps[index];
        this.onLog('info', `Langkah ${index + 1}/${this.steps.length}: ${step.action}`);
        const result = await this.execute(step, index);
        results.push({ index, action: step.action, ...result });
        if (result.status === 'failed' && !step.optional) {
          this.onLog('error', `Berhenti di langkah ${index + 1}: ${result.reason}`);
          break;
        }
        await this.delay();
      }
      const failed = results.filter((item) => item.status === 'failed').length;
      const summary = {
        total: this.steps.length,
        done: results.length,
        failed,
        stopped: this.control.stopped,
        durationMs: Date.now() - startedAt,
        results
      };
      this.onLog(failed ? 'error' : 'info', `Selesai: ${summary.done}/${this.steps.length} langkah, ${failed} gagal`);
      return summary;
    }
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get('hx.settings');
    return stored['hx.settings']?.rpa || {};
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'hx-rpa') return;
    let runner = null;
    const emit = (data) => {
      try { port.postMessage(data); } catch { /* port tertutup */ }
    };
    port.onMessage.addListener(async (message) => {
      if (message?.type === 'run') {
        runner?.stop();
        const settings = await loadSettings();
        runner = new Runner(message.steps || [], settings);
        runner.onLog = (level, text) => emit({ type: 'log', level, message: text, name: message.name });
        try {
          const summary = await runner.run();
          emit({ type: 'done', summary });
        } catch (error) {
          emit({ type: 'error', message: error.message || 'RPA gagal' });
        }
        return;
      }
      if (message?.type === 'pause') runner?.pause();
      if (message?.type === 'resume') runner?.resume();
      if (message?.type === 'stop') runner?.stop();
    });
    port.onDisconnect.addListener(() => runner?.stop());
  });

  window.HXRpa = { Runner: class extends Runner {} };
})();
