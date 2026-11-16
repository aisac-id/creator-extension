/** Konstanta shell sidebar dan util tampilan kecil. */
export const MODE_KEY = 'hx.ui.mode';
export const TAB_KEY = 'hx.ui.tab';
export const MODES = ['rail', 'sidebar', 'full'];
export const MODE_ICON = { rail: 'rail', sidebar: 'studio', full: 'full' };
export const MODE_LABEL = { rail: 'rail', sidebar: 'sidebar', full: 'layar penuh' };

export function accentSoft(hex) {
  const value = String(hex || '#22d3ee').replace('#', '');
  if (value.length !== 6) return 'rgba(34, 211, 238, 0.14)';
  const num = parseInt(value, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, 0.14)`;
}
