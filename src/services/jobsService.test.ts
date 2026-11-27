import { expect, it, vi } from 'vitest';
import { jobsService } from './jobsService';

const { or, query } = vi.hoisted(() => {
  const or = vi.fn();
  const query: Record<string, unknown> = { then: (done: (value: unknown) => void) => done({ data: [], error: null, count: 0 }) };
  for (const name of ['select', 'eq', 'order', 'range']) query[name] = () => query;
  query.or = (clause: string) => { or(clause); return query; };
  return { or, query };
});
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => query } }));

it('searches skills as JSON and quotes words holding commas', async () => {
  await jobsService.getJobListings({ search: 'C++, "Linux"' }, 12, 0);
  const search = or.mock.calls.map(([clause]) => clause).find((clause) => clause.includes('role_title'));
  expect(search).toContain('role_title.ilike."%C++, \\"Linux\\"%"');
  // PostgREST unquotes this to ["C++, \"Linux\""], a JSON array.
  const quoted = search.match(/skills\.cs\.(".*")$/)[1];
  expect(JSON.parse(JSON.parse(quoted))).toEqual(['C++, "Linux"']);
});
