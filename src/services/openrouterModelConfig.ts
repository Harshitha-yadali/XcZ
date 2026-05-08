export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

const SHARED_FREE_OPENROUTER_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'google/gemma-3n-e2b-it:free',
  ] as const;

const LEGACY_OPENROUTER_MODELS = [
  'google/gemma-3n-e4b-it',
  'google/gemma-3n-e4b-it:free',
] as const;

const MODEL_FALLBACK_POOL = [
  DEFAULT_OPENROUTER_MODEL,
  ...SHARED_FREE_OPENROUTER_MODELS,
  ...LEGACY_OPENROUTER_MODELS,
] as const;
const SHARED_MODEL_SET = new Set<string>(MODEL_FALLBACK_POOL);

const RATE_LIMIT_ERROR_PATTERNS = [
  '429',
  'rate limit',
  'rate-limit',
  'temporarily rate-limited',
  'too many requests',
  'provider returned error',
] as const;

const MODEL_UNAVAILABLE_ERROR_PATTERNS = [
  'no endpoints found',
  'model not found',
  'not a valid model',
  'unknown model',
  'no providers available',
] as const;

const normalizeModelId = (model?: string) => model?.trim() || '';

const dedupeModels = (models: readonly string[]) =>
  Array.from(new Set(models.map(normalizeModelId).filter(Boolean)));

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message.toLowerCase() : '';

export const OPENROUTER_MODEL_FALLBACKS = dedupeModels(MODEL_FALLBACK_POOL);

export const isRateLimitLikeOpenRouterError = (error: unknown) => {
  const message = getErrorMessage(error);
  return RATE_LIMIT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const isUnavailableOpenRouterModelError = (error: unknown) => {
  const message = getErrorMessage(error);

  if (MODEL_UNAVAILABLE_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return true;
  }

  return message.includes('404') && (message.includes('model') || message.includes('endpoint'));
};

export const getOpenRouterModelsToTry = (requestedModel?: string) => {
  const normalizedRequestedModel = normalizeModelId(requestedModel);
  if (!normalizedRequestedModel) {
    return [...OPENROUTER_MODEL_FALLBACKS];
  }

  if (SHARED_MODEL_SET.has(normalizedRequestedModel)) {
    return dedupeModels([normalizedRequestedModel, ...OPENROUTER_MODEL_FALLBACKS]);
  }

  return [normalizedRequestedModel];
};

export const shouldRetryWithNextOpenRouterModel = (
  error: unknown,
  currentIndex: number,
  modelsToTry: readonly string[],
) =>
  currentIndex < modelsToTry.length - 1 &&
  (isRateLimitLikeOpenRouterError(error) || isUnavailableOpenRouterModelError(error));
