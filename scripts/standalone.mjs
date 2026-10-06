import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
const embedded = new Map();
for (const file of readdirSync(resolve(project, "dist/assets"))) {
  const ext = file.slice(file.lastIndexOf("."));
  if (!MIME[ext]) continue;
  embedded.set(
    `./assets/${file}`,
    `data:${MIME[ext]};base64,${readFileSync(resolve(project, "dist/assets", file)).toString("base64")}`,
  );
}
function packAssets(text) {
  for (const [path, url] of embedded) {
    text = text.split(path).join(url);
    // Vite's relative base also emits new URL("file.png",import.meta.url).
    // Inline modules must resolve that image without a companion assets dir.
    const filename = path.slice("./assets/".length);
    text = text.split(JSON.stringify(filename)).join(JSON.stringify(url));
  }
  return text;
}
let html = readFileSync(resolve(project, "dist/index.html"), "utf8");
html = html.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  const js = packAssets(
    readFileSync(resolve(project, "dist", src), "utf8"),
  ).replace(/<\/script/gi, "<\\/script");
  return `<script type="module">${js}</script>`;
});
html = html.replace(
  /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g,
  (_, src) =>
    `<style>${packAssets(readFileSync(resolve(project, "dist", src), "utf8"))}</style>`,
);
const icon = readFileSync(resolve(project, "public/favicon.svg"), "utf8");
html = html.replace(
  'href="./favicon.svg"',
  `href="data:image/svg+xml,${encodeURIComponent(icon)}"`,
);
const output = resolve(project, "artifacts/PLAY-SUPER-FUNCTION-HERO.html");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`Standalone game saved: ${output}`);
