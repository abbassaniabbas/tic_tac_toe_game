import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
const root = resolve("apps/web/out");
const files = await readdir(root, { recursive: true });
const assets = files
  .filter(
    (file) =>
      /\.(js|css|woff2?|png|svg|webmanifest)$/.test(file) && file !== "sw.js",
  )
  .sort();
const hash = createHash("sha256").update(
  await readFile(resolve(root, "index.html")),
);
for (const asset of assets) hash.update(await readFile(resolve(root, asset)));
const pages = [
  "/",
  ...["privacy", "support", "delete-account"]
    .filter((page) => files.includes(page + ".html"))
    .map((page) => "/" + page),
];
for (const page of pages.slice(1))
  hash.update(await readFile(resolve(root, page.slice(1) + ".html")));
const pageVersion = hash.digest("hex").slice(0, 12);
const paths = [
  ...pages,
  ...assets.map(
    (file) => `/${relative(root, resolve(root, file)).replaceAll("\\", "/")}`,
  ),
];
const sw = `// Generated from this production build. No remote resources or user data are cached.
const CACHE = 'nexo-arena-${pageVersion}';
const ASSETS = ${JSON.stringify(paths)};
const PAGES = ${JSON.stringify(pages)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nexo-arena-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    const page=url.pathname==='/index.html'?'/':url.pathname;
    if (!PAGES.includes(page)) return;
    event.respondWith(fetch(event.request).catch(() => caches.match(page)));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
`;
await writeFile(resolve(root, "sw.js"), sw);
console.log(
  `Offline shell: ${paths.length} assets, cache nexo-arena-${pageVersion}`,
);
