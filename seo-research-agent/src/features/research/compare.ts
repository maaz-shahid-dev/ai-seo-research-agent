import { normalizePhrase } from "./autocomplete";

type ComparableKeyword = { keyword: string; searchVolume: number | null; difficulty: number | null };
export type KeywordSide = { searchVolume: number | null; difficulty: number | null };
export type ComparedKeyword = { keyword: string; a: KeywordSide | null; b: KeywordSide | null };

/**
 * Splits two searches' keywords into only-A, only-B and both, matching on
 * the normalized phrase. Each list is sorted by the larger volume.
 */
export function compareKeywordSets(a: readonly ComparableKeyword[], b: readonly ComparableKeyword[]) {
  const index = (items: readonly ComparableKeyword[]) => {
    const map = new Map<string, ComparableKeyword>();
    for (const item of items) {
      const key = normalizePhrase(item.keyword);
      if (key && !map.has(key)) map.set(key, item);
    }
    return map;
  };
  const left = index(a);
  const right = index(b);
  const side = (item: ComparableKeyword | undefined): KeywordSide | null =>
    item ? { searchVolume: item.searchVolume, difficulty: item.difficulty } : null;

  const rows: ComparedKeyword[] = [...new Set([...left.keys(), ...right.keys()])].map((key) => ({
    keyword: key,
    a: side(left.get(key)),
    b: side(right.get(key)),
  }));
  const volume = (row: ComparedKeyword) => Math.max(row.a?.searchVolume ?? -1, row.b?.searchVolume ?? -1);
  rows.sort((x, y) => volume(y) - volume(x) || x.keyword.localeCompare(y.keyword));

  return {
    onlyA: rows.filter((row) => row.a && !row.b),
    onlyB: rows.filter((row) => row.b && !row.a),
    both: rows.filter((row) => row.a && row.b),
  };
}
