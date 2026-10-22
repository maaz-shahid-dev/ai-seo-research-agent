/**
 * "Alphabet soup" expansion: ask Google Autocomplete for the seed followed by
 * each letter, preceded by question words, and joined with common modifiers.
 */

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const QUESTION_PREFIXES = ["how", "what", "why", "when", "where", "which", "who", "can", "is", "are", "does", "should"];
const MODIFIER_SUFFIXES = ["for", "with", "without", "vs", "to", "near", "best", "ideas"];
const MODIFIER_PREFIXES = ["best", "cheap", "diy"];

export type AutocompleteQuery = { query: string; pattern: "seed" | "letter" | "question" | "modifier" };

/** ~50 queries: seed, seed + a–z, question + seed, seed + modifier, modifier + seed. */
export function buildAutocompleteQueries(seedInput: string): AutocompleteQuery[] {
  const seed = normalizePhrase(seedInput);
  if (!seed) return [];
  return [
    { query: seed, pattern: "seed" },
    ...LETTERS.map((letter) => ({ query: `${seed} ${letter}`, pattern: "letter" as const })),
    ...QUESTION_PREFIXES.map((word) => ({ query: `${word} ${seed}`, pattern: "question" as const })),
    ...MODIFIER_SUFFIXES.map((word) => ({ query: `${seed} ${word}`, pattern: "modifier" as const })),
    ...MODIFIER_PREFIXES.map((word) => ({ query: `${word} ${seed}`, pattern: "modifier" as const })),
  ];
}

const MAX_SUGGESTION_WORDS = 10;
const MAX_SUGGESTION_LENGTH = 80;

/**
 * Unique, relevant suggestions not already collected: each must contain every
 * meaningful seed word, so "running shoes" doesn't pull in "running man".
 */
export function selectNewSuggestions(
  seedInput: string,
  suggestions: readonly string[],
  existing: readonly string[],
  limit = 200,
) {
  const seedWords = meaningfulWords(normalizePhrase(seedInput));
  const seen = new Set(existing.map(normalizePhrase));
  const selected: string[] = [];
  for (const raw of suggestions) {
    const suggestion = normalizePhrase(raw);
    if (!suggestion || seen.has(suggestion)) continue;
    if (suggestion.length > MAX_SUGGESTION_LENGTH || suggestion.split(" ").length > MAX_SUGGESTION_WORDS) continue;
    const words = new Set(suggestion.split(" "));
    if (!seedWords.every((word) => words.has(word) || words.has(`${word}s`) || words.has(word.replace(/s$/, "")))) continue;
    seen.add(suggestion);
    selected.push(suggestion);
    if (selected.length === limit) break;
  }
  return selected;
}

const STOPWORDS = new Set(["a", "an", "the", "of", "for", "to", "in", "on", "and", "or", "with", "my", "your"]);

export function normalizePhrase(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function meaningfulWords(phrase: string) {
  return phrase.split(" ").filter((word) => word.length > 0 && !STOPWORDS.has(word));
}
