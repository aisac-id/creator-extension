/** Klien port dari sidebar ke content script untuk menjalankan RPA. */
export class RpaClient {
  constructor() {
    this.port = null;
    this.listeners = new Set();
  }

  onEvent(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event) {
    this.listeners.forEach((fn) => fn(event));
  }

  async start(tabId, script) {
    this.stop();
    this.port = chrome.tabs.connect(tabId, { name: 'hx-rpa' });
    this.port.onMessage.addListener((message) => this.emit(message));
    this.port.onDisconnect.addListener(() => {
      this.emit({ type: 'disconnected' });
      this.port = null;
    });
    this.port.postMessage({ type: 'run', steps: script.steps, name: script.name });
    this.emit({ type: 'started', name: script.name });
  }

  send(type) {
    this.port?.postMessage({ type });
  }

  pause() { this.send('pause'); }
  resume() { this.send('resume'); }
  stop() {
    if (this.port) {
      this.send('stop');
      this.port.disconnect();
      this.port = null;
    }
  }
}
