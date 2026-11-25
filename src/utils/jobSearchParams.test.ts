import { describe, expect, it } from 'vitest';
import type { JobFilters } from '../types/jobs';
import { buildSearchParamsFromFilters, readFiltersFromSearchParams } from './jobSearchParams';

describe('job search links', () => {
  it('reads back every filter it writes', () => {
    const filters: JobFilters = {
      search: 'C++, Linux', domain: 'IT', location_type: 'Remote', job_category: 'Fresher', experience_required: '0-2',
      eligible_year: '2026', package_min: 0, package_max: 900000, sort_by: 'company_name', sort_order: 'asc',
    };
    expect(readFiltersFromSearchParams(buildSearchParamsFromFilters(filters, 2))).toEqual(filters);
  });

  it('ignores values the jobs query cannot use', () => {
    expect(readFiltersFromSearchParams(new URLSearchParams('sort_by=password&sort_order=x&package_min=abc&search=%20&page=3'))).toEqual({});
  });
});
