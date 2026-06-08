const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3000
const OUT_DIR = path.join(__dirname, 'out')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0]

  // Try exact file match
  let filePath = path.join(OUT_DIR, urlPath)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(res, filePath)
  }

  // Try index.html inside directory (trailingSlash: true generates these)
  const indexPath = path.join(OUT_DIR, urlPath, 'index.html')
  if (fs.existsSync(indexPath)) {
    return serveFile(res, indexPath)
  }

  // Try adding .html
  const htmlPath = filePath + '.html'
  if (fs.existsSync(htmlPath)) {
    return serveFile(res, htmlPath)
  }

  // 404
  const notFound = path.join(OUT_DIR, '404.html')
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
  fs.createReadStream(fs.existsSync(notFound) ? notFound : path.join(OUT_DIR, 'index.html')).pipe(res)
}).listen(PORT, () => console.log(`Serving on port ${PORT}`))
