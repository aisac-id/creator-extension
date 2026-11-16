/* Panen halaman versi content-script (classic, tanpa import). */
(() => {
  if (window.HXPageHarvest) return;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const DEFAULTS = {
    minImageWidth: 200,
    minImageHeight: 200,
    maxImages: 80,
    includeBackground: true,
    textMaxChars: 20000,
    pacingMs: 600,
    autoScroll: true,
    scrollSteps: 6
  };

  const absolute = (raw) => {
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      if (!/^https?:$/i.test(url.protocol)) return '';
      return url.href.split('#')[0];
    } catch {
      return '';
    }
  };

  const srcsetBest = (srcset) => {
    const parts = String(srcset || '').split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
    return parts[parts.length - 1] || '';
  };

  async function scrollPage(settings) {
    if (!settings.autoScroll) return;
    const steps = Math.max(1, Number(settings.scrollSteps) || 6);
    const delay = Math.max(60, Number(settings.pacingMs) || 600);
    for (let index = 0; index < steps; index += 1) {
      window.scrollBy({ top: Math.round(window.innerHeight * 0.9), behavior: 'instant' });
      await sleep(delay);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function collectImages(settings) {
    const seen = new Set();
    const all = [];
    const add = (raw, alt, width, height, source) => {
      const url = absolute(raw);
      if (!url || seen.has(url)) return;
      seen.add(url);
      all.push({ url, alt: String(alt || '').trim(), width: Number(width) || 0, height: Number(height) || 0, source });
    };
    document.querySelectorAll('img').forEach((img) => {
      add(img.currentSrc || img.src || srcsetBest(img.getAttribute('srcset')), img.alt || img.title,
        img.naturalWidth || img.getAttribute('width'), img.naturalHeight || img.getAttribute('height'), 'img');
    });
    document.querySelectorAll('picture source[srcset]').forEach((source) => {
      add(srcsetBest(source.getAttribute('srcset')), '', 0, 0, 'picture');
    });
    if (settings.includeBackground) {
      const pattern = /url\((['"]?)(.*?)\1\)/gi;
      Array.from(document.querySelectorAll('[style*="background"]')).slice(0, 1200).forEach((node) => {
        const style = node.getAttribute('style') || '';
        let match;
        while ((match = pattern.exec(style))) add(match[2], '', 0, 0, 'background');
      });
    }
    const minW = Number(settings.minImageWidth) || 0;
    const minH = Number(settings.minImageHeight) || 0;
    const max = Math.max(1, Number(settings.maxImages) || 80);
    const items = [];
    let skipped = 0;
    for (const item of all) {
      if ((item.width && item.width < minW) || (item.height && item.height < minH)) {
        skipped += 1;
        continue;
      }
      items.push(item);
      if (items.length >= max) break;
    }
    return { items, scanned: all.length, skipped };
  }

  function meta() {
    const pick = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || '';
    return {
      title: pick('meta[property="og:title"]') || document.title || '',
      description: pick('meta[property="og:description"]') || pick('meta[name="description"]'),
      author: pick('meta[name="author"]') || pick('meta[property="article:author"]'),
      publishedAt: pick('meta[property="article:published_time"]'),
      url: document.querySelector('link[rel="canonical"]')?.href || location.href
    };
  }

  function container() {
    const nodes = [document.querySelector('article'), document.querySelector('main'), document.querySelector('[role="main"]'), document.body].filter(Boolean);
    let best = document.body;
    let score = 0;
    nodes.forEach((node) => {
      const sum = Array.from(node.querySelectorAll('p')).reduce((total, p) => total + (p.textContent || '').trim().length, 0);
      if (sum > score) {
        best = node;
        score = sum;
      }
    });
    return best;
  }

  function tables() {
    return Array.from(document.querySelectorAll('table')).slice(0, 5).map((table) => ({
      headers: Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim()),
      rows: Array.from(table.querySelectorAll('tbody tr')).slice(0, 60)
        .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim())),
      caption: (table.caption?.textContent || '').trim()
    })).filter((table) => table.headers.length || table.rows.length);
  }

  function lists() {
    return Array.from(document.querySelectorAll('ul, ol')).slice(0, 6).map((list) => ({
      ordered: list.tagName === 'OL',
      items: Array.from(list.querySelectorAll(':scope > li')).slice(0, 25)
        .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 3)
    })).filter((list) => list.items.length > 1);
  }

  function extractText(settings) {
    const root = container();
    const limit = Math.max(500, Number(settings.textMaxChars) || 20000);
    const blocks = Array.from(root.querySelectorAll('h1, h2, h3, p, blockquote'))
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 30);
    let text = blocks.join('\n\n');
    if (text.length < 200) text = (root.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    const truncated = text.length > limit;
    if (truncated) text = text.slice(0, limit);
    return {
      title: meta().title,
      text,
      truncated,
      meta: meta(),
      tables: tables(),
      lists: lists(),
      words: text.split(/\s+/).filter(Boolean).length
    };
  }

  async function settings() {
    const stored = await chrome.storage.local.get('hx.settings');
    return { ...DEFAULTS, ...(stored['hx.settings']?.scraper || {}) };
  }

  window.HXPageHarvest = {
    async run({ images = true, text = true } = {}) {
      const config = await settings();
      const result = { sourceUrl: location.href, pageTitle: document.title, images: null, text: null };
      if (images) {
        await scrollPage(config);
        result.images = collectImages(config);
      }
      if (text) {
        try {
          result.text = extractText(config);
        } catch (error) {
          result.text = { title: '', text: '', tables: [], lists: [], error: error.message };
        }
      }
      return result;
    }
  };
})();
