import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const getSession = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: (...a: unknown[]) => getSession(...a) },
    from: () => ({ insert: (...a: unknown[]) => insert(...a) }),
  },
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('funnel', () => {
  beforeEach(() => {
    vi.resetModules();
    insert.mockReset().mockResolvedValue({ error: null });
    getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    sessionStorage.clear();
    localStorage.clear();
  });

  it('inserts an event with user, anon id and meta', async () => {
    const { track } = await import('./funnel');
    track('tier_picked', { tier: 'smart' });
    await flush();
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({ event: 'tier_picked', user_id: 'u1', meta: { tier: 'smart' } });
    expect(row.anon_id).toBe(localStorage.getItem('pb_anon_id'));
  });

  it('trackOnce dedupes per session', async () => {
    const { trackOnce } = await import('./funnel');
    trackOnce('home_view');
    trackOnce('home_view');
    trackOnce('jobs_view');
    await flush();
    expect(insert.mock.calls.map((c) => c[0].event)).toEqual(['home_view', 'jobs_view']);
  });

  it('never throws when the client or storage fails', async () => {
    insert.mockRejectedValue(new Error('network'));
    getSession.mockImplementation(() => { throw new Error('boom'); });
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const { track, trackOnce } = await import('./funnel');
    expect(() => track('payment_failed')).not.toThrow();
    expect(() => trackOnce('home_view')).not.toThrow();
    await flush();
    spy.mockRestore();
  });
});
