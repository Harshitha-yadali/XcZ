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

vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { openrouter } from './aiProxyService';
import { FREE_OPENROUTER_MODELS, GEMMA_4_26B_FREE_MODEL, QUICK_OPTIMIZATION_MODEL } from './openrouterModelConfig';

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

  it('warns when a paid tier request is silently served by a fallback model', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fetchWithSupabaseFallback
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'rate limited, try again' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Optimized resume' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      openrouter.chat('Optimize this resume', { model: QUICK_OPTIMIZATION_MODEL }),
    ).resolves.toBe('Optimized resume');

    expect(fetchWithSupabaseFallback).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      'AI request served by fallback model instead of the requested model',
      expect.objectContaining({
        requestedModel: QUICK_OPTIMIZATION_MODEL,
        servedModel: FREE_OPENROUTER_MODELS[0],
        fallbackDepth: 1,
      }),
    );

    warnSpy.mockRestore();
  });

  it('does not warn when the requested model serves the request directly', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      openrouter.chat('Optimize this resume', { model: QUICK_OPTIMIZATION_MODEL }),
    ).resolves.toBe('Optimized resume');

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
