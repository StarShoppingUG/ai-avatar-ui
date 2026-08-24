import fs from 'fs';
import path from 'path';

const distIndexPath = path.resolve(process.cwd(), 'dist/index.html');
let html = fs.readFileSync(distIndexPath, 'utf-8');

const backendUrl = process.env.VITE_BACKEND_URL;

if (!backendUrl) {
  console.error('❌ VITE_BACKEND_URL is not set — aborting build.');
  process.exit(1);
}

html = html.replaceAll('%VITE_BACKEND_URL%', backendUrl);

fs.writeFileSync(distIndexPath, html);
console.log(`✅ Injected VITE_BACKEND_URL into dist/index.html`);