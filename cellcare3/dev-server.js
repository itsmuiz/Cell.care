/**
 * Cell Care India — Local Development Server (Zero-Dependency Vercel Emulator)
 * Run: `node dev-server.js`
 * Opens at: http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
};

// Load local .env if present
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && !line.startsWith('#')) {
            const key = match[1];
            let val = (match[2] || '').trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = val;
        }
    });
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsedUrl.pathname || '/');

    // Route /api/* requests to Vercel serverless function handlers
    if (pathname.startsWith('/api/')) {
        const apiName = pathname.replace(/^\/api\//, '').replace(/\.js$/, '');
        const handlerPath = path.join(ROOT, 'api', `${apiName}.js`);

        if (!fs.existsSync(handlerPath) || apiName.startsWith('_')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: `API route /api/${apiName} not found` }));
        }

        // Collect request body for POST/PUT/PATCH/DELETE
        let rawBody = '';
        req.on('data', chunk => { rawBody += chunk; });
        req.on('end', async () => {
            req.query = parsedUrl.query || {};
            if (rawBody) {
                try {
                    req.body = JSON.parse(rawBody);
                } catch {
                    req.body = rawBody;
                }
            } else {
                req.body = {};
            }

            // Enhance res with Express/Vercel helper methods (.status(), .json())
            res.status = (code) => {
                res.statusCode = code;
                return res;
            };
            res.json = (data) => {
                if (!res.headersSent) {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                }
                res.end(JSON.stringify(data));
                return res;
            };

            try {
                delete require.cache[require.resolve(handlerPath)];
                const handler = require(handlerPath);
                await handler(req, res);
            } catch (err) {
                console.error(`[API Error] ${pathname}:`, err);
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            }
        });
        return;
    }

    // Serve static files
    if (pathname === '/') pathname = '/index.html';
    let filePath = path.join(ROOT, pathname);

    // Support clean URLs (e.g. /shop -> /shop.html)
    if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
        filePath += '.html';
    }

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`  CELL CARE INDIA — Dynamic E-Commerce Server Running!`);
    console.log(`  Storefront : http://localhost:${PORT}`);
    console.log(`  Shop Page  : http://localhost:${PORT}/shop.html`);
    console.log(`  Services   : http://localhost:${PORT}/services.html`);
    console.log(`  Track Order: http://localhost:${PORT}/track-order.html`);
    console.log(`=============================================================\n`);
});
