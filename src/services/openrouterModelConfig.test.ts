import { describe, expect, it } from 'vitest';
import {
  ALLOWED_OPENROUTER_MODELS,
  CLAUDE_OPUS_4_8_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  DEEP_OPTIMIZATION_MODEL,
  FIRST_PASS_OPTIMIZATION_MODEL,
  FREE_OPENROUTER_MODELS,
  GEMINI_3_5_FLASH_LITE_MODEL,
  GPT_6_LUNA_MODEL,
  GEMMA_4_26B_FREE_MODEL,
  GEMMA_4_31B_FREE_MODEL,
  GPT_5_6_TERRA_MODEL,
  NEMOTRON_3_ULTRA_FREE_MODEL,
  NORTH_MINI_CODE_FREE_MODEL,
  PINNED_RESUME_PARSER_MODEL,
  QUICK_OPTIMIZATION_MODEL,
  RESUME_PARSER_ESCALATION_MODEL,
  SMART_OPTIMIZATION_MODEL,
  getOpenRouterTemperature,
  getOpenRouterModelsToTry,
  isUnavailableOpenRouterModelError,
  shouldRetryWithNextOpenRouterModel,
} from './openrouterModelConfig';

describe('openrouterModelConfig', () => {
  it('pins resume parsing to one explicit model', () => {
    expect(PINNED_RESUME_PARSER_MODEL).toBe(GEMMA_4_31B_FREE_MODEL);
    expect(RESUME_PARSER_ESCALATION_MODEL).toBe(GEMMA_4_26B_FREE_MODEL);
    expect(getOpenRouterModelsToTry(PINNED_RESUME_PARSER_MODEL)).toEqual(FREE_OPENROUTER_MODELS);
  });

  it('pins every optimization tier to its approved model', () => {
    expect(QUICK_OPTIMIZATION_MODEL).toBe(GEMINI_3_5_FLASH_LITE_MODEL);
    expect(SMART_OPTIMIZATION_MODEL).toBe(GPT_5_6_TERRA_MODEL);
    expect(DEEP_OPTIMIZATION_MODEL).toBe(CLAUDE_OPUS_4_8_MODEL);
    expect(ALLOWED_OPENROUTER_MODELS).toContain(QUICK_OPTIMIZATION_MODEL);
    expect(ALLOWED_OPENROUTER_MODELS).toContain(SMART_OPTIMIZATION_MODEL);
    expect(ALLOWED_OPENROUTER_MODELS).toContain(DEEP_OPTIMIZATION_MODEL);
  });

  it('never lets two paid optimization tiers share the same model', () => {
    // Regression guard for cd6c63f, which briefly pointed Smart and Deep at the
    // same free model — silently erasing the premium tier's value proposition.
    const tierModels = [QUICK_OPTIMIZATION_MODEL, SMART_OPTIMIZATION_MODEL, DEEP_OPTIMIZATION_MODEL];
    expect(new Set(tierModels).size).toBe(tierModels.length);
  });

  it('omits unsupported sampling parameters for GPT-5.6 Terra', () => {
    expect(getOpenRouterTemperature(DEEP_OPTIMIZATION_MODEL, 0.1)).toBe(0.1);
    expect(getOpenRouterTemperature(SMART_OPTIMIZATION_MODEL, 0.1)).toBeUndefined();
    expect(getOpenRouterTemperature(QUICK_OPTIMIZATION_MODEL, undefined)).toBe(0.3);
  });

  it('tries GPT-5.6 Terra first for Smart and keeps free fallbacks available', () => {
    expect(getOpenRouterModelsToTry(SMART_OPTIMIZATION_MODEL)).toEqual([
      GPT_5_6_TERRA_MODEL,
      ...FREE_OPENROUTER_MODELS,
    ]);
  });

  it('tries the paid Quick and Deep models before free fallbacks', () => {
    expect(getOpenRouterModelsToTry(QUICK_OPTIMIZATION_MODEL)).toEqual([
      GEMINI_3_5_FLASH_LITE_MODEL,
      ...FREE_OPENROUTER_MODELS,
    ]);
    expect(getOpenRouterModelsToTry(DEEP_OPTIMIZATION_MODEL)).toEqual([
      CLAUDE_OPUS_4_8_MODEL,
      ...FREE_OPENROUTER_MODELS,
    ]);
  });

  it('runs the Luna first pass alone so failures reach the tier-model fallback', () => {
    expect(FIRST_PASS_OPTIMIZATION_MODEL).toBe(GPT_6_LUNA_MODEL);
    expect(ALLOWED_OPENROUTER_MODELS).toContain(GPT_6_LUNA_MODEL);
    expect(getOpenRouterModelsToTry(GPT_6_LUNA_MODEL)).toEqual([GPT_6_LUNA_MODEL]);
    expect(getOpenRouterTemperature(GPT_6_LUNA_MODEL, 0.3)).toBeUndefined();
  });

  it('prefers the shared default model when none is requested', () => {
    expect(getOpenRouterModelsToTry()[0]).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it('keeps approved free models retryable within the allowlist', () => {
    expect(getOpenRouterModelsToTry(NORTH_MINI_CODE_FREE_MODEL)).toEqual([
      NORTH_MINI_CODE_FREE_MODEL,
      GEMMA_4_31B_FREE_MODEL,
      GEMMA_4_26B_FREE_MODEL,
      NEMOTRON_3_ULTRA_FREE_MODEL,
    ]);
  });

  it('replaces non-allowlisted model requests with the free fallback pool', () => {
    expect(getOpenRouterModelsToTry('openai/gpt-5')).toEqual(FREE_OPENROUTER_MODELS);
  });

  it('detects unavailable-model errors returned by the proxy', () => {
    const error = new Error(
      `AI proxy request failed (404): {"error":{"message":"No endpoints found for ${GEMMA_4_31B_FREE_MODEL}.","code":404}}`
    );

    expect(isUnavailableOpenRouterModelError(error)).toBe(true);
  });

  it('retries the next fallback model for unavailable shared models', () => {
    const error = new Error(
      `AI proxy request failed (404): {"error":{"message":"No endpoints found for ${GEMMA_4_31B_FREE_MODEL}.","code":404}}`
    );
    const modelsToTry = getOpenRouterModelsToTry(GEMMA_4_31B_FREE_MODEL);

    expect(shouldRetryWithNextOpenRouterModel(error, 0, modelsToTry)).toBe(true);
    expect(shouldRetryWithNextOpenRouterModel(error, modelsToTry.length - 1, modelsToTry)).toBe(false);
  });
});
