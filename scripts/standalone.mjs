import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(resolve(project, 'dist/index.html'), 'utf8');
html = html.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  const js = readFileSync(resolve(project, 'dist', src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, (_, src) =>
  `<style>${readFileSync(resolve(project, 'dist', src), 'utf8')}</style>`);
const icon = readFileSync(resolve(project, 'public/favicon.svg'), 'utf8');
html = html.replace('href="./favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(icon)}"`);
const output = resolve(project, 'artifacts/PLAY-SUPER-FUNCTION-HERO.html');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`Standalone game saved: ${output}`);
