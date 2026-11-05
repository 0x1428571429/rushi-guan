#!/usr/bin/env node
/**
 * 本地静态服务器
 *
 * 零依赖。用法：
 *   node scripts/serve.mjs [端口]
 *
 * 为什么需要它：题库是外部 JSON，浏览器在 file:// 协议下
 * 会拦截 fetch，所以本地预览要走一个 HTTP 服务器。
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize, sep } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const port = Number(process.argv[2]) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    // 防路径穿越
    const target = normalize(resolve(root, "." + pathname));
    if (!target.startsWith(root + sep) && target !== root) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const info = await stat(target);
    if (info.isDirectory()) {
      res.writeHead(404).end("Not found");
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`\n  如是观 → http://localhost:${port}\n  Ctrl+C 停止\n`);
});
