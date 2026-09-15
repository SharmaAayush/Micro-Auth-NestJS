import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('public/assets/vendor/fontawesome', { recursive: true });
cpSync(
  'node_modules/@fortawesome/fontawesome-free/css',
  'public/assets/vendor/fontawesome/css',
  { recursive: true },
);
cpSync(
  'node_modules/@fortawesome/fontawesome-free/webfonts',
  'public/assets/vendor/fontawesome/webfonts',
  { recursive: true },
);