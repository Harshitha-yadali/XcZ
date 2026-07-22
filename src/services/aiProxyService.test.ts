import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithSupabaseFallback } = vi.hoisted(() => ({
  fetchWithSupabaseFallback: vi.fn(),
}));

vi.mock('../config/env', () => ({
  SUPABASE_ANON_KEY: 'public-anon-key',
  SUPABASE_DIRECT_URL: 'https://project.supabase.co',
  fetchWithSupabaseFallback,
  getSupabaseEdgeFunctionUrl: () => 'https://public.example.com/functions/v1/ai-proxy',
}));

import { openrouter } from './aiProxyService';
import { GEMMA_4_26B_FREE_MODEL } from './openrouterModelConfig';

describe('aiProxyService', () => {
  beforeEach(() => {
    fetchWithSupabaseFallback.mockReset();
    fetchWithSupabaseFallback.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Optimized resume' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });

  it('authenticates JD optimization requests with both Supabase headers', async () => {
    await expect(
      openrouter.chat('Optimize this resume', {
        model: GEMMA_4_26B_FREE_MODEL,
        maxTokens: 100,
      }),
    ).resolves.toBe('Optimized resume');

    expect(fetchWithSupabaseFallback).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchWithSupabaseFallback.mock.calls[0];

    expect(requestUrl).toBe('https://public.example.com/functions/v1/ai-proxy');
    expect(requestInit).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: 'public-anon-key',
        Authorization: 'Bearer public-anon-key',
      },
    });
    expect(JSON.parse(requestInit.body as string)).toMatchObject({
      service: 'openrouter',
      action: 'chat',
      model: GEMMA_4_26B_FREE_MODEL,
      prompt: 'Optimize this resume',
    });
  });
});
