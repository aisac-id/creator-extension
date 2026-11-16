import { AppError } from '../core/AppError.js';

const ORDER = ['data', 'id', 'aria', 'text', 'css', 'xpath'];

/** Resolusi selector dengan fallback: data-* -> id -> aria/text -> CSS -> XPath. */
export class SelectorEngine {
  constructor(doc = document) {
    this.doc = doc;
  }

  query(selector, root = this.doc) {
    if (!selector) return null;
    try {
      if (selector.startsWith('xpath:')) return this.xpath(selector.slice(6), root);
      return root.querySelector(selector);
    } catch {
      return null;
    }
  }

  queryAll(selector, root = this.doc) {
    try {
      if (selector.startsWith('xpath:')) {
        const result = this.doc.evaluate(selector.slice(6), root, null, 4, null);
        const list = [];
        for (let i = 0; i < result.snapshotLength; i += 1) list.push(result.snapshotItem(i));
        return list;
      }
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  xpath(expression, root = this.doc) {
    try {
      const result = this.doc.evaluate(expression, root, null, 9, null);
      return result.singleNodeValue || null;
    } catch {
      return null;
    }
  }

  /** spec: string CSS/XPath atau objek {data,id,aria,text,css,xpath}. */
  resolve(spec, root = this.doc) {
    if (!spec) return null;
    if (typeof spec === 'string') return this.query(spec, root);
    const candidates = [];
    if (spec.data) {
      if (typeof spec.data === 'string') candidates.push(`[data-testid="${cssEscape(spec.data)}"]`);
      else {
        const [name, value] = Object.entries(spec.data)[0] || [];
        if (name) candidates.push(`[data-${name}="${cssEscape(value)}"]`);
      }
    }
    if (spec.id) candidates.push(`#${cssEscape(spec.id)}`);
    if (spec.aria) {
      candidates.push(`[aria-label="${cssEscape(spec.aria)}"]`);
      candidates.push(`[role="${cssEscape(spec.aria)}"]`);
    }
    if (spec.text) return this.byText(spec.text, root);
    if (spec.css) candidates.push(spec.css);
    for (const selector of candidates) {
      const found = this.query(selector, root);
      if (found) return found;
    }
    if (spec.xpath) return this.xpath(spec.xpath, root);
    return null;
  }

  byText(text, root = this.doc) {
    const needle = String(text).trim().toLowerCase();
    const candidates = Array.from(root.querySelectorAll('button, a, [role="button"], label, h1, h2, h3, td, li, span'));
    return candidates.find((node) => (node.textContent || '').trim().toLowerCase() === needle) ||
      candidates.find((node) => (node.textContent || '').toLowerCase().includes(needle)) || null;
  }

  describe(element) {
    if (!element) return null;
    if (element.id) return `#${cssEscape(element.id)}`;
    const testid = element.getAttribute?.('data-testid');
    if (testid) return `[data-testid="${cssEscape(testid)}"]`;
    const aria = element.getAttribute?.('aria-label');
    if (aria) return `[aria-label="${cssEscape(aria)}"]`;
    const text = (element.textContent || '').trim().slice(0, 40);
    if (text && ['BUTTON', 'A'].includes(element.tagName)) return `text:${text}`;
    return element.tagName?.toLowerCase() || null;
  }

  static validate(spec) {
    if (!spec) throw new AppError('rpa_selector', 'Langkah membutuhkan selector.');
    return spec;
  }
}

function cssEscape(value) {
  return String(value ?? '').replace(/["\\]/g, '\\$&');
}

export { ORDER };
