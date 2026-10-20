import type { UserRole, ViewTab } from '@/types/seo';

export const VIEW_TABS: readonly ViewTab[] = [
  'overview',
  'keywords',
  'coverage',
  'serp',
  'ai_studio',
  'market_comparison',
  'projects',
  'reports',
  'admin',
];

export function isViewTab(value: string | null): value is ViewTab {
  return value !== null && VIEW_TABS.includes(value as ViewTab);
}

export function canAccessView(role: UserRole, view: ViewTab): boolean {
  return role === 'admin' || view !== 'admin';
}
