import "server-only";

import type { OpenAiAnalysisClient } from "@/server/providers/openai/analysis";
import type { ResearchEvidence } from "@/server/providers/types";

import { hashString } from "./random";

/**
 * An OpenAI stand-in for demos: builds the AI summary from the supplied
 * keyword evidence (citing only real evidence IDs) and rotates through a
 * curated list of safe micro-niche ideas. Never used unless DEMO_DATA=true.
 */

const NICHE_IDEAS = [
  ["Betta fish tank setup", "betta fish tank setup", "New owners struggle with cloudy water and fin rot in small tanks.", "first-time betta owners"],
  ["Sourdough starter rescue", "sourdough starter problems", "Starters go flat, smell odd or grow mould and people don't know why.", "home bakers"],
  ["Houseplant pest control", "fungus gnats in houseplants", "Gnats and mealybugs spread fast through indoor plants.", "apartment plant lovers"],
  ["Cast iron care", "cast iron skillet rust removal", "Rusty or sticky pans after the wrong cleaning method.", "home cooks"],
  ["Small balcony gardening", "balcony vegetable garden ideas", "Little space and wind make growing food hard.", "city renters"],
  ["Leopard gecko shedding help", "leopard gecko stuck shed", "Stuck shed on toes and tails worries owners.", "reptile keepers"],
  ["Bearded dragon habitat", "bearded dragon tank setup", "Wrong heat and UVB setups make lizards sick.", "new reptile owners"],
  ["Pour-over coffee basics", "pour over coffee ratio", "Bitter or sour cups from the wrong grind and ratio.", "home coffee fans"],
  ["Mechanical keyboard switches", "quiet mechanical keyboard switches", "Loud keyboards annoy roommates and coworkers.", "remote workers"],
  ["Hydroponic herbs indoors", "hydroponic basil not growing", "Leggy, pale herbs in countertop systems.", "indoor gardeners"],
  ["Dog crate training", "puppy crying in crate at night", "Sleepless nights with a new puppy.", "new dog owners"],
  ["Kayak fishing setup", "kayak fishing rod holder ideas", "Cluttered kayaks and lost gear on the water.", "weekend anglers"],
  ["Beginner embroidery", "embroidery stitches for beginners", "Puckered fabric and messy backs on first projects.", "craft beginners"],
  ["Camper van insulation", "van insulation for cold weather", "Condensation and cold nights in DIY vans.", "van-life builders"],
  ["Toddler picky eating", "toddler meal ideas for picky eaters", "Daily mealtime battles with fussy toddlers.", "busy parents"],
  ["Electric bike maintenance", "ebike chain maintenance", "Squeaky, worn chains on heavier e-bikes.", "e-bike commuters"],
  ["Succulent care", "overwatered succulent signs", "Mushy leaves from too much water.", "plant beginners"],
  ["Home espresso dialing in", "espresso shot too fast", "Watery shots from new home machines.", "home baristas"],
  ["Woodworking for small shops", "small woodworking shop layout", "Tools crammed into a garage corner.", "hobby woodworkers"],
  ["Cat litter odor control", "best way to control litter box smell", "Litter smell in small apartments.", "cat owners"],
  ["Backyard chicken coops", "chicken coop ventilation ideas", "Damp coops and sick hens in winter.", "backyard chicken keepers"],
  ["Resin art troubleshooting", "epoxy resin bubbles fix", "Bubbles and sticky cures ruin pieces.", "resin artists"],
  ["Aquascaping on a budget", "low tech planted tank ideas", "Algae takes over planted tanks without CO2.", "aquarium hobbyists"],
  ["Film photography basics", "35mm film camera for beginners", "Choosing a first film camera and stock.", "photography beginners"],
] as const;

export function createDemoOpenAiClient(): OpenAiAnalysisClient {
  return {
    async analyze(request) {
      const evidence = [...request.evidence];
      const byVolume = [...evidence].sort((a, b) => factorNumber(b, "Monthly searches") - factorNumber(a, "Monthly searches"));
      const easy = [...evidence]
        .filter((item) => factorNumber(item, "Keyword difficulty") > 0)
        .sort((a, b) => factorNumber(a, "Keyword difficulty") - factorNumber(b, "Keyword difficulty"));
      const top = byVolume[0]!;
      const easiest = easy.slice(0, 3);
      const hardest = [...easy].reverse().slice(0, 2);
      const cite = (items: ResearchEvidence[]) => items.slice(0, 3).map((item) => item.id);
      const label = (item: ResearchEvidence) => `“${item.label}”`;

      return {
        responseId: `demo-${hashString(request.seedKeyword)}`,
        model: "demo-analysis",
        analysis: {
          summary: {
            statement: `${capitalize(request.seedKeyword)} has steady demand led by ${label(top)}. Head terms are competitive, but lower-difficulty long-tail topics such as ${easiest.map(label).join(", ") || label(top)} are realistic first targets for a new site.`,
            citationIds: cite([top, ...easiest]),
          },
          opportunitySignals: easiest.map((item) => ({
            statement: `${label(item)} combines useful demand with difficulty ${factorNumber(item, "Keyword difficulty")}.`,
            citationIds: [item.id],
          })),
          risks: hardest.map((item) => ({
            statement: `${label(item)} has difficulty ${factorNumber(item, "Keyword difficulty")} and is likely dominated by established sites.`,
            citationIds: [item.id],
          })),
          missingEvidence: ["Demo data: connect DataForSEO and OpenAI for live analysis."],
          nextSteps: [
            { statement: `Publish a beginner-friendly pillar guide around ${label(top)}.`, citationIds: [top.id] },
            ...easiest.slice(0, 2).map((item) => ({ statement: `Write a focused article for ${label(item)} and link it from the pillar.`, citationIds: [item.id] })),
          ],
        },
      };
    },

    async generateNicheIdeas(request) {
      const avoid = new Set((request.avoid ?? []).map((seed) => seed.toLowerCase()));
      const offset = hashString(request.date) % NICHE_IDEAS.length;
      const rotated = [...NICHE_IDEAS.slice(offset), ...NICHE_IDEAS.slice(0, offset)];
      const ideas = rotated
        .filter(([, seed]) => !avoid.has(seed))
        .slice(0, request.count)
        .map(([niche, seedKeyword, problem, audience]) => ({ niche, seedKeyword, problem, audience }));
      return { ideas: ideas.length > 0 ? ideas : rotated.slice(0, request.count).map(([niche, seedKeyword, problem, audience]) => ({ niche, seedKeyword, problem, audience })) };
    },
  };
}

function factorNumber(item: ResearchEvidence, label: string) {
  const fact = item.facts.find((entry) => entry.label === label);
  const value = fact ? Number(fact.value.replace(/[^0-9.]/g, "")) : 0;
  return Number.isFinite(value) ? value : 0;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
