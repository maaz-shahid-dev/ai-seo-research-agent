/**
 * Niches the iSkills method says to avoid: legally risky, policy-restricted,
 * or "Your Money or Your Life" topics where new sites rarely rank.
 */

export type RestrictedCategory =
  | "gambling" | "adult" | "piracy" | "downloads" | "health" | "finance";

const RULES: ReadonlyArray<{ category: RestrictedCategory; label: string; pattern: RegExp }> = [
  { category: "gambling", label: "Betting / gambling", pattern: /\b(bet|bets|betting|casino|casinos|gambling|poker|slots?|lottery|sportsbook|jackpot|roulette|blackjack)\b/ },
  { category: "adult", label: "Adult content", pattern: /\b(porn|porno|xxx|nsfw|sex|sexy|nude|nudes|escort|escorts|onlyfans|hentai|erotic)\b/ },
  { category: "piracy", label: "Piracy / cracks", pattern: /\b(crack|cracked|keygen|serial key|license key|warez|torrent|torrents|pirated|piracy|nulled|activator|patch download|mod apk)\b/ },
  { category: "downloads", label: "File / movie / MP3 downloads", pattern: /\b(exe|apk|mp3|mp4|movie|movies|film|films|song|songs|full episode|watch free|free download|download free)\b.*\b(download|downloads|free|online)\b|\b(download|downloads)\b.*\b(exe|apk|mp3|mp4|movie|movies|songs?)\b|\b(123movies|fmovies|putlocker|y2mate)\b/ },
  { category: "health", label: "Health / medical (YMYL)", pattern: /\b(symptoms?|treatment|cure|disease|diabetes|cancer|medication|medicine|dosage|pregnan(t|cy)|diagnosis|therapy|weight loss pills?|supplements?|covid|hiv|depression|anxiety disorder)\b/ },
  { category: "finance", label: "Finance / money (YMYL)", pattern: /\b(loan|loans|credit card|credit score|mortgage|invest|investing|investment|trading|forex|crypto|bitcoin|stocks?|insurance|tax|taxes|debt|payday|retirement|pension)\b/ },
];

/** The first restricted category the text falls into, or null when it's fine. */
export function restrictedNiche(text: string) {
  const normalized = text.toLowerCase();
  const rule = RULES.find(({ pattern }) => pattern.test(normalized));
  return rule ? { category: rule.category, label: rule.label } : null;
}
