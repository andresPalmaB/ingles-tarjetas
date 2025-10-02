// Ejecutar: node server.cjs 5173
import http from 'node:http';
import { createReadStream, stat } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2] || 5173);
const ROOT = join(__dirname, 'out');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2':'font/woff2'
};

const server = http.createServer((req, res) => {
    let path = req.url.split('?')[0];
    if (path === '/') path = '/index.html';
    const filePath = join(ROOT, decodeURIComponent(path));

    stat(filePath, (err, st) => {
        if (err || !st.isFile()) {
            // fallback SPA
            const index = join(ROOT, 'index.html');
            stat(index, (e2, st2) => {
                if (e2) { res.writeHead(404); res.end('Not found'); return; }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                createReadStream(index).pipe(res);
            });
            return;
        }
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
});
