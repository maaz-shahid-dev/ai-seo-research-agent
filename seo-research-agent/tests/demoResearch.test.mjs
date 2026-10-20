import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneResearchSnapshot,
  findDemoSnapshot,
  normalizeSeedKeyword,
} from '../src/lib/demoResearch.ts';
import { canAccessView, isViewTab } from '../src/lib/navigation.ts';

const snapshot = {
  id: 'snapshot_1',
  project_id: 'project_1',
  seed_keyword: 'Best AI Tools',
  country: 'US',
  language: 'en',
  provider: 'Fixture',
  retrieved_at: '2026-10-20 00:00 UTC',
  keywords: [{ id: 'kw_1', keyword: 'one', trend: [1, 2, 3] }],
  serp_results: { one: [{ id: 'serp_1', position: 1 }] },
  analysis: {
    opportunity_signals: ['signal'],
    risks: ['risk'],
    missing_evidence: ['gap'],
    next_steps: ['step'],
  },
  market_comparisons: [{ countryCode: 'US' }],
};

test('normalizes seed whitespace and case', () => {
  assert.equal(normalizeSeedKeyword('  BEST   ai Tools  '), 'best ai tools');
});

test('returns only an exact project, seed, country, and language snapshot', () => {
  const exact = findDemoSnapshot([snapshot], {
    projectId: 'project_1',
    seedKeyword: ' best  ai tools ',
    country: 'us',
    language: 'EN',
  });
  assert.equal(exact?.id, 'snapshot_1');

  const wrongMarket = findDemoSnapshot([snapshot], {
    projectId: 'project_1',
    seedKeyword: 'best ai tools',
    country: 'GB',
    language: 'en',
  });
  assert.equal(wrongMarket, null);

  for (const mismatch of [
    { projectId: 'project_2', seedKeyword: 'best ai tools', country: 'US', language: 'en' },
    { projectId: 'project_1', seedKeyword: 'other seed', country: 'US', language: 'en' },
    { projectId: 'project_1', seedKeyword: 'best ai tools', country: 'US', language: 'fr' },
    { projectId: 'project_1', seedKeyword: '   ', country: 'US', language: 'en' },
  ]) {
    assert.equal(findDemoSnapshot([snapshot], mismatch), null);
  }
});

test('clones nested snapshot evidence', () => {
  const clone = cloneResearchSnapshot(snapshot);
  clone.keywords[0].trend[0] = 99;
  clone.serp_results.one[0].position = 2;
  clone.analysis.risks.push('new risk');
  clone.market_comparisons[0].countryCode = 'GB';
  clone.analysis.opportunity_signals.push('new signal');

  assert.equal(snapshot.keywords[0].trend[0], 1);
  assert.equal(snapshot.serp_results.one[0].position, 1);
  assert.deepEqual(snapshot.analysis.risks, ['risk']);
  assert.equal(snapshot.market_comparisons[0].countryCode, 'US');
  assert.deepEqual(snapshot.analysis.opportunity_signals, ['signal']);
});

test('recognizes views and keeps admin restricted to the admin role', () => {
  assert.equal(isViewTab('coverage'), true);
  assert.equal(isViewTab('unknown'), false);
  assert.equal(canAccessView('researcher', 'admin'), false);
  assert.equal(canAccessView('researcher', 'reports'), true);
  assert.equal(canAccessView('admin', 'admin'), true);
});
