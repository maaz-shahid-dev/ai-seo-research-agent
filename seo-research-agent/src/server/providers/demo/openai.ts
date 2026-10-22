import "server-only";

import type { OpenAiAnalysisClient } from "@/server/providers/openai/analysis";
import type { ResearchEvidence } from "@/server/providers/types";

import { hashString } from "./random";

/**
 * An OpenAI stand-in for demos: builds the AI summary from the supplied
 * keyword evidence (citing only real evidence IDs) and rotates through a
 * curated list of safe micro-niche ideas. Never used unless DEMO_DATA=true.
 */

/** Curated, safe micro niches across every niche type; rotated daily. */
const NICHE_IDEAS = [
  ["Betta fish tank setup", "betta fish tank setup", "New owners struggle with cloudy water and fin rot in small tanks.", "first-time betta owners", "info"],
  ["Sourdough starter rescue", "sourdough starter problems", "Starters go flat, smell odd or grow mould and people don't know why.", "home bakers", "info"],
  ["Houseplant pest control", "fungus gnats in houseplants", "Gnats and mealybugs spread fast through indoor plants.", "apartment plant lovers", "info"],
  ["Cast iron care", "cast iron skillet rust removal", "Rusty or sticky pans after the wrong cleaning method.", "home cooks", "info"],
  ["Leopard gecko shedding help", "leopard gecko stuck shed", "Stuck shed on toes and tails worries owners.", "reptile keepers", "info"],
  ["Dog crate training", "puppy crying in crate at night", "Sleepless nights with a new puppy.", "new dog owners", "info"],
  ["Robot vacuums for pet hair", "best robot vacuum for pet hair", "Pet owners need vacuums that don't clog on fur.", "pet owners", "affiliate"],
  ["Quiet mechanical keyboards", "quiet mechanical keyboard for office", "Loud keyboards annoy coworkers in shared offices.", "remote and office workers", "affiliate"],
  ["Kayak fishing gear", "best kayak fishing rod holder", "Cluttered kayaks and lost gear on the water.", "weekend anglers", "affiliate"],
  ["Camper van insulation", "best van insulation for cold weather", "Condensation and cold nights in DIY vans.", "van-life builders", "affiliate"],
  ["Pour-over coffee gear", "best pour over coffee maker for beginners", "Bitter cups from the wrong kettle and grinder.", "home coffee fans", "affiliate"],
  ["Ergonomic standing desks", "best standing desk for small spaces", "Back pain from long days at a tiny desk.", "home office workers", "affiliate"],
  ["Running pace calculator", "running pace calculator by mile", "Runners convert pace, time and distance before races.", "runners training for races", "tools"],
  ["Paint quantity calculator", "how much paint do i need calculator", "DIYers buy too much or too little paint.", "home DIYers", "tools"],
  ["Recipe scaler tool", "recipe scaling calculator", "Doubling or halving recipes breaks the ratios.", "home cooks", "tools"],
  ["Aquarium volume calculator", "aquarium gallon calculator", "Fish keepers dose medicine by tank volume.", "aquarium hobbyists", "tools"],
  ["Freelance rate calculator", "freelance hourly rate calculator", "Freelancers underprice their work.", "new freelancers", "tools"],
  ["Plant watering schedule generator", "houseplant watering schedule generator", "People forget which plant needs water when.", "plant parents", "tools"],
  ["Wild Rift beginner guides", "wild rift tips for beginners", "New players lose ranked games learning champions.", "mobile MOBA players", "apps"],
  ["Habit tracker app comparisons", "best habit tracker app for android", "Too many habit apps with confusing features.", "self-improvement fans", "apps"],
  ["Language learning app tips", "duolingo streak tips", "Learners lose streaks and motivation.", "language learners", "apps"],
  ["Budget app setup help", "how to use ynab for beginners", "New users quit budgeting apps in the first week.", "budget beginners", "apps"],
  ["Smart home app troubleshooting", "google home app not working", "Devices drop offline and the app won't connect.", "smart home owners", "apps"],
  ["Photo editing app tutorials", "snapseed editing tutorial", "Mobile photographers can't get a consistent look.", "mobile photographers", "apps"],
  ["AI agents for small business", "ai agents for small business", "Owners want to automate support and admin without coding.", "small business owners", "ai"],
  ["ChatGPT prompts for teachers", "chatgpt prompts for lesson plans", "Teachers spend evenings writing lesson plans.", "school teachers", "ai"],
  ["AI tools for real estate agents", "ai tools for real estate listings", "Agents write the same listing copy every day.", "real estate agents", "ai"],
  ["AI video editing tools", "ai video editor for youtube shorts", "Creators spend hours cutting short videos.", "YouTube creators", "ai"],
  ["AI meeting note takers", "best ai note taker for zoom", "Notes are lost after back-to-back meetings.", "remote teams", "ai"],
  ["Customer support AI agents", "ai chatbot for shopify store", "Small stores can't answer support tickets around the clock.", "ecommerce store owners", "ai"],
  ["CRM for freelancers", "best crm for freelancers", "Freelancers lose leads in spreadsheets.", "freelancers and solopreneurs", "saas"],
  ["Scheduling software for salons", "salon booking software", "No-shows and double bookings cost salons money.", "salon owners", "saas"],
  ["Invoicing tools for contractors", "invoicing software for contractors", "Late invoices delay contractor payments.", "trade contractors", "saas"],
  ["Project management for agencies", "project management software for small agencies", "Client work slips through email threads.", "small agency owners", "saas"],
  ["Email marketing for Etsy sellers", "email marketing for etsy sellers", "Sellers can't bring buyers back.", "Etsy sellers", "saas"],
  ["Website builders for therapists", "website builder for therapists", "Therapists need simple, compliant sites.", "private-practice therapists", "saas"],
  ["Mobile dog grooming", "mobile dog grooming near me", "Busy owners want grooming at home.", "dog owners", "local"],
  ["Appliance repair", "dishwasher repair near me", "Broken appliances need fast, trusted repair.", "homeowners", "local"],
  ["Gutter cleaning services", "gutter cleaning cost near me", "Homeowners don't know fair gutter cleaning prices.", "homeowners", "local"],
  ["Mobile car detailing", "mobile car detailing near me", "Car owners want detailing without leaving work.", "car owners", "local"],
  ["Junk removal services", "junk removal cost near me", "Moving out leaves furniture to get rid of.", "renters moving home", "local"],
  ["Piano lessons for adults", "adult piano lessons near me", "Adults feel awkward in kids' music schools.", "adult beginners", "local"],
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
      const fresh = NICHE_IDEAS.filter(([, seed]) => !avoid.has(seed));
      const pool = fresh.length >= request.count ? fresh : NICHE_IDEAS;
      // Round-robin across niche types so each day covers every category,
      // starting at a date-dependent position inside each type.
      const byType = new Map<string, (typeof NICHE_IDEAS)[number][]>();
      for (const idea of pool) byType.set(idea[4], [...(byType.get(idea[4]) ?? []), idea]);
      const offset = hashString(request.date);
      const queues = [...byType.values()].map((ideas) => [...ideas.slice(offset % ideas.length), ...ideas.slice(0, offset % ideas.length)]);
      const picked: (typeof NICHE_IDEAS)[number][] = [];
      for (let round = 0; picked.length < request.count && queues.some((queue) => queue.length > round); round += 1) {
        for (const queue of queues) if (queue[round] && picked.length < request.count) picked.push(queue[round]!);
      }
      return { ideas: picked.map(([niche, seedKeyword, problem, audience, nicheType]) => ({ niche, seedKeyword, problem, audience, nicheType })) };
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
