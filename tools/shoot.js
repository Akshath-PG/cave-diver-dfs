// Screenshot capture for the project report.
//
// Serves ../site over a local HTTP server, drives it with Microsoft Edge
// (via playwright-core, so no browser download is needed), and writes PNGs
// into ../docs/screenshots. Each version of the site is captured with a
// shot list so the report's version history is reproducible rather than
// hand-collected.
//
// Usage: node shoot.js <shots.json>

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const SITE = path.resolve(__dirname, '..', 'site');
const OUT = path.resolve(__dirname, '..', 'docs', 'screenshots');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(SITE, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(SITE)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function findBrowser() {
  for (const candidate of EDGE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('No Edge or Chrome installation found.');
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) throw new Error('Usage: node shoot.js <shots.json>');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  fs.mkdirSync(OUT, { recursive: true });
  const { server, port } = await startServer();
  const browser = await chromium.launch({ executablePath: findBrowser() });

  try {
    for (const shot of spec.shots) {
      const page = await browser.newPage({
        viewport: { width: shot.width || 1440, height: shot.height || 900 },
        deviceScaleFactor: 2,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await page.goto(`http://127.0.0.1:${port}/${shot.page || 'index.html'}`, {
        waitUntil: 'networkidle',
      });

      // Optional scripted interaction before capture.
      for (const step of shot.steps || []) {
        if (step.click) await page.click(step.click);
        if (step.eval) await page.evaluate(step.eval);
        if (step.wait) await page.waitForTimeout(step.wait);
      }
      await page.waitForTimeout(shot.settle == null ? 350 : shot.settle);

      const file = path.join(OUT, `${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: !!shot.fullPage });

      // Optional text extraction, used to verify output against the notes.
      let dumped = '';
      if (shot.dump) {
        dumped = await page.evaluate(
          (sel) => (document.querySelector(sel) || {}).innerText || '',
          shot.dump
        );
      }

      console.log(`[shot] ${shot.name} -> ${path.relative(process.cwd(), file)}`);
      if (errors.length) console.log(`  !! page errors: ${errors.join(' | ')}`);
      if (dumped) console.log('--- dump ---\n' + dumped + '\n--- end ---');
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
