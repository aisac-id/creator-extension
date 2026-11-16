import { AppError } from '../core/AppError.js';
import { ActionLibrary, sleep } from './ActionLibrary.js';

/** Eksekusi script langkah demi langkah dengan retry, pacing, pause/resume/stop. */
export class RpaEngine {
  constructor({ doc = document, win = window, config = {}, onLog = null } = {}) {
    this.doc = doc;
    this.win = win;
    this.config = {
      delayMin: config.delayMin ?? 300,
      delayMax: config.delayMax ?? 800,
      retry: config.retry ?? 3,
      timeoutMs: config.timeoutMs ?? 10000,
      maxActionsPerHour: config.maxActionsPerHour ?? 120,
      jitter: config.jitter !== false
    };
    this.onLog = onLog;
    this.control = { paused: false, stopped: false };
    this.actions = new ActionLibrary({
      doc,
      win,
      timeoutMs: this.config.timeoutMs,
      control: this.control,
      log: (message) => this.log('info', message)
    });
    this.timestamps = [];
  }

  log(level, message, meta = {}) {
    this.onLog?.({ level, message, at: Date.now(), ...meta });
  }

  pause() { this.control.paused = true; this.log('warn', 'Ditahan (pause)'); }
  resume() { this.control.paused = false; this.log('info', 'Dilanjutkan (resume)'); }
  stop() { this.control.stopped = true; this.log('warn', 'Dihentikan (stop)'); }

  async waitIfPaused() {
    while (this.control.paused && !this.control.stopped) await sleep(150);
  }

  delay() {
    const { delayMin, delayMax, jitter } = this.config;
    const base = Math.min(delayMin, delayMax) + Math.random() * Math.abs(delayMax - delayMin);
    return sleep(jitter ? base : delayMin);
  }

  budget() {
    const cutoff = Date.now() - 3600000;
    this.timestamps = this.timestamps.filter((time) => time > cutoff);
    if (this.timestamps.length >= this.config.maxActionsPerHour) {
      throw new AppError('rpa_budget', `Batas ${this.config.maxActionsPerHour} aksi/jam tercapai.`);
    }
    this.timestamps.push(Date.now());
  }

  withTimeout(promise, index) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new AppError('rpa_timeout', `Langkah ${index + 1} melewati ${this.config.timeoutMs}ms.`)), this.config.timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async execute(step, index) {
    let lastError = null;
    for (let attempt = 1; attempt <= this.config.retry; attempt += 1) {
      try {
        this.budget();
        const result = await this.withTimeout(this.actions.runStep(step), index);
        if (result.status === 'failed') throw new AppError('rpa_failed', result.detail || 'Langkah gagal.');
        return { ...result, attempt };
      } catch (error) {
        lastError = error;
        this.log('warn', `Langkah ${index + 1} gagal (percobaan ${attempt}): ${error.message}`);
        if (attempt < this.config.retry) await sleep(300 * attempt);
      }
    }
    return { status: 'failed', reason: lastError?.message || 'Gagal', detail: lastError?.message || 'Gagal' };
  }

  async run(steps) {
    if (!Array.isArray(steps) || !steps.length) throw new AppError('rpa_empty', 'Script tidak punya langkah.');
    const startedAt = Date.now();
    const results = [];
    this.log('info', `Mulai ${steps.length} langkah`);
    for (let index = 0; index < steps.length; index += 1) {
      if (this.control.stopped) break;
      await this.waitIfPaused();
      const step = steps[index];
      this.log('info', `Langkah ${index + 1}/${steps.length}: ${step.action}`);
      const result = await this.execute(step, index);
      results.push({ index, action: step.action, ...result });
      if (result.status === 'failed' && !step.optional) {
        this.log('error', `Berhenti di langkah ${index + 1}: ${result.reason}`);
        break;
      }
      await this.delay();
    }
    const failed = results.filter((item) => item.status === 'failed').length;
    const summary = {
      total: steps.length,
      done: results.length,
      failed,
      stopped: this.control.stopped,
      durationMs: Date.now() - startedAt,
      results
    };
    this.log(failed ? 'error' : 'info', `Selesai: ${summary.done}/${steps.length} langkah, ${failed} gagal`);
    return summary;
  }
}
