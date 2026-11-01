/** 极简静态文件服务器（用于预览 dist/build/h5） */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.argv[2] || 'dist/build/h5';
const PORT = Number(process.argv[3] || 8090);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    const rootNorm = normalize(ROOT);
    if (!file.startsWith(rootNorm) && !file.startsWith(rootNorm.replace(/\\/g, '/'))) {
      res.writeHead(403); res.end(); return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store', // 静态服务器：禁缓存，保证用户拿到最新构建
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}/`));
