-- English-language Google markets supported by research (DataForSEO / Google Ads location codes).
INSERT INTO "provider_markets" (
  "provider", "country_code", "language_code", "location_code", "location_name",
  "location_type", "canonical_name", "active"
) VALUES
  ('dataforseo', 'GB', 'en', 2826, 'United Kingdom', 'Country', 'United Kingdom', true),
  ('dataforseo', 'CA', 'en', 2124, 'Canada', 'Country', 'Canada', true),
  ('dataforseo', 'AU', 'en', 2036, 'Australia', 'Country', 'Australia', true),
  ('dataforseo', 'IN', 'en', 2356, 'India', 'Country', 'India', true),
  ('dataforseo', 'PK', 'en', 2586, 'Pakistan', 'Country', 'Pakistan', true),
  ('dataforseo', 'AE', 'en', 2784, 'United Arab Emirates', 'Country', 'United Arab Emirates', true),
  ('dataforseo', 'SG', 'en', 2702, 'Singapore', 'Country', 'Singapore', true),
  ('dataforseo', 'NZ', 'en', 2554, 'New Zealand', 'Country', 'New Zealand', true),
  ('dataforseo', 'ZA', 'en', 2710, 'South Africa', 'Country', 'South Africa', true),
  ('dataforseo', 'NG', 'en', 2566, 'Nigeria', 'Country', 'Nigeria', true),
  ('dataforseo', 'PH', 'en', 2608, 'Philippines', 'Country', 'Philippines', true),
  ('dataforseo', 'IE', 'en', 2372, 'Ireland', 'Country', 'Ireland', true)
ON CONFLICT ("provider", "location_code", "language_code") DO NOTHING;
