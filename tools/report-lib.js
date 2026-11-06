/* Helpers for building the project report.
 *
 * Code shown in the report is read out of git at the relevant tag, not
 * copied by hand, so the report cannot quietly disagree with the
 * repository it is describing.
 */

const { execSync, execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* Read a file as it existed at a given tag. */
function fileAt(tag, file) {
  return execFileSync('git', ['show', tag + ':' + file], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024
  }).replace(/\r\n/g, '\n');
}

/* Take the lines from the first line containing `from` up to (and
 * including) the first later line containing `to`. */
function slice(text, from, to, opts) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.includes(from));
  if (start === -1) throw new Error('slice start not found: ' + from);
  let end;
  if (to == null) {
    end = start + ((opts && opts.count) || 20) - 1;
  } else {
    end = lines.findIndex((l, i) => i > start && l.includes(to));
    if (end === -1) throw new Error('slice end not found: ' + to);
  }
  return lines.slice(start, end + 1).join('\n');
}

/* Strip a uniform leading indent so excerpts sit flush in the PDF. */
function dedent(text) {
  const lines = text.split('\n').filter((l) => l.trim().length);
  const indent = Math.min.apply(null, lines.map((l) => l.match(/^ */)[0].length));
  return text.split('\n').map((l) => l.slice(indent)).join('\n');
}

function code(label, text, opts) {
  const o = opts || {};
  return (label ? '<p class="code-label">' + label + '</p>' : '') +
    '<pre' + (o.long ? ' class="long"' : '') + '><code>' +
    esc(dedent(text).trim()) + '</code></pre>';
}

function fig(name, caption) {
  return '<figure><img src="screenshots/' + name + '.png" alt="">' +
    '<figcaption>' + caption + '</figcaption></figure>';
}

function figPair(a, b, caption) {
  return '<figure><div class="fig-pair">' +
    '<img src="screenshots/' + a + '.png" alt="">' +
    '<img src="screenshots/' + b + '.png" alt="">' +
    '</div><figcaption>' + caption + '</figcaption></figure>';
}

function prompt(label, paragraphs) {
  return '<div class="prompt"><p class="prompt-label">' + label + '</p>' +
    paragraphs.map((p) => '<p>' + p + '</p>').join('') + '</div>';
}

function think(paragraphs, label) {
  return '<div class="think"><p class="think-label">' +
    (label || 'Reasoning behind the change') + '</p>' +
    paragraphs.map((p) => '<p>' + p + '</p>').join('') + '</div>';
}

function note(paragraphs) {
  return '<div class="note-box">' +
    paragraphs.map((p) => '<p>' + p + '</p>').join('') + '</div>';
}

function table(headers, rows) {
  return '<table><thead><tr>' +
    headers.map((h) => '<th>' + h + '</th>').join('') +
    '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') +
    '</tbody></table>';
}

/* execFileSync, not execSync: the format string contains a pipe, which a
 * shell would treat as a pipeline. */
function gitLog() {
  const out = execFileSync('git', [
    'log', '--reverse', '--format=%H~~%h~~%ad~~%s', '--date=format:%d %b %Y'
  ], { cwd: ROOT, encoding: 'utf8' });
  return out.trim().split('\n').map((line) => {
    const [full, short, date, subject] = line.split('~~');
    return { full, short, date, subject };
  });
}

function diffStat(tagA, tagB) {
  const out = execSync('git diff --shortstat ' + tagA + ' ' + tagB, {
    cwd: ROOT, encoding: 'utf8'
  }).trim();
  return out || 'no changes';
}

function countLines(tag, file) {
  try {
    return fileAt(tag, file).split('\n').length;
  } catch (e) {
    return 0;
  }
}

module.exports = {
  ROOT, esc, fileAt, slice, dedent, code, fig, figPair,
  prompt, think, note, table, gitLog, diffStat, countLines
};
