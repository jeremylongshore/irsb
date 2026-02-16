export {
  generateKeyPair,
  saveKeyPair,
  loadKeyPair,
  keyFileExists,
  ensureKeyPair,
} from './keys.js';

export type { WatchtowerKeyPair } from './keys.js';

export {
  signReport,
  verifyReportSignature,
  signData,
  verifyData,
} from './sign.js';

export type { ReportSignature } from './sign.js';
