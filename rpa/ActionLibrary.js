import { AppError } from '../core/AppError.js';
import { SelectorEngine } from './SelectorEngine.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setNativeValue(element, value) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

/** Aksi RPA yang dapat dipakai ulang oleh semua extension Harness. */
export class ActionLibrary {
  constructor({ doc = document, win = window, timeoutMs = 10000, control = null, log = null } = {}) {
    this.doc = doc;
    this.win = win;
    this.timeoutMs = timeoutMs;
    this.control = control;
    this.log = log;
    this.selectors = new SelectorEngine(doc);
    this.vars = {};
  }

  element(step) {
    const found = this.selectors.resolve(step.selector, this.doc);
    if (!found) {
      const detail = typeof step.selector === 'string' ? step.selector : JSON.stringify(step.selector);
      throw new AppError('selector_not_found', `Elemen tidak ditemukan: ${detail}`);
    }
    return found;
  }

  async click(step) {
    const element = this.element(step);
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    const opts = { bubbles: true, cancelable: true, view: this.win };
    element.dispatchEvent(new MouseEvent('pointerdown', opts));
    element.dispatchEvent(new MouseEvent('mousedown', opts));
    element.dispatchEvent(new MouseEvent('pointerup', opts));
    element.dispatchEvent(new MouseEvent('mouseup', opts));
    element.click();
    return { status: 'ok', detail: `Klik ${element.tagName.toLowerCase()}` };
  }

  async type(step) {
    const element = this.element(step);
    const value = String(step.value ?? '');
    element.focus();
    if (step.options?.append) setNativeValue(element, `${element.value}${value}`);
    else setNativeValue(element, value);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { status: 'ok', detail: `Isi ${value.length} karakter` };
  }

  async select(step) {
    const element = this.element(step);
    element.focus();
    element.value = String(step.value ?? '');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { status: 'ok', detail: `Pilih ${step.value}` };
  }

  async scroll(step) {
    const amount = Number(step.value ?? 600);
    const target = step.selector ? this.element(step) : this.win;
    if (target === this.win && step.selector) {
      target.scrollBy({ top: amount, behavior: 'smooth' });
    } else if (target.scrollBy) {
      target.scrollBy({ top: amount, behavior: 'smooth' });
    } else {
      this.win.scrollBy({ top: amount, behavior: 'smooth' });
    }
    return { status: 'ok', detail: `Scroll ${amount}px` };
  }

  async wait(step) {
    const ms = Math.min(Number(step.value ?? 500), this.timeoutMs * 6);
    await sleep(ms);
    return { status: 'ok', detail: `Tunggu ${ms}ms` };
  }

  async waitForSelector(step) {
    this.element(step);
    return { status: 'ok', detail: 'Elemen siap' };
  }

  async extract(step) {
    const options = step.options || {};
    const nodes = options.all ? this.selectors.queryAll(step.selector, this.doc) : [this.element(step)];
    const read = (node) => {
      if (options.attr) return node.getAttribute(options.attr) || '';
      if (options.href) return node.href || node.getAttribute('href') || '';
      return (options.raw ? node.innerHTML : node.textContent || '').trim();
    };
    const values = nodes.map(read);
    const key = step.as || 'last';
    this.vars[key] = options.all ? values : values[0] || '';
    return {
      status: 'ok',
      data: this.vars[key],
      detail: `Ekstrak ${values.length} item${options.attr ? ` (${options.attr})` : ''}`
    };
  }

  async navigate(step) {
    const url = String(step.value || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new AppError('rpa_url', 'Hanya URL http/https yang diizinkan.');
    this.win.location.href = url;
    return { status: 'ok', detail: `Buka ${url}` };
  }

  async loop(step) {
    const times = Math.max(1, Number(step.value ?? step.times ?? 1));
    const steps = step.steps || [];
    let done = 0;
    for (let i = 0; i < times; i += 1) {
      if (this.control?.stopped) break;
      for (const child of steps) {
        await this.runStep(child);
        done += 1;
      }
    }
    return { status: 'ok', detail: `Loop ${done} langkah` };
  }

  async if(step) {
    const matched = this.condition(step.condition || step.when || {});
    if (!matched) return { status: 'skipped', detail: 'Kondisi tidak terpenuhi' };
    for (const child of step.steps || []) await this.runStep(child);
    return { status: 'ok', detail: 'Kondisi terpenuhi' };
  }

  condition(condition) {
    if (condition.selector && !this.selectors.resolve(condition.selector, this.doc)) return false;
    if (condition.notSelector && this.selectors.resolve(condition.notSelector, this.doc)) return false;
    if (condition.textContains && !(this.doc.body?.innerText || '').includes(condition.textContains)) return false;
    if (condition.urlContains && !this.win.location.href.includes(condition.urlContains)) return false;
    return true;
  }

  async screenshot() {
    return { status: 'skipped', detail: 'Screenshot hanya tersedia lewat chrome API (tidak di halaman).' };
  }

  async runStep(step) {
    const handler = this[step.action];
    if (typeof handler !== 'function') throw new AppError('rpa_action', `Aksi ${step.action} tidak dikenal.`);
    return handler.call(this, step);
  }
}

export { sleep };
