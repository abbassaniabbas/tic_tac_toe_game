import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("apps/mobile/dist-web");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
    let file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let content;
    try {
      content = await readFile(file);
    } catch {
      if (extname(file)) {
        res.writeHead(404).end();
        return;
      }
      try {
        file += ".html";
        content = await readFile(file);
      } catch {
        file = resolve(root, "index.html");
        content = await readFile(file);
      }
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4174, "127.0.0.1", () =>
  console.log("Native component preview: http://127.0.0.1:4174"),
);
