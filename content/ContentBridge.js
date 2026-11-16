/* ContentBridge: host Shadow DOM + iframe sidebar, mode, shortcut, pesan, intent. */
(() => {
  if (window.top !== window || window.HXContentBridge) return;
  window.HXContentBridge = true;

  const HOST_ID = 'hx-creator-host';
  const MODE_KEY = 'hx.ui.mode';
  const MODES = ['rail', 'sidebar', 'full'];
  const state = { mode: 'sidebar', visible: false, ready: false, pending: null, host: null, shadow: null, frame: null };

  const normalize = (mode) => (MODES.includes(mode) ? mode : 'sidebar');

  function widthPx() {
    if (state.mode === 'rail') return 56;
    if (state.mode === 'full') return window.innerWidth;
    return Math.max(280, Math.min(420, Math.round(window.innerWidth * 0.25)));
  }

  function paint() {
    if (!state.host) return;
    state.host.style.display = state.visible ? 'block' : 'none';
    state.host.style.width = `${widthPx()}px`;
  }

  function createHost() {
    if (state.host) return;
    const host = document.createElement('div');
    host.id = HOST_ID;
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      height: '100vh',
      zIndex: '2147483646',
      display: 'none',
      overflow: 'hidden',
      background: '#0a0f1e',
      boxShadow: '-10px 0 34px rgba(0, 0, 0, 0.3)',
      transition: 'width 0.18s ease'
    });
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}html,body{margin:0;height:100%;overflow:hidden}' +
      'iframe{border:0;width:100%;height:100%;display:block;background:#0a0f1e;color-scheme:dark}';
    const frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('sidebar/sidebar.html');
    frame.title = 'Creator Harness';
    frame.setAttribute('allow', 'clipboard-write');
    frame.addEventListener('load', () => { state.ready = false; });
    shadow.append(style, frame);
    (document.documentElement || document.body).append(host);
    state.host = host;
    state.shadow = shadow;
    state.frame = frame;
    paint();
  }

  function toSidebar(data) {
    if (!state.frame?.contentWindow) return;
    state.frame.contentWindow.postMessage({ source: 'hx-page', ...data }, '*');
  }

  function deliver() {
    if (!state.ready || !state.pending) return;
    const intent = state.pending;
    state.pending = null;
    toSidebar({ type: 'intent', intent });
  }

  function setMode(mode, { announce = false, persist = true } = {}) {
    state.mode = normalize(mode);
    state.visible = true;
    createHost();
    paint();
    if (persist) chrome.storage.local.set({ [MODE_KEY]: state.mode });
    if (announce) toSidebar({ type: 'mode', mode: state.mode });
  }

  function open() {
    state.visible = true;
    createHost();
    paint();
    deliver();
  }

  function close() {
    state.visible = false;
    paint();
  }

  function toggle() {
    if (state.visible) close();
    else open();
  }

  function selectionText() {
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA)$/.test(active.tagName)) {
      const start = active.selectionStart ?? 0;
      const end = active.selectionEnd ?? 0;
      if (end > start) return active.value.slice(start, end);
    }
    return window.getSelection()?.toString() || '';
  }

  chrome.storage.local.get([MODE_KEY, 'hx.settings']).then((items) => {
    state.mode = normalize(items[MODE_KEY]);
    if (items['hx.settings']?.general?.autoOpen) open();
  }).catch(() => {});

  window.addEventListener('message', (event) => {
    if (!state.frame || event.source !== state.frame.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== 'hx-sidebar') return;
    if (data.type === 'ready') {
      state.ready = true;
      toSidebar({ type: 'mode', mode: state.mode });
      deliver();
    } else if (data.type === 'close') {
      close();
    } else if (data.type === 'mode' && data.mode) {
      setMode(data.mode);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey) {
      const key = String(event.key || '').toLowerCase();
      if (key === 's') {
        event.preventDefault();
        if (!state.visible) open();
        else setMode(state.mode === 'rail' ? 'sidebar' : 'rail', { announce: true });
      } else if (key === 'f') {
        event.preventDefault();
        if (!state.visible) open();
        setMode(state.mode === 'full' ? 'sidebar' : 'full', { announce: true });
      }
      return;
    }
    if (event.key === 'Escape' && state.visible && state.mode === 'full') {
      setMode('sidebar', { announce: true });
    }
  }, true);

  window.addEventListener('resize', () => {
    if (state.visible && state.mode !== 'rail') paint();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message?.type;
    if (typeof type !== 'string' || !type.startsWith('hx:')) return false;
    const reply = (promise) => {
      Promise.resolve(promise)
        .then((data) => sendResponse({ data }))
        .catch((error) => sendResponse({ error: { code: error.code || 'page_error', message: error.message } }));
      return true;
    };
    if (type === 'hx:toggle') {
      toggle();
      sendResponse({ data: { mode: state.mode, visible: state.visible } });
      return false;
    }
    if (type === 'hx:set-mode') {
      setMode(message.payload?.mode, { announce: true });
      sendResponse({ data: { mode: state.mode, visible: state.visible } });
      return false;
    }
    if (type === 'hx:get-mode') {
      sendResponse({ data: { mode: state.mode, visible: state.visible } });
      return false;
    }
    if (type === 'hx:page-info') {
      sendResponse({ data: { url: location.href, title: document.title, canScrape: true, selection: selectionText() } });
      return false;
    }
    if (type === 'hx:selection') {
      sendResponse({ data: selectionText() });
      return false;
    }
    if (type === 'hx:harvest') {
      if (!window.HXPageHarvest) return reply(Promise.reject(new Error('Scraper belum siap. Muat ulang halaman.')));
      return reply(window.HXPageHarvest.run(message.payload || {}));
    }
    if (type === 'hx:intent') {
      state.pending = message.payload || {};
      open();
      deliver();
      sendResponse({ data: { ok: true } });
      return false;
    }
    return false;
  });
})();
