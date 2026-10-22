import { z } from "zod";

const nullableNonnegativeNumber = z.number().finite().nonnegative().nullable().optional();
const nullableNonnegativeInteger = z.number().int().nonnegative().nullable().optional();
const nullableString = z.string().nullable().optional();

const monthlySearchSchema = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    search_volume: nullableNonnegativeInteger,
  })
  .passthrough();

const keywordIdeaItemSchema = z
  .object({
    keyword: z.string().trim().min(1),
    keyword_info: z
      .object({
        search_volume: nullableNonnegativeInteger,
        cpc: nullableNonnegativeNumber,
        competition: z.number().finite().min(0).max(1).nullable().optional(),
        competition_level: nullableString,
        monthly_searches: z.array(monthlySearchSchema).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    keyword_properties: z
      .object({
        keyword_difficulty: z.number().int().min(0).max(100).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    search_intent_info: z
      .object({
        main_intent: nullableString,
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const keywordIdeasResultSchema = z
  .object({
    total_count: nullableNonnegativeInteger,
    items: z.array(keywordIdeaItemSchema).nullable().optional(),
  })
  .passthrough();

const organicItemSchema = z
  .object({
    type: z.string(),
    rank_group: nullableNonnegativeInteger,
    rank_absolute: nullableNonnegativeInteger,
    title: nullableString,
    description: nullableString,
    url: nullableString,
    domain: nullableString,
  })
  .passthrough();

export const organicSerpResultSchema = z
  .object({
    keyword: z.string().trim().min(1),
    datetime: nullableString,
    item_types: z.array(z.string()).nullable().optional(),
    se_results_count: nullableNonnegativeInteger,
    items: z.array(organicItemSchema).nullable().optional(),
  })
  .passthrough();

function taskSchema<Result extends z.ZodType>(resultSchema: Result) {
  return z
    .object({
      id: z.string().min(1),
      status_code: z.number().int(),
      status_message: z.string(),
      cost: nullableNonnegativeNumber,
      result_count: z.number().int().nonnegative().optional(),
      result: z.array(resultSchema).nullable().optional(),
    })
    .passthrough();
}

function envelopeSchema<Task extends z.ZodType>(task: Task) {
  return z
    .object({
      status_code: z.number().int(),
      status_message: z.string(),
      tasks_count: z.number().int().nonnegative(),
      tasks_error: z.number().int().nonnegative(),
      tasks: z.array(task).max(1).nullable(),
    })
    .passthrough();
}

export const keywordIdeasResponseSchema = envelopeSchema(taskSchema(z.unknown()));
export const organicSerpResponseSchema = envelopeSchema(taskSchema(z.unknown()));

const domainRankItemSchema = z
  .object({ target: z.string(), rank: nullableNonnegativeNumber })
  .passthrough();

export const domainRanksResultSchema = z
  .object({ items: z.array(domainRankItemSchema).nullable().optional() })
  .passthrough();

const whoisItemSchema = z
  .object({
    domain: z.string(),
    created_datetime: nullableString,
    metrics: z
      .object({
        organic: z
          .object({ etv: nullableNonnegativeNumber, count: nullableNonnegativeInteger })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    backlinks_info: z
      .object({
        backlinks: nullableNonnegativeInteger,
        referring_domains: nullableNonnegativeInteger,
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const whoisOverviewResultSchema = z
  .object({ items: z.array(whoisItemSchema).nullable().optional() })
  .passthrough();

const intersectionItemSchema = z
  .object({
    keyword_data: z
      .object({
        keyword: z.string().trim().min(1),
        keyword_info: z
          .object({ search_volume: nullableNonnegativeInteger, cpc: nullableNonnegativeNumber })
          .passthrough()
          .nullable()
          .optional(),
        keyword_properties: z
          .object({ keyword_difficulty: z.number().int().min(0).max(100).nullable().optional() })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough(),
    first_domain_serp_element: z
      .object({ rank_group: nullableNonnegativeInteger })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const domainIntersectionResultSchema = z
  .object({ items: z.array(intersectionItemSchema).nullable().optional() })
  .passthrough();

export const genericResponseSchema = envelopeSchema(taskSchema(z.unknown()));

const autocompleteItemSchema = z
  .object({ type: z.string(), suggestion: nullableString })
  .passthrough();

export const autocompleteResultSchema = z
  .object({ items: z.array(autocompleteItemSchema).nullable().optional() })
  .passthrough();

/** Keyword overview items share the keyword-ideas item shape. */
export const keywordOverviewResultSchema = keywordIdeasResultSchema;
