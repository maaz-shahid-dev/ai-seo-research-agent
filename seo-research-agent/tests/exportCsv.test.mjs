import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKeywordsCSV } from '../src/lib/exportCsv.ts';

function keyword(overrides = {}) {
  return {
    id: 'kw_test',
    research_run_id: 'run_test',
    keyword: 'safe keyword',
    search_volume: 1200,
    keyword_difficulty: 24,
    cpc: 1.5,
    intent: 'Commercial',
    source: 'Test provider',
    retrieved_at: '2026-10-20 00:00 UTC',
    ...overrides,
  };
}

test('exports numeric metrics as numeric spreadsheet cells', () => {
  const [, row] = buildKeywordsCSV([keyword()], 'US', 'en').split('\r\n');
  assert.match(row, /^"safe keyword",1200,24,1\.5,/);
});

test('quotes commas and doubles embedded quotes', () => {
  const [, row] = buildKeywordsCSV([
    keyword({ keyword: 'tools, "tested"' }),
  ], 'US', 'en').split('\r\n');
  assert.match(row, /^"tools, ""tested""",/);
});

test('neutralizes spreadsheet formulas in every string field', () => {
  const [, row] = buildKeywordsCSV([
    keyword({ keyword: '=HYPERLINK("https://bad.example")', source: '  +SUM(1,1)' }),
  ], '@US', '-en').split('\r\n');

  assert.ok(row.includes('"\'=HYPERLINK(""https://bad.example"")"'));
  assert.ok(row.includes('"\'@US"'));
  assert.ok(row.includes('"\'-en"'));
  assert.ok(row.includes('"\'  +SUM(1,1)"'));
});

test('represents missing metrics as N/A without inventing zeroes', () => {
  const [, row] = buildKeywordsCSV([
    keyword({ search_volume: null, keyword_difficulty: null, cpc: null, intent: null }),
  ], 'US', 'en').split('\r\n');
  assert.match(row, /,"N\/A","N\/A","N\/A","N\/A",/);
});

test('emits only the header for an empty result set', () => {
  const csv = buildKeywordsCSV([], 'US', 'en');
  assert.equal(csv.split('\r\n').length, 1);
  assert.match(csv, /^"Keyword","Search Volume"/);
});

test('converts non-finite metrics to N/A', () => {
  const [, row] = buildKeywordsCSV([
    keyword({ search_volume: Number.NaN, keyword_difficulty: Number.POSITIVE_INFINITY }),
  ], 'US', 'en').split('\r\n');
  assert.match(row, /^"safe keyword","N\/A","N\/A",1\.5,/);
});

test('preserves embedded line breaks inside a quoted field', () => {
  const csv = buildKeywordsCSV([
    keyword({ keyword: 'first line\r\nsecond line' }),
  ], 'US', 'en');
  assert.ok(csv.includes('"first line\r\nsecond line",1200'));
});
