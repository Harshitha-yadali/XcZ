import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModelsToTry,
  isUnavailableOpenRouterModelError,
  shouldRetryWithNextOpenRouterModel,
} from './openrouterModelConfig';

describe('openrouterModelConfig', () => {
  it('prefers the shared default model when none is requested', () => {
    expect(getOpenRouterModelsToTry()[0]).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it('keeps legacy shared models retryable with modern fallbacks', () => {
    expect(getOpenRouterModelsToTry('google/gemma-3n-e4b-it:free')).toEqual([
      'google/gemma-3n-e4b-it:free',
      DEFAULT_OPENROUTER_MODEL,
      'nvidia/nemotron-3-nano-30b-a3b:free',
      'nvidia/nemotron-nano-9b-v2:free',
      'google/gemma-3n-e2b-it:free',
      'google/gemma-3n-e4b-it',
    ]);
  });

  it('does not swap explicit non-shared models', () => {
    expect(getOpenRouterModelsToTry('openai/gpt-5')).toEqual(['openai/gpt-5']);
  });

  it('detects unavailable-model errors returned by the proxy', () => {
    const error = new Error(
      'AI proxy request failed (404): {"error":{"message":"No endpoints found for google/gemma-3n-e4b-it:free.","code":404}}'
    );

    expect(isUnavailableOpenRouterModelError(error)).toBe(true);
  });

  it('retries the next fallback model for unavailable shared models', () => {
    const error = new Error(
      'AI proxy request failed (404): {"error":{"message":"No endpoints found for google/gemma-3n-e4b-it:free.","code":404}}'
    );
    const modelsToTry = getOpenRouterModelsToTry('google/gemma-3n-e4b-it:free');

    expect(shouldRetryWithNextOpenRouterModel(error, 0, modelsToTry)).toBe(true);
    expect(shouldRetryWithNextOpenRouterModel(error, modelsToTry.length - 1, modelsToTry)).toBe(false);
  });
});
