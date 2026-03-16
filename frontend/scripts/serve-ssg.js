const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(process.cwd(), 'dist', 'frontend', 'browser');
const PORT = Number(process.env.PORT || '4173');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function resolveExistingPath(requestPath) {
  const normalizedPath = decodeURIComponent(requestPath.split('?')[0]);
  const safePath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;

  if (safePath === '') {
    return path.join(DIST_DIR, 'index.html');
  }

  const directPath = path.join(DIST_DIR, safePath);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  if (!path.extname(safePath)) {
    const nestedIndexPath = path.join(DIST_DIR, safePath, 'index.html');
    if (fs.existsSync(nestedIndexPath)) {
      return nestedIndexPath;
    }
  }

  return path.join(DIST_DIR, 'index.html');
}

function sendFile(filePath, response) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);

  response.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(response);

  stream.on('error', (error) => {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Failed to read file: ${error.message}`);
  });
}

if (!fs.existsSync(DIST_DIR)) {
  console.error(`Build output not found at ${DIST_DIR}. Run "npm run build:ssg" first.`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const targetPath = resolveExistingPath(request.url || '/');
  sendFile(targetPath, response);
});

server.listen(PORT, () => {
  console.log(`Serving prerendered frontend at http://localhost:${PORT}`);
});
