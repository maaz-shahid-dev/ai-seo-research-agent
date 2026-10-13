export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';

export type UserRole = 'admin' | 'researcher';

export interface KeywordResult {
  id: string;
  research_run_id: string;
  keyword: string;
  search_volume: number | null;
  keyword_difficulty: number | null; // 0 - 100
  cpc: number | null; // USD
  intent: SearchIntent | null;
  cluster?: string;
  source: string;
  retrieved_at: string;
  trend?: number[]; // 12-month relative interest
}

export interface KeywordCluster {
  id: string;
  name: string;
  keywordsCount: number;
  totalVolume: number;
  avgDifficulty: number;
  topKeyword: string;
  intent: SearchIntent;
}

export type SerpFeatureType = 'ai_overview' | 'people_also_ask' | 'featured_snippet' | 'paid_ads' | 'video_carousel' | 'knowledge_panel';

export interface SERPResult {
  id: string;
  research_run_id: string;
  keyword: string;
  position: number;
  title: string;
  url: string;
  domain: string;
  contentType?: 'Listicle' | 'Product Landing Page' | 'In-depth Review' | 'Free Tool / Calculator' | 'Documentation';
  authority_metric_name: string | null;
  authority_metric_value: number | null;
  estimated_backlinks?: number;
  estimated_organic_traffic?: number;
  source: string;
  retrieved_at: string;
  snippet?: string;
}

export interface AIAnalysis {
  id: string;
  research_run_id: string;
  summary: string;
  opportunity_signals: string[];
  risks: string[];
  missing_evidence: string[];
  next_steps: string[];
  model_name: string;
  created_at: string;
  perspective?: 'Blogger / Content Creator' | 'SaaS Product Founder' | 'Freelance Consultant';
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  target_country: string;
  target_language: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  keyword_count?: number;
  runs_count?: number;
}

export interface ResearchRun {
  id: string;
  project_id: string;
  seed_keyword: string;
  country: string;
  language: string;
  provider: string;
  keywords_found: number;
  status: 'completed' | 'running' | 'failed' | 'demo';
  error_summary?: string;
  started_at: string;
  completed_at?: string;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  defaultLanguage: string;
  currency: string;
}

export interface LanguageOption {
  code: string;
  name: string;
}

export interface CountryMarketComparison {
  countryCode: string;
  countryName: string;
  flag: string;
  language: string;
  seedVolume: number;
  avgCpc: number;
  avgKd: number;
  topRankingDomain: string;
}

export interface SavedReport {
  id: string;
  name: string;
  project_name: string;
  seed_keyword: string;
  country: string;
  language: string;
  records_count: number;
  format: 'CSV' | 'JSON';
  created_at: string;
}

export type ViewTab = 
  | 'overview' 
  | 'keywords' 
  | 'serp' 
  | 'ai_studio' 
  | 'market_comparison' 
  | 'projects' 
  | 'reports' 
  | 'admin';

export type DemoStateMode = 'normal' | 'loading' | 'empty' | 'error' | 'rate_limit';
