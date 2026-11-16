import { AppError } from './AppError.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const HISTORY_LIMIT = 200;

/** Logger kecil dengan level + riwayat untuk panel diagnostik. */
export class Logger {
  static level = 'warn';
  static history = [];
  static listeners = new Set();

  constructor(scope = 'app') {
    this.scope = scope;
  }

  static setLevel(level) {
    Logger.level = LEVELS[level] ? level : 'warn';
  }

  static record(level, scope, message, data) {
    const entry = { at: new Date().toISOString(), level, scope, message, data };
    Logger.history.push(entry);
    if (Logger.history.length > HISTORY_LIMIT) Logger.history.shift();
    Logger.listeners.forEach((fn) => fn(entry));
  }

  static onEntry(fn) {
    Logger.listeners.add(fn);
    return () => Logger.listeners.delete(fn);
  }

  write(level, message, data) {
    if (LEVELS[level] < LEVELS[Logger.level]) return;
    Logger.record(level, this.scope, message, data);
    if (typeof console !== 'undefined') {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(`[${this.scope}] ${message}`, data ?? '');
    }
  }

  debug(message, data) { this.write('debug', message, data); }
  info(message, data) { this.write('info', message, data); }
  warn(message, data) { this.write('warn', message, data); }
  error(message, data) {
    const err = data instanceof Error ? { message: data.message, code: data.code } : data;
    this.write('error', message, err);
    return AppError.from(data, 'logged');
  }
}

export const log = new Logger('creator');
