import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_PRIMARY_SNAPSHOT,
  DEMO_PROJECTS,
  DEMO_RESEARCH_RUNS,
  DEMO_RESEARCH_SNAPSHOTS,
} from '../src/data/demo-data.ts';

test('the primary snapshot and project counts agree', () => {
  const project = DEMO_PROJECTS.find((item) => item.id === DEMO_PRIMARY_SNAPSHOT.project_id);
  assert.ok(project);
  assert.equal(project.keyword_count, DEMO_PRIMARY_SNAPSHOT.keywords.length);
  assert.equal(
    project.runs_count,
    DEMO_RESEARCH_RUNS.filter((run) => run.project_id === project.id).length,
  );
  assert.deepEqual(DEMO_RESEARCH_SNAPSHOTS, [DEMO_PRIMARY_SNAPSHOT]);
});

test('project run counters match bundled run metadata', () => {
  for (const project of DEMO_PROJECTS) {
    const runCount = DEMO_RESEARCH_RUNS.filter((run) => run.project_id === project.id).length;
    assert.equal(project.runs_count, runCount, `${project.id} run count`);
  }
});

test('SERP rows stay attached to their snapshot keyword and run', () => {
  const keywordNames = new Set(DEMO_PRIMARY_SNAPSHOT.keywords.map((keyword) => keyword.keyword));
  const keywordIds = new Set(DEMO_PRIMARY_SNAPSHOT.keywords.map((keyword) => keyword.id));
  assert.equal(keywordIds.size, DEMO_PRIMARY_SNAPSHOT.keywords.length);

  for (const [keyword, rows] of Object.entries(DEMO_PRIMARY_SNAPSHOT.serp_results)) {
    assert.ok(keywordNames.has(keyword), `SERP key ${keyword} must exist in keywords`);
    for (const row of rows) {
      assert.equal(row.keyword, keyword);
      assert.equal(row.research_run_id, 'run_demo_01');
      assert.ok(row.source);
      assert.ok(row.retrieved_at);
    }
  }
});
