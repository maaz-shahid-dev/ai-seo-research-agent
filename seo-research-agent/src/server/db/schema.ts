import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "disabled"]);
export const projectStatus = pgEnum("project_status", ["active", "archived"]);
export const researchRunStatus = pgEnum("research_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const researchDevice = pgEnum("research_device", ["desktop", "mobile"]);
export const keywordSource = pgEnum("keyword_source", [
  "seed",
  "related",
  "autocomplete",
  "competitor",
]);
export const searchIntent = pgEnum("search_intent", [
  "informational",
  "navigational",
  "commercial",
  "transactional",
  "unknown",
]);
export const serpResultType = pgEnum("serp_result_type", [
  "organic",
  "paid",
  "featured_snippet",
  "people_also_ask",
  "local_pack",
  "video",
  "image",
  "news",
  "other",
]);
export const analysisType = pgEnum("analysis_type", [
  "intent",
  "serp_summary",
  "content_gap",
  "niche",
  "report",
]);
export const analysisStatus = pgEnum("analysis_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);
export const reportFormat = pgEnum("report_format", ["dashboard", "csv", "json"]);
export const providerRequestStatus = pgEnum("provider_request_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export const usageMetric = pgEnum("usage_metric", [
  "requests",
  "keywords",
  "tokens",
  "cost_micros",
]);
export const outboxStatus = pgEnum("outbox_status", [
  "pending",
  "processing",
  "published",
  "failed",
  "dead",
]);

type TrendPoint = {
  month: string;
  volume: number;
};

type ResearchConfiguration = {
  keywordLimit: number;
};

type SerpFeature = {
  name: string;
  value?: string;
};

type AiAnalysisOutput = Record<string, unknown>;
type ReportSnapshot = Record<string, unknown>;
type SafeProviderMetadata = Record<string, string | number | boolean | null>;
type OutboxPayload = Record<string, unknown>;
type AuditMetadata = Record<string, string | number | boolean | null>;

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").default("user").notNull(),
    status: userStatus("status").default("active").notNull(),
    sessionVersion: integer("session_version").default(0).notNull(),
    failedAuthAttempts: smallint("failed_auth_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_status_created_idx").on(table.status, table.createdAt),
    check("users_email_normalized_check", sql`${table.email} = lower(btrim(${table.email}))`),
    check("users_email_shape_check", sql`${table.email} like '%_@_%._%'`),
    check("users_display_name_not_blank_check", sql`char_length(btrim(${table.displayName})) > 0`),
    check(
      "users_password_hash_argon2id_check",
      sql`char_length(${table.passwordHash}) >= 32 and ${table.passwordHash} like '$argon2id$%'`,
    ),
    check("users_session_version_check", sql`${table.sessionVersion} >= 0`),
    check(
      "users_failed_auth_attempts_check",
      sql`${table.failedAuthAttempts} between 0 and 100`,
    ),
    check("users_updated_after_created_check", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_expiry_idx").on(table.userId, table.expiresAt),
    check("password_reset_tokens_hash_check", sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
    check("password_reset_tokens_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      "password_reset_tokens_used_after_created_check",
      sql`${table.usedAt} is null or ${table.usedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    targetDomain: varchar("target_domain", { length: 253 }),
    description: varchar("description", { length: 500 }),
    defaultCountryCode: varchar("default_country_code", { length: 2 }).default("US").notNull(),
    defaultLanguageCode: varchar("default_language_code", { length: 35 }).default("en").notNull(),
    status: projectStatus("status").default("active").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("projects_id_owner_unique").on(table.id, table.ownerId),
    uniqueIndex("projects_owner_name_unique").on(table.ownerId, sql`lower(btrim(${table.name}))`),
    index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt, table.id),
    index("projects_owner_status_updated_idx").on(
      table.ownerId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    check("projects_name_not_blank_check", sql`char_length(btrim(${table.name})) > 0`),
    check(
      "projects_domain_normalized_check",
      sql`${table.targetDomain} is null or (${table.targetDomain} = lower(btrim(${table.targetDomain})) and char_length(${table.targetDomain}) > 0)`,
    ),
    check(
      "projects_country_code_check",
      sql`${table.defaultCountryCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "projects_language_code_check",
      sql`${table.defaultLanguageCode} ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),
    check("projects_version_check", sql`${table.version} > 0`),
    check("projects_updated_after_created_check", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

export const researchRuns = pgTable(
  "research_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    projectId: uuid("project_id").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    query: varchar("query", { length: 500 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    languageCode: varchar("language_code", { length: 35 }).notNull(),
    device: researchDevice("device").default("desktop").notNull(),
    configuration: jsonb("configuration").$type<ResearchConfiguration>().notNull(),
    status: researchRunStatus("status").default("queued").notNull(),
    version: integer("version").default(1).notNull(),
    progress: smallint("progress").default(0).notNull(),
    keywordCount: integer("keyword_count").default(0).notNull(),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: varchar("error_message", { length: 500 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    leaseOwner: varchar("lease_owner", { length: 160 }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "research_runs_project_owner_fk",
      columns: [table.projectId, table.ownerId],
      foreignColumns: [projects.id, projects.ownerId],
    }).onDelete("cascade"),
    unique("research_runs_id_owner_unique").on(table.id, table.ownerId),
    unique("research_runs_id_project_owner_unique").on(
      table.id,
      table.projectId,
      table.ownerId,
    ),
    uniqueIndex("research_runs_owner_idempotency_unique").on(
      table.ownerId,
      table.idempotencyKey,
    ),
    index("research_runs_owner_created_idx").on(table.ownerId, table.createdAt, table.id),
    index("research_runs_project_created_idx").on(table.projectId, table.createdAt, table.id),
    index("research_runs_status_created_idx").on(table.status, table.createdAt),
    check("research_runs_query_not_blank_check", sql`char_length(btrim(${table.query})) > 0`),
    check(
      "research_runs_idempotency_key_check",
      sql`${table.idempotencyKey} ~ '^[A-Za-z0-9._:-]{16,128}$'`,
    ),
    check("research_runs_request_hash_check", sql`${table.requestHash} ~ '^[a-f0-9]{64}$'`),
    check("research_runs_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      "research_runs_language_code_check",
      sql`${table.languageCode} ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),
    check("research_runs_progress_check", sql`${table.progress} between 0 and 100`),
    check("research_runs_version_check", sql`${table.version} > 0`),
    check("research_runs_keyword_count_check", sql`${table.keywordCount} >= 0`),
    check(
      "research_runs_configuration_object_check",
      sql`jsonb_typeof(${table.configuration}) = 'object'`,
    ),
    check(
      "research_runs_started_after_created_check",
      sql`${table.startedAt} is null or ${table.startedAt} >= ${table.createdAt}`,
    ),
    check(
      "research_runs_finished_after_started_check",
      sql`${table.finishedAt} is null or ${table.finishedAt} >= coalesce(${table.startedAt}, ${table.createdAt})`,
    ),
    check(
      "research_runs_terminal_state_check",
      sql`((${table.status} in ('completed', 'failed', 'cancelled')) = (${table.finishedAt} is not null))`,
    ),
    check(
      "research_runs_lease_pair_check",
      sql`(${table.leaseOwner} is null) = (${table.leaseExpiresAt} is null)`,
    ),
    check("research_runs_updated_after_created_check", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

export const keywordResults = pgTable(
  "keyword_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    runId: uuid("run_id").notNull(),
    keyword: varchar("keyword", { length: 500 }).notNull(),
    normalizedKeyword: varchar("normalized_keyword", { length: 500 }).notNull(),
    source: keywordSource("source").notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerRequestId: varchar("provider_request_id", { length: 200 }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    intent: searchIntent("intent").default("unknown").notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    languageCode: varchar("language_code", { length: 35 }).notNull(),
    searchVolume: integer("search_volume"),
    cpcMicros: bigint("cpc_micros", { mode: "number" }),
    competition: numeric("competition", { precision: 5, scale: 4 }),
    difficulty: smallint("difficulty"),
    trend: jsonb("trend").$type<TrendPoint[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "keyword_results_run_owner_fk",
      columns: [table.runId, table.ownerId],
      foreignColumns: [researchRuns.id, researchRuns.ownerId],
    }).onDelete("cascade"),
    unique("keyword_results_id_run_owner_unique").on(table.id, table.runId, table.ownerId),
    unique("keyword_results_id_owner_unique").on(table.id, table.ownerId),
    uniqueIndex("keyword_results_run_keyword_market_unique").on(
      table.runId,
      table.normalizedKeyword,
      table.countryCode,
      table.languageCode,
    ),
    index("keyword_results_owner_run_id_idx").on(table.ownerId, table.runId, table.id),
    index("keyword_results_run_volume_idx").on(table.runId, table.searchVolume),
    index("keyword_results_run_difficulty_idx").on(table.runId, table.difficulty),
    check("keyword_results_keyword_not_blank_check", sql`char_length(btrim(${table.keyword})) > 0`),
    check("keyword_results_provider_not_blank_check", sql`char_length(btrim(${table.provider})) > 0`),
    check(
      "keyword_results_normalized_keyword_check",
      sql`${table.normalizedKeyword} = lower(btrim(${table.normalizedKeyword})) and char_length(${table.normalizedKeyword}) > 0`,
    ),
    check("keyword_results_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      "keyword_results_language_code_check",
      sql`${table.languageCode} ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),
    check(
      "keyword_results_search_volume_check",
      sql`${table.searchVolume} is null or ${table.searchVolume} >= 0`,
    ),
    check("keyword_results_cpc_check", sql`${table.cpcMicros} is null or ${table.cpcMicros} >= 0`),
    check(
      "keyword_results_competition_check",
      sql`${table.competition} is null or ${table.competition} between 0 and 1`,
    ),
    check(
      "keyword_results_difficulty_check",
      sql`${table.difficulty} is null or ${table.difficulty} between 0 and 100`,
    ),
    check(
      "keyword_results_trend_array_check",
      sql`${table.trend} is null or jsonb_typeof(${table.trend}) = 'array'`,
    ),
  ],
);

export const serpSnapshots = pgTable(
  "serp_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    runId: uuid("run_id").notNull(),
    keywordResultId: bigint("keyword_result_id", { mode: "number" }),
    keyword: varchar("keyword", { length: 500 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    languageCode: varchar("language_code", { length: 35 }).notNull(),
    device: researchDevice("device").notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerRequestId: varchar("provider_request_id", { length: 160 }),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      name: "serp_snapshots_run_owner_fk",
      columns: [table.runId, table.ownerId],
      foreignColumns: [researchRuns.id, researchRuns.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "serp_snapshots_keyword_run_owner_fk",
      columns: [table.keywordResultId, table.runId, table.ownerId],
      foreignColumns: [keywordResults.id, keywordResults.runId, keywordResults.ownerId],
    }).onDelete("cascade"),
    unique("serp_snapshots_id_owner_unique").on(table.id, table.ownerId),
    unique("serp_snapshots_id_run_owner_unique").on(table.id, table.runId, table.ownerId),
    uniqueIndex("serp_snapshots_run_market_hash_unique").on(
      table.runId,
      table.countryCode,
      table.languageCode,
      table.device,
      table.contentHash,
    ),
    index("serp_snapshots_owner_run_fetched_idx").on(table.ownerId, table.runId, table.fetchedAt),
    index("serp_snapshots_keyword_run_owner_idx").on(
      table.keywordResultId,
      table.runId,
      table.ownerId,
    ),
    index("serp_snapshots_expiry_idx").on(table.expiresAt),
    check("serp_snapshots_keyword_not_blank_check", sql`char_length(btrim(${table.keyword})) > 0`),
    check("serp_snapshots_provider_not_blank_check", sql`char_length(btrim(${table.provider})) > 0`),
    check("serp_snapshots_hash_check", sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
    check("serp_snapshots_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      "serp_snapshots_language_code_check",
      sql`${table.languageCode} ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),
    check("serp_snapshots_expiry_check", sql`${table.expiresAt} > ${table.fetchedAt}`),
  ],
);

export const serpResults = pgTable(
  "serp_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    runId: uuid("run_id").notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    rank: smallint("rank").notNull(),
    page: smallint("page").default(1).notNull(),
    resultType: serpResultType("result_type").notNull(),
    title: varchar("title", { length: 500 }),
    url: text("url"),
    domain: varchar("domain", { length: 253 }),
    description: text("description"),
    isTargetDomain: boolean("is_target_domain").default(false).notNull(),
    features: jsonb("features").$type<SerpFeature[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "serp_results_snapshot_owner_fk",
      columns: [table.snapshotId, table.runId, table.ownerId],
      foreignColumns: [serpSnapshots.id, serpSnapshots.runId, serpSnapshots.ownerId],
    }).onDelete("cascade"),
    uniqueIndex("serp_results_snapshot_type_rank_unique").on(
      table.snapshotId,
      table.resultType,
      table.page,
      table.rank,
    ),
    unique("serp_results_id_owner_unique").on(table.id, table.ownerId),
    unique("serp_results_id_run_owner_unique").on(table.id, table.runId, table.ownerId),
    index("serp_results_owner_snapshot_rank_idx").on(table.ownerId, table.snapshotId, table.rank),
    index("serp_results_domain_idx").on(table.domain),
    check("serp_results_rank_check", sql`${table.rank} > 0`),
    check("serp_results_page_check", sql`${table.page} > 0`),
    check("serp_results_features_array_check", sql`jsonb_typeof(${table.features}) = 'array'`),
    check(
      "serp_results_content_check",
      sql`${table.title} is not null or ${table.url} is not null or jsonb_array_length(${table.features}) > 0`,
    ),
    check(
      "serp_results_domain_normalized_check",
      sql`${table.domain} is null or ${table.domain} = lower(btrim(${table.domain}))`,
    ),
  ],
);

export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    runId: uuid("run_id").notNull(),
    type: analysisType("type").notNull(),
    status: analysisStatus("status").default("queued").notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    promptVersion: varchar("prompt_version", { length: 40 }).notNull(),
    schemaVersion: smallint("schema_version").default(1).notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    version: integer("version").default(1).notNull(),
    leaseOwner: varchar("lease_owner", { length: 160 }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    summary: text("summary"),
    output: jsonb("output").$type<AiAnalysisOutput>(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: varchar("error_message", { length: 500 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_analyses_run_owner_fk",
      columns: [table.runId, table.ownerId],
      foreignColumns: [researchRuns.id, researchRuns.ownerId],
    }).onDelete("cascade"),
    unique("ai_analyses_id_owner_unique").on(table.id, table.ownerId),
    unique("ai_analyses_id_run_owner_unique").on(table.id, table.runId, table.ownerId),
    uniqueIndex("ai_analyses_run_type_input_model_version_unique").on(
      table.runId,
      table.type,
      table.inputHash,
      table.model,
      table.promptVersion,
    ),
    index("ai_analyses_owner_run_created_idx").on(table.ownerId, table.runId, table.createdAt),
    index("ai_analyses_status_created_idx").on(table.status, table.createdAt),
    index("ai_analyses_status_lease_idx")
      .on(table.status, table.leaseExpiresAt)
      .where(sql`${table.status} in ('queued', 'running')`),
    check("ai_analyses_provider_not_blank_check", sql`char_length(btrim(${table.provider})) > 0`),
    check("ai_analyses_model_not_blank_check", sql`char_length(btrim(${table.model})) > 0`),
    check("ai_analyses_hash_check", sql`${table.inputHash} ~ '^[a-f0-9]{64}$'`),
    check("ai_analyses_schema_version_check", sql`${table.schemaVersion} > 0`),
    check("ai_analyses_version_check", sql`${table.version} > 0`),
    check(
      "ai_analyses_lease_state_check",
      sql`(${table.status} = 'running') = (${table.leaseOwner} is not null and ${table.leaseExpiresAt} is not null)`,
    ),
    check(
      "ai_analyses_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} between 0 and 1`,
    ),
    check("ai_analyses_input_tokens_check", sql`${table.inputTokens} is null or ${table.inputTokens} >= 0`),
    check("ai_analyses_output_tokens_check", sql`${table.outputTokens} is null or ${table.outputTokens} >= 0`),
    check("ai_analyses_latency_check", sql`${table.latencyMs} is null or ${table.latencyMs} >= 0`),
    check(
      "ai_analyses_terminal_state_check",
      sql`((${table.status} in ('completed', 'failed')) = (${table.finishedAt} is not null))`,
    ),
    check(
      "ai_analyses_completed_output_check",
      sql`${table.status} <> 'completed' or (${table.output} is not null and jsonb_typeof(${table.output}) = 'object')`,
    ),
    check(
      "ai_analyses_finished_after_started_check",
      sql`${table.finishedAt} is null or ${table.finishedAt} >= coalesce(${table.startedAt}, ${table.createdAt})`,
    ),
  ],
);

export const aiCitations = pgTable(
  "ai_citations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    runId: uuid("run_id").notNull(),
    analysisId: uuid("analysis_id").notNull(),
    keywordResultId: bigint("keyword_result_id", { mode: "number" }),
    serpResultId: bigint("serp_result_id", { mode: "number" }),
    position: smallint("position").notNull(),
    url: text("url"),
    title: varchar("title", { length: 500 }),
    excerpt: varchar("excerpt", { length: 1000 }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_citations_analysis_owner_fk",
      columns: [table.analysisId, table.runId, table.ownerId],
      foreignColumns: [aiAnalyses.id, aiAnalyses.runId, aiAnalyses.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_citations_keyword_run_owner_fk",
      columns: [table.keywordResultId, table.runId, table.ownerId],
      foreignColumns: [keywordResults.id, keywordResults.runId, keywordResults.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_citations_serp_result_run_owner_fk",
      columns: [table.serpResultId, table.runId, table.ownerId],
      foreignColumns: [serpResults.id, serpResults.runId, serpResults.ownerId],
    }).onDelete("cascade"),
    uniqueIndex("ai_citations_analysis_position_unique").on(table.analysisId, table.position),
    index("ai_citations_owner_analysis_idx").on(table.ownerId, table.analysisId),
    index("ai_citations_keyword_run_owner_idx").on(
      table.keywordResultId,
      table.runId,
      table.ownerId,
    ),
    index("ai_citations_serp_result_run_owner_idx").on(
      table.serpResultId,
      table.runId,
      table.ownerId,
    ),
    check("ai_citations_position_check", sql`${table.position} > 0`),
    check(
      "ai_citations_evidence_target_check",
      sql`${table.keywordResultId} is not null or ${table.serpResultId} is not null`,
    ),
    check(
      "ai_citations_url_not_blank_check",
      sql`${table.url} is null or char_length(btrim(${table.url})) > 0`,
    ),
  ],
);

export const savedReports = pgTable(
  "saved_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    runId: uuid("run_id").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    format: reportFormat("format").default("dashboard").notNull(),
    snapshot: jsonb("snapshot").$type<ReportSnapshot>().notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "saved_reports_run_project_owner_fk",
      columns: [table.runId, table.projectId, table.ownerId],
      foreignColumns: [researchRuns.id, researchRuns.projectId, researchRuns.ownerId],
    }).onDelete("cascade"),
    uniqueIndex("saved_reports_owner_project_name_unique").on(
      table.ownerId,
      table.projectId,
      sql`lower(btrim(${table.name}))`,
    ),
    index("saved_reports_owner_updated_idx").on(table.ownerId, table.updatedAt),
    index("saved_reports_project_created_idx").on(table.projectId, table.createdAt),
    index("saved_reports_run_project_owner_idx").on(
      table.runId,
      table.projectId,
      table.ownerId,
    ),
    check("saved_reports_name_not_blank_check", sql`char_length(btrim(${table.name})) > 0`),
    check("saved_reports_snapshot_object_check", sql`jsonb_typeof(${table.snapshot}) = 'object'`),
    check("saved_reports_version_check", sql`${table.version} > 0`),
    check("saved_reports_updated_after_created_check", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

export const providerRequests = pgTable(
  "provider_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    runId: uuid("run_id"),
    provider: varchar("provider", { length: 80 }).notNull(),
    operation: varchar("operation", { length: 120 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    externalRequestId: varchar("external_request_id", { length: 200 }),
    status: providerRequestStatus("status").default("queued").notNull(),
    attempts: smallint("attempts").default(0).notNull(),
    responseStatus: smallint("response_status"),
    requestMetadata: jsonb("request_metadata").$type<SafeProviderMetadata>().default({}).notNull(),
    responseMetadata: jsonb("response_metadata").$type<SafeProviderMetadata>(),
    costMicros: bigint("cost_micros", { mode: "number" }).default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "provider_requests_run_owner_fk",
      columns: [table.runId, table.ownerId],
      foreignColumns: [researchRuns.id, researchRuns.ownerId],
    }).onDelete("cascade"),
    uniqueIndex("provider_requests_owner_provider_idempotency_unique").on(
      table.ownerId,
      table.provider,
      table.idempotencyKey,
    ),
    index("provider_requests_run_created_idx").on(table.runId, table.createdAt),
    index("provider_requests_retry_idx")
      .on(table.status, table.nextRetryAt)
      .where(sql`${table.status} = 'queued'`),
    check("provider_requests_provider_not_blank_check", sql`char_length(btrim(${table.provider})) > 0`),
    check("provider_requests_operation_not_blank_check", sql`char_length(btrim(${table.operation})) > 0`),
    check(
      "provider_requests_idempotency_key_check",
      sql`${table.idempotencyKey} ~ '^[A-Za-z0-9._:-]{16,160}$'`,
    ),
    check("provider_requests_hash_check", sql`${table.requestHash} ~ '^[a-f0-9]{64}$'`),
    check(
      "provider_requests_request_metadata_object_check",
      sql`jsonb_typeof(${table.requestMetadata}) = 'object'`,
    ),
    check(
      "provider_requests_response_metadata_object_check",
      sql`${table.responseMetadata} is null or jsonb_typeof(${table.responseMetadata}) = 'object'`,
    ),
    check("provider_requests_attempts_check", sql`${table.attempts} between 0 and 100`),
    check(
      "provider_requests_response_status_check",
      sql`${table.responseStatus} is null or ${table.responseStatus} between 100 and 599`,
    ),
    check("provider_requests_cost_check", sql`${table.costMicros} >= 0`),
    check(
      "provider_requests_terminal_state_check",
      sql`((${table.status} in ('succeeded', 'failed')) = (${table.finishedAt} is not null))`,
    ),
  ],
);

export const dailyUsage = pgTable(
  "daily_usage",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usageDate: date("usage_date", { mode: "string" }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    metric: usageMetric("metric").notNull(),
    quantity: bigint("quantity", { mode: "number" }).default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("daily_usage_owner_date_provider_metric_unique").on(
      table.ownerId,
      table.usageDate,
      table.provider,
      table.metric,
    ),
    index("daily_usage_date_provider_idx").on(table.usageDate, table.provider),
    check("daily_usage_provider_not_blank_check", sql`char_length(btrim(${table.provider})) > 0`),
    check("daily_usage_quantity_check", sql`${table.quantity} >= 0`),
  ],
);

export const jobOutbox = pgTable(
  "job_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    payload: jsonb("payload").$type<OutboxPayload>().notNull(),
    status: outboxStatus("status").default("pending").notNull(),
    attempts: smallint("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: varchar("locked_by", { length: 160 }),
    lastError: varchar("last_error", { length: 1000 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("job_outbox_owner_event_idempotency_unique").on(
      table.ownerId,
      table.eventType,
      table.idempotencyKey,
    ),
    index("job_outbox_dispatch_idx")
      .on(table.status, table.availableAt, table.createdAt)
      .where(sql`${table.status} in ('pending', 'failed')`),
    index("job_outbox_owner_created_idx").on(table.ownerId, table.createdAt),
    index("job_outbox_stale_lease_idx")
      .on(table.status, table.lockedAt)
      .where(sql`${table.status} = 'processing'`),
    check("job_outbox_aggregate_type_not_blank_check", sql`char_length(btrim(${table.aggregateType})) > 0`),
    check("job_outbox_event_type_not_blank_check", sql`char_length(btrim(${table.eventType})) > 0`),
    check(
      "job_outbox_idempotency_key_check",
      sql`${table.idempotencyKey} ~ '^[A-Za-z0-9._:-]{16,160}$'`,
    ),
    check("job_outbox_payload_object_check", sql`jsonb_typeof(${table.payload}) = 'object'`),
    check("job_outbox_attempts_check", sql`${table.attempts} between 0 and 100`),
    check(
      "job_outbox_lock_pair_check",
      sql`(${table.lockedAt} is null) = (${table.lockedBy} is null)`,
    ),
    check(
      "job_outbox_published_state_check",
      sql`(${table.status} = 'published') = (${table.publishedAt} is not null)`,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    requestId: varchar("request_id", { length: 120 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 500 }),
    metadata: jsonb("metadata").$type<AuditMetadata>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_owner_created_idx").on(table.ownerId, table.createdAt),
    index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
    check("audit_logs_action_not_blank_check", sql`char_length(btrim(${table.action})) > 0`),
    check("audit_logs_entity_type_not_blank_check", sql`char_length(btrim(${table.entityType})) > 0`),
    check("audit_logs_ip_hash_check", sql`${table.ipHash} is null or ${table.ipHash} ~ '^[a-f0-9]{64}$'`),
    check("audit_logs_metadata_object_check", sql`jsonb_typeof(${table.metadata}) = 'object'`),
  ],
);

export const providerMarkets = pgTable(
  "provider_markets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: varchar("provider", { length: 80 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    languageCode: varchar("language_code", { length: 35 }).notNull(),
    locationCode: integer("location_code").notNull(),
    locationName: varchar("location_name", { length: 255 }).notNull(),
    locationType: varchar("location_type", { length: 80 }).notNull(),
    canonicalName: varchar("canonical_name", { length: 500 }).notNull(),
    parentLocationCode: integer("parent_location_code"),
    active: boolean("active").default(true).notNull(),
    providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("provider_markets_provider_location_language_unique").on(
      table.provider,
      table.locationCode,
      table.languageCode,
    ),
    index("provider_markets_lookup_idx").on(
      table.provider,
      table.countryCode,
      table.languageCode,
      table.active,
    ),
    index("provider_markets_name_idx").on(table.provider, table.locationName),
    check("provider_markets_provider_not_blank_check", sql`char_length(btrim(${table.provider})) > 0`),
    check("provider_markets_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      "provider_markets_language_code_check",
      sql`${table.languageCode} ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'`,
    ),
    check("provider_markets_location_code_check", sql`${table.locationCode} > 0`),
    check("provider_markets_location_name_not_blank_check", sql`char_length(btrim(${table.locationName})) > 0`),
    check("provider_markets_location_type_not_blank_check", sql`char_length(btrim(${table.locationType})) > 0`),
    check("provider_markets_canonical_name_not_blank_check", sql`char_length(btrim(${table.canonicalName})) > 0`),
  ],
);

/**
 * Public website metrics shared by every tenant (they describe the open web,
 * not user data), cached so each domain is paid for at most once per TTL.
 */
export const domainMetrics = pgTable(
  "domain_metrics",
  {
    domain: varchar("domain", { length: 253 }).primaryKey(),
    authority: smallint("authority"),
    backlinks: bigint("backlinks", { mode: "number" }),
    referringDomains: integer("referring_domains"),
    monthlyTraffic: bigint("monthly_traffic", { mode: "number" }),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("domain_metrics_expiry_idx").on(table.expiresAt),
    check("domain_metrics_domain_normalized_check", sql`${table.domain} = lower(btrim(${table.domain})) and char_length(${table.domain}) > 0`),
    check("domain_metrics_authority_check", sql`${table.authority} is null or ${table.authority} between 0 and 100`),
    check("domain_metrics_backlinks_check", sql`${table.backlinks} is null or ${table.backlinks} >= 0`),
    check("domain_metrics_referring_domains_check", sql`${table.referringDomains} is null or ${table.referringDomains} >= 0`),
    check("domain_metrics_traffic_check", sql`${table.monthlyTraffic} is null or ${table.monthlyTraffic} >= 0`),
    check("domain_metrics_expiry_check", sql`${table.expiresAt} > ${table.fetchedAt}`),
  ],
);

/** One SERP analysis per keyword: job state plus the computed niche signals. */
export const serpAnalyses = pgTable(
  "serp_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    runId: uuid("run_id").notNull(),
    keywordResultId: bigint("keyword_result_id", { mode: "number" }).notNull(),
    status: analysisStatus("status").default("queued").notNull(),
    snapshotId: uuid("snapshot_id"),
    nicheScore: smallint("niche_score"),
    hasAiOverview: boolean("has_ai_overview"),
    version: integer("version").default(1).notNull(),
    leaseOwner: varchar("lease_owner", { length: 160 }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: varchar("error_message", { length: 500 }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "serp_analyses_keyword_run_owner_fk",
      columns: [table.keywordResultId, table.runId, table.ownerId],
      foreignColumns: [keywordResults.id, keywordResults.runId, keywordResults.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "serp_analyses_snapshot_run_owner_fk",
      columns: [table.snapshotId, table.runId, table.ownerId],
      foreignColumns: [serpSnapshots.id, serpSnapshots.runId, serpSnapshots.ownerId],
    }),
    uniqueIndex("serp_analyses_owner_keyword_unique").on(table.ownerId, table.keywordResultId),
    index("serp_analyses_owner_run_idx").on(table.ownerId, table.runId),
    index("serp_analyses_status_lease_idx")
      .on(table.status, table.leaseExpiresAt)
      .where(sql`${table.status} in ('queued', 'running')`),
    check("serp_analyses_niche_score_check", sql`${table.nicheScore} is null or ${table.nicheScore} between 0 and 100`),
    check("serp_analyses_version_check", sql`${table.version} > 0`),
    check(
      "serp_analyses_lease_state_check",
      sql`(${table.status} = 'running') = (${table.leaseOwner} is not null and ${table.leaseExpiresAt} is not null)`,
    ),
    check(
      "serp_analyses_terminal_state_check",
      sql`((${table.status} in ('completed', 'failed')) = (${table.finishedAt} is not null))`,
    ),
    check(
      "serp_analyses_completed_snapshot_check",
      sql`${table.status} <> 'completed' or ${table.snapshotId} is not null`,
    ),
  ],
);

type ContentGapKeyword = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpcMicros: number | null;
  competitorDomain: string;
  competitorRank: number;
};

/** Keywords competitors rank for that the project's website does not. */
export const contentGapReports = pgTable(
  "content_gap_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    runId: uuid("run_id").notNull(),
    targetDomain: varchar("target_domain", { length: 253 }).notNull(),
    status: analysisStatus("status").default("queued").notNull(),
    competitors: jsonb("competitors").$type<string[]>().default([]).notNull(),
    keywords: jsonb("keywords").$type<ContentGapKeyword[]>().default([]).notNull(),
    version: integer("version").default(1).notNull(),
    leaseOwner: varchar("lease_owner", { length: 160 }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: varchar("error_message", { length: 500 }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "content_gap_reports_run_owner_fk",
      columns: [table.runId, table.ownerId],
      foreignColumns: [researchRuns.id, researchRuns.ownerId],
    }).onDelete("cascade"),
    uniqueIndex("content_gap_reports_owner_run_domain_unique").on(table.ownerId, table.runId, table.targetDomain),
    index("content_gap_reports_status_lease_idx")
      .on(table.status, table.leaseExpiresAt)
      .where(sql`${table.status} in ('queued', 'running')`),
    check(
      "content_gap_reports_domain_normalized_check",
      sql`${table.targetDomain} = lower(btrim(${table.targetDomain})) and char_length(${table.targetDomain}) > 0`,
    ),
    check("content_gap_reports_competitors_array_check", sql`jsonb_typeof(${table.competitors}) = 'array'`),
    check("content_gap_reports_keywords_array_check", sql`jsonb_typeof(${table.keywords}) = 'array'`),
    check("content_gap_reports_version_check", sql`${table.version} > 0`),
    check(
      "content_gap_reports_lease_state_check",
      sql`(${table.status} = 'running') = (${table.leaseOwner} is not null and ${table.leaseExpiresAt} is not null)`,
    ),
    check(
      "content_gap_reports_terminal_state_check",
      sql`((${table.status} in ('completed', 'failed')) = (${table.finishedAt} is not null))`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ResearchRun = typeof researchRuns.$inferSelect;
export type NewResearchRun = typeof researchRuns.$inferInsert;
export type KeywordResult = typeof keywordResults.$inferSelect;
export type NewKeywordResult = typeof keywordResults.$inferInsert;
export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type NewAiAnalysis = typeof aiAnalyses.$inferInsert;
export type DomainMetrics = typeof domainMetrics.$inferSelect;
export type SerpAnalysis = typeof serpAnalyses.$inferSelect;
export type SerpResult = typeof serpResults.$inferSelect;
export type ContentGapReport = typeof contentGapReports.$inferSelect;
