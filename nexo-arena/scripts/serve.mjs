import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("apps/web/out");
const port = Number(process.env.PORT ?? 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
    const file = resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let served = file,
      content;
    try {
      content = await readFile(served);
    } catch (error) {
      if (!["ENOENT", "EISDIR"].includes(error.code) || extname(file)) throw error;
      served = file + ".html";
      content = await readFile(served);
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(served)] ?? "application/octet-stream",
      "Cache-Control": pathname === "/sw.js" ? "no-cache" : "public, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`NEXO Arena: http://localhost:${port}`),
);
