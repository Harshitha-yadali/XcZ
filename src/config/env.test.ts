import { describe, expect, it } from 'vitest';
import { SUPABASE_ANON_KEY } from './env';

describe('Supabase browser configuration', () => {
  it('always exposes the public anon key needed by Edge Function clients', () => {
    expect(SUPABASE_ANON_KEY).toMatch(/^eyJ/);
  });
});
