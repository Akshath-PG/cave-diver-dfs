/* Build the project report: assemble the HTML, then print it to PDF.
 *
 * Usage: node report.js [siteUrl] [repoUrl]
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const L = require('./report-lib');
const intro = require('./content-intro');
const versions = require('./content-versions');
const analysis = require('./content-analysis');

const DOCS = path.resolve(__dirname, '..', 'docs');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
].find(fs.existsSync);

const cfg = {
  siteUrl: process.argv[2] || 'https://akshath.github.io/cave-diver-dfs/',
  repoUrl: process.argv[3] || 'https://github.com/akshath/cave-diver-dfs',
  date: new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  }),
  tree: [
    'site/',
    '  index.html          four views in one page',
    '  css/styles.css',
    '  js/graph.js         cave model, generation, tree layout',
    '  js/search.js        DFS, BFS, iterative deepening',
    '  js/cave.js          SVG renderer (rope, markers, fog of war)',
    '  js/dive.js          player mode and its levels',
    '  js/race.js          side-by-side comparison',
    '  js/app.js           playground, learn page, mode switching',
    'tools/',
    '  shoot.js            screenshot capture for the report',
    '  report.js           builds this document',
    'docs/',
    '  screenshots/        one set per version',
    'README.md'
  ].join('\n')
};

function cover() {
  return '<section class="cover">' +
    '<p class="cover-kicker">Foundations of AI &middot; Module 1 &middot; Searching</p>' +
    '<h1>Cave Diver</h1>' +
    '<h2>Building an interactive explanation of depth-first search:<br>' +
    'a version history of the prompt-engineering process</h2>' +
    '<div class="cover-rule"></div>' +
    '<div class="cover-meta">' +
    '<div><b>Algorithm</b> Depth-first search</div>' +
    '<div><b>Source</b> Course lecture notes, Lectures 3&ndash;7</div>' +
    '<div><b>AI assistant</b> Claude Opus, via Claude Code</div>' +
    '<div><b>Live site</b> <a href="' + cfg.siteUrl + '">' + cfg.siteUrl + '</a></div>' +
    '<div><b>Repository</b> <a href="' + cfg.repoUrl + '">' + cfg.repoUrl + '</a></div>' +
    '<div><b>Date</b> ' + cfg.date + '</div>' +
    '</div></section>';
}

function contents() {
  const sections = [
    ['Introduction', ['The brief', 'Algorithm chosen', 'What was produced',
      'How to read this report']],
    ['Choosing the Algorithm and Designing the Concept',
      ['Reading the source material', 'Why DFS suits an interactive treatment',
        'First round of ideas', 'The concept that was built',
        'The metaphor is exact, not decorative', 'Scope agreed before building']],
    ['Algorithm Overview: Depth-First Search',
      ['The problem search solves', 'The depth-first commitment',
        'Three ingredients', 'The algorithm', 'A worked trace',
        'Is it a good strategy?', 'Why the two bounds pull apart',
        'DFS against the alternatives', 'Where the pattern appears']],
    ['Method', ['Tools', 'Version strategy', 'Correctness before appearance',
      'Automated screenshots', 'How the AI was directed']],
    ['Version History', ['v0.1 The base', 'v0.2 The cave appears',
      'v0.3 The playground', 'v0.4 Dive mode', 'v0.5 Race mode',
      'v1.0 Learn mode and polish']],
    ['Engineering Decisions and Corrections',
      ['Recording the search instead of running it live',
        'Only repaint what changed', 'CSS silently overriding scaled geometry',
        'Sizing a drawing whose shape varies enormously',
        'The page that scrolled itself',
        'Being explicit about simulation caps']],
    ['Verification', ['The trace matches the lecture notes',
      'The complexity figures match', 'Automated checks during capture',
      'What was not verified']],
    ['Deployment', ['Hosting', 'Repository layout', 'Commit history']],
    ['Assessing the AI\u2019s Contribution',
      ['What the AI produced well', 'What it got wrong and had to correct',
        'Where human direction mattered most',
        'What a further iteration would address', 'Conclusion']],
    ['Appendix A. Complete Source', []]
  ];

  return '<h1 class="no-break">Contents</h1><div class="toc"><ol>' +
    sections.map(function (s) {
      return '<li>' + s[0] +
        (s[1].length ? '<ol>' + s[1].map((x) => '<li>' + x + '</li>').join('') +
          '</ol>' : '') + '</li>';
    }).join('') + '</ol></div>';
}

function build() {
  const css = fs.readFileSync(path.join(__dirname, 'report-style.css'), 'utf8');
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<title>Cave Diver &mdash; Project Report</title><style>' + css +
    '</style></head><body>' +
    cover() + contents() + intro(cfg) + versions(cfg) + analysis(cfg) +
    '<p class="foot-note">Cave Diver &mdash; depth-first search. ' +
    'Foundations of AI, Module 1. Report generated ' + cfg.date +
    ' from the project repository; all code excerpts are extracted from git ' +
    'at the tag under discussion.</p>' +
    '</body></html>';

  fs.mkdirSync(DOCS, { recursive: true });
  const htmlPath = path.join(DOCS, 'report.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  return htmlPath;
}

async function main() {
  const htmlPath = build();
  console.log('[report] html written: ' + htmlPath);

  const browser = await chromium.launch({ executablePath: EDGE });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'),
    { waitUntil: 'networkidle' });

  const missing = await page.evaluate(() =>
    Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => i.getAttribute('src')));
  if (missing.length) console.log('[report] !! missing images: ' + missing.join(', '));
  if (errors.length) console.log('[report] !! page errors: ' + errors.join(' | '));

  const pdfPath = path.join(DOCS, 'Cave-Diver-DFS-Report.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;font-size:7.5pt;color:#8795a1;' +
      'font-family:Segoe UI,Arial,sans-serif;padding:0 17mm;' +
      'display:flex;justify-content:space-between;">' +
      '<span>Cave Diver &mdash; Depth-First Search</span>' +
      '<span class="pageNumber"></span></div>',
    margin: { top: '17mm', bottom: '16mm', left: '0mm', right: '0mm' }
  });

  const pages = await page.evaluate(() => document.body.scrollHeight);
  await browser.close();

  const kb = Math.round(fs.statSync(pdfPath).size / 1024);
  console.log('[report] pdf written: ' + pdfPath + ' (' + kb + ' KB, content height ' +
    pages + 'px)');
}

main().catch((e) => { console.error(e); process.exit(1); });
