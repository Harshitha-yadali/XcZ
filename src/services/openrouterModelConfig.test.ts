import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENROUTER_MODEL,
  DEEP_OPTIMIZATION_MODEL,
  FREE_OPENROUTER_MODELS,
  GEMMA_4_26B_FREE_MODEL,
  GEMMA_4_31B_FREE_MODEL,
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

  it('pins every optimization tier to the approved free models', () => {
    expect(QUICK_OPTIMIZATION_MODEL).toBe(GEMMA_4_26B_FREE_MODEL);
    expect(SMART_OPTIMIZATION_MODEL).toBe(NEMOTRON_3_ULTRA_FREE_MODEL);
    expect(DEEP_OPTIMIZATION_MODEL).toBe(NEMOTRON_3_ULTRA_FREE_MODEL);
  });

  it('keeps supported sampling parameters for the free models', () => {
    expect(getOpenRouterTemperature(DEEP_OPTIMIZATION_MODEL, 0.1)).toBe(0.1);
    expect(getOpenRouterTemperature(SMART_OPTIMIZATION_MODEL, 0.1)).toBe(0.1);
    expect(getOpenRouterTemperature(QUICK_OPTIMIZATION_MODEL, undefined)).toBe(0.3);
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
