import { AppError } from './AppError.js';

export const MSG = {
  PING: 'hx:ping',
  TOGGLE: 'hx:toggle',
  SET_MODE: 'hx:set-mode',
  GET_MODE: 'hx:get-mode',
  PAGE_INFO: 'hx:page-info',
  HARVEST: 'hx:harvest',
  SELECTION: 'hx:selection',
  RPA_RUN: 'hx:rpa-run'
};

/** Klien pesan untuk halaman extension (sidebar/background), bukan content script. */
export class MessageBus {
  static async toTab(tabId, type, payload = {}) {
    if (!tabId) throw new AppError('no_tab', 'Tidak ada tab aktif.');
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type, payload });
      if (response?.error) throw new AppError(response.error.code || 'page_error', response.error.message);
      return response?.data ?? null;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('no_content', 'Halaman ini tidak dapat dijangkau. Buka halaman http/https biasa lalu coba lagi.');
    }
  }

  static async toBackground(type, payload = {}) {
    const response = await chrome.runtime.sendMessage({ type, payload });
    if (response?.error) throw new AppError(response.error.code || 'bg_error', response.error.message);
    return response?.data ?? null;
  }

  static async activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  static on(type, handler) {
    const listener = (message, sender, sendResponse) => {
      if (message?.type !== type) return false;
      Promise.resolve(handler(message.payload, sender))
        .then((data) => sendResponse({ data }))
        .catch((error) => sendResponse({ error: AppError.from(error).toJSON() }));
      return true;
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }

  static download(url, filename) {
    return chrome.downloads.download({ url, filename, saveAs: true });
  }
}
