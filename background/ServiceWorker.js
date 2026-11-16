import { StorageService } from '../core/StorageService.js';
import { Settings } from '../core/Settings.js';
import { SecretVault } from '../core/SecretVault.js';
import { PlatformBridge } from '../connectors/PlatformBridge.js';

const storage = new StorageService();
const settings = new Settings(storage);
const vault = new SecretVault(storage);
const bridge = new PlatformBridge({ settings, vault, storage });
const ALARM = 'hx-outbox';
const SIDEBAR_URL = chrome.runtime.getURL('sidebar/sidebar.html');

let booted = null;

function boot() {
  booted = booted || (async () => {
    await Promise.all([settings.load(), vault.init()]);
    await ensureMenus();
    await scheduleAlarm();
  })().catch((error) => {
    console.warn('[Creator Harness] boot gagal:', error.message);
    booted = null;
  });
  return booted;
}

async function ensureMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'hx:save-idea', title: 'Simpan ke Ide — Creator Harness', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'hx:harvest-page', title: 'Panen halaman ini — Creator Harness', contexts: ['page', 'image', 'link'] });
  chrome.contextMenus.create({ id: 'hx:open', title: 'Buka Creator Harness', contexts: ['page'] });
}

async function scheduleAlarm() {
  const seconds = Math.max(30, Number(settings.get('platform.pollSeconds', 60)) || 60);
  chrome.alarms.create(ALARM, { periodInMinutes: Math.max(1, Math.round(seconds / 60)) });
}

async function openStandalone() {
  const existing = await chrome.tabs.query({ url: `${SIDEBAR_URL}*` });
  if (existing.length) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId) await chrome.windows.update(existing[0].windowId, { focused: true });
    return existing[0];
  }
  return chrome.tabs.create({ url: SIDEBAR_URL });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function sendTo(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

async function toggleSidebar() {
  const tab = await activeTab();
  const response = tab?.id ? await sendTo(tab.id, { type: 'hx:toggle' }) : null;
  if (!response) await openStandalone();
}

async function sendIntent(intent) {
  const tab = await activeTab();
  const response = tab?.id ? await sendTo(tab.id, { type: 'hx:intent', payload: intent }) : null;
  if (!response) {
    await storage.set('hx.pendingIntent', intent);
    await openStandalone();
  }
}

async function toggleFullscreen() {
  const tab = await activeTab();
  if (!tab?.id) return openStandalone();
  const current = await sendTo(tab.id, { type: 'hx:get-mode' });
  if (!current?.data) return openStandalone();
  const mode = current.data.mode === 'full' ? 'sidebar' : 'full';
  await sendTo(tab.id, { type: 'hx:set-mode', payload: { mode } });
}

chrome.runtime.onInstalled.addListener(async () => {
  await boot();
  chrome.action.setBadgeText({ text: '' });
});

chrome.runtime.onStartup.addListener(() => boot());

chrome.action.onClicked.addListener(() => toggleSidebar());

chrome.commands.onCommand.addListener(async (command) => {
  await boot();
  if (command === 'toggle-fullscreen') await toggleFullscreen();
  else await toggleSidebar();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await boot();
  if (info.menuItemId === 'hx:open') {
    await toggleSidebar();
    return;
  }
  if (info.menuItemId === 'hx:harvest-page') {
    await sendIntent({ action: 'harvest', tab: 'harvest' });
    return;
  }
  if (info.menuItemId === 'hx:save-idea') {
    await sendIntent({
      action: 'save-idea',
      tab: 'ideas',
      title: (info.selectionText || tab?.title || 'Ide dari halaman').slice(0, 140),
      text: info.selectionText || '',
      url: info.pageUrl || tab?.url || ''
    });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  await boot();
  if (!settings.get('platform.enabled', false)) return;
  try {
    const result = await bridge.flushOutbox();
    if (result.sent) {
      chrome.action.setBadgeBackgroundColor({ color: '#34d399' });
      chrome.action.setBadgeText({ text: String(result.sent) });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
    }
  } catch (error) {
    console.warn('[Creator Harness] outbox tertunda:', error.message);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes['hx.settings']) return;
  settings.load().then(scheduleAlarm).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'hx:flush-outbox') {
    boot()
      .then(() => bridge.flushOutbox())
      .then((data) => sendResponse({ data }))
      .catch((error) => sendResponse({ error: { code: 'outbox_failed', message: error.message } }));
    return true;
  }
  if (message?.type === 'hx:open-standalone') {
    openStandalone().then((tab) => sendResponse({ data: { tabId: tab?.id || null } }));
    return true;
  }
  return false;
});

boot();
