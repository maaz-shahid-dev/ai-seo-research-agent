import { describe, expect, it } from "vitest";

import {
  buildKeywordEvidence,
  collectAnalysisCitationIds,
  createAnalysisInputHash,
  createKeywordEvidenceId,
  MAX_ANALYSIS_EVIDENCE_ITEMS,
} from "@/features/research/analysis-evidence";

function keyword(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    keyword: `keyword ${id}`,
    source: "related" as const,
    intent: "commercial" as const,
    searchVolume: 1_000,
    cpcMicros: 1_250_000,
    competition: "0.4200",
    difficulty: 35,
    ...overrides,
  };
}

describe("keyword analysis evidence", () => {
  it("sorts and bounds persisted facts deterministically", () => {
    const keywords = Array.from(
      { length: MAX_ANALYSIS_EVIDENCE_ITEMS + 5 },
      (_, index) => keyword(MAX_ANALYSIS_EVIDENCE_ITEMS + 5 - index),
    );

    const evidence = buildKeywordEvidence(keywords);

    expect(evidence).toHaveLength(MAX_ANALYSIS_EVIDENCE_ITEMS);
    expect(evidence[0]).toEqual({
      id: "kw_1",
      kind: "keyword",
      label: "keyword 1",
      url: null,
      facts: [
        { label: "Source", value: "Related" },
        { label: "Intent", value: "Commercial" },
        { label: "Monthly searches", value: "1000" },
        { label: "Keyword difficulty", value: "35" },
        { label: "CPC (USD)", value: "1.25" },
        { label: "Competition", value: "0.42" },
      ],
    });
    expect(evidence.at(-1)?.id).toBe("kw_40");
  });

  it("omits unavailable metrics and safely bounds labels", () => {
    const evidence = buildKeywordEvidence([
      keyword(7, {
        keyword: `  ${"x".repeat(250)}  `,
        searchVolume: null,
        cpcMicros: null,
        competition: null,
        difficulty: null,
      }),
    ]);

    expect(evidence[0]?.label).toHaveLength(200);
    expect(evidence[0]?.facts).toEqual([
      { label: "Source", value: "Related" },
      { label: "Intent", value: "Commercial" },
    ]);
  });

  it("normalizes canonical fields before hashing", () => {
    const evidence = buildKeywordEvidence([keyword(1)]);
    const compact = createAnalysisInputHash({
      seedKeyword: "seo tools",
      countryCode: "US",
      languageCode: "en",
      model: "gpt-test",
      evidence,
    });
    const padded = createAnalysisInputHash({
      seedKeyword: "  seo   tools ",
      countryCode: "us",
      languageCode: " en ",
      model: " gpt-test ",
      evidence,
    });

    expect(padded).toBe(compact);
    expect(compact).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the hash when evidence changes", () => {
    const first = buildKeywordEvidence([keyword(1)]);
    const second = buildKeywordEvidence([keyword(1, { searchVolume: 2_000 })]);
    const base = {
      seedKeyword: "seo",
      countryCode: "US",
      languageCode: "en",
      model: "gpt-test",
    };

    expect(createAnalysisInputHash({ ...base, evidence: first })).not.toBe(
      createAnalysisInputHash({ ...base, evidence: second }),
    );
  });

  it("collects distinct citations in first-use order", () => {
    expect(
      collectAnalysisCitationIds({
        summary: { statement: "Summary", citationIds: ["kw_2", "kw_1"] },
        opportunitySignals: [{ statement: "Opportunity", citationIds: ["kw_1", "kw_3"] }],
        risks: [{ statement: "Risk", citationIds: ["kw_2"] }],
        missingEvidence: [],
        nextSteps: [{ statement: "Next", citationIds: ["kw_4"] }],
      }),
    ).toEqual(["kw_2", "kw_1", "kw_3", "kw_4"]);
  });

  it("rejects unsafe or duplicate keyword identifiers", () => {
    expect(() => createKeywordEvidenceId(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
    expect(() => buildKeywordEvidence([keyword(1), keyword(1)])).toThrow(TypeError);
  });
});
