import type { JobFilters } from '../types/jobs';

const TEXT_KEYS = ['search', 'domain', 'location_type', 'job_category', 'experience_required', 'eligible_year'] as const;
const NUMBER_KEYS = ['package_min', 'package_max'] as const;
const SORT_COLUMNS = ['posted_date', 'package_amount', 'company_name'] as const;

export const buildSearchParamsFromFilters = (filters: JobFilters, page: number): URLSearchParams => {
  const params = new URLSearchParams({ page: page.toString() });
  for (const key of [...TEXT_KEYS, 'sort_by', 'sort_order'] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  for (const key of NUMBER_KEYS) {
    const value = filters[key];
    if (typeof value === 'number') params.set(key, value.toString());
  }
  return params;
};

/** The filters a link to the jobs page asks for. Values it cannot use are ignored. */
export const readFiltersFromSearchParams = (params: URLSearchParams): JobFilters => {
  const filters: JobFilters = {};
  for (const key of TEXT_KEYS) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }
  for (const key of NUMBER_KEYS) {
    const value = Number(params.get(key));
    if (params.get(key) && Number.isFinite(value)) filters[key] = value;
  }
  const sortBy = SORT_COLUMNS.find((column) => column === params.get('sort_by'));
  if (sortBy) filters.sort_by = sortBy;
  const order = params.get('sort_order');
  if (order === 'asc' || order === 'desc') filters.sort_order = order;
  return filters;
};
