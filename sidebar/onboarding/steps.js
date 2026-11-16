import { CORE_STEPS } from './stepCore.js';
import { SETUP_STEPS } from './stepSetup.js';
import { CONNECT_STEPS } from './stepConnect.js';

/** 12 langkah wajib UX_FLOW: kenalan, tampilan, lisensi, tur, demo, data, ekspor, koneksi opsional. */
export const STEPS = [...CORE_STEPS, ...SETUP_STEPS, ...CONNECT_STEPS];

export const TOTAL_STEPS = STEPS.length;
