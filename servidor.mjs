// Servidor estático mínimo para abrir um site exportado (pasta out/) no navegador.
// Uso: node servir-pasta.mjs <pasta> <porta>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
// A porta escolhida pelo navegador do Claude (PORT) tem prioridade; senão, a do comando.
const port = Number(process.env.PORT || process.argv[3] || 3162);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary' };

http
  .createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end('404');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    console.log(`Já está rodando: abra http://127.0.0.1:${port}`);
    process.exit(0);
  })
  // HOST=0.0.0.0 libera para outros aparelhos da mesma rede Wi-Fi (por exemplo, testar no celular).
  .listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Site em http://127.0.0.1:${port}`));
