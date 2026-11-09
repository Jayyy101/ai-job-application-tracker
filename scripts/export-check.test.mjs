import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationsCsv, csvCell, resumeFilename } from '../frontend/src/lib/exports.ts';

// Parse the actual CSV contract: quoted cells, escaped quotes, CRLF rows and
// embedded newlines. This avoids asserting only against another serializer.
function parse(csv) {
  const rows = []; let row = [], field = '', quoted = false;
  csv = csv.replace(/^\ufeff/, '');
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && c === ',') { row.push(field); field = ''; }
    else if (!quoted && c === '\r' && csv[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += c;
  }
  assert.equal(quoted, false);
  return rows;
}

test('CSV round trips Unicode, commas, quotes and multiline tracking fields', () => {
  const app = { id: 'synthetic-id', company: 'Café 東京, Inc.', role: '"Developer"', notes: 'Line one\r\nRésumé 🌿\nLine three', status: 'Applied' };
  const csv = applicationsCsv([app]); const [header, row] = parse(csv);
  assert.ok(csv.startsWith('\ufeff'));
  assert.equal(row[header.indexOf('Company')], app.company);
  assert.equal(row[header.indexOf('Role')], app.role);
  assert.equal(row[header.indexOf('Notes')], app.notes);
  assert.equal(row.length, header.length);
});
test('spreadsheet formulas, control prefixes and full-width operators are escaped', () => {
  for (const value of ['=1+1', '+cmd', '-2+3', '@SUM(A1)', ' \t=HYPERLINK("bad")', '\r\n=1', '\u200b=1', '＝1+1', '＋x', '－x', '＠x', '\ttext', '\0=1']) {
    assert.ok(parse(csvCell(value) + '\r\n')[0][0].startsWith("'"), JSON.stringify(value));
  }
});
test('CSV cannot introduce extra rows/cells and excludes unlisted payloads', () => {
  const csv = applicationsCsv([{ company: 'x",=1\r\n+2', role: 'Role', provider_payload: 'DO-NOT-EXPORT', api_key: 'SECRET', resume_text: 'PRIVATE-RESUME' }]);
  const rows = parse(csv);
  assert.equal(rows.length, 2); assert.equal(rows[0].length, rows[1].length);
  for (const forbidden of ['DO-NOT-EXPORT', 'SECRET', 'PRIVATE-RESUME']) assert.ok(!csv.includes(forbidden));
});
test('empty export keeps its header and deterministic column contract', () => {
  const rows = parse(applicationsCsv([])); assert.equal(rows.length, 1); assert.equal(rows[0].length, 12);
});
test('résumé filenames preserve readable Unicode while excluding paths and controls', () => {
  const name = resumeFilename('../Café / 東京\n<script> 🧪', '12345678-abcdef');
  assert.equal(name, 'jobfolio-resume-Café-東京script-12345678.txt');
  assert.ok(!name.includes('/') && !name.includes('\\') && !name.includes('\n'));
  assert.equal(resumeFilename('.../\n', '12345678'), 'jobfolio-resume-version-12345678.txt');
});
