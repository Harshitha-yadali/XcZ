export const GEMMA_4_31B_FREE_MODEL = 'google/gemma-4-31b-it:free';
export const GEMMA_4_26B_FREE_MODEL = 'google/gemma-4-26b-a4b-it:free';
export const NEMOTRON_3_ULTRA_FREE_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const NORTH_MINI_CODE_FREE_MODEL = 'cohere/north-mini-code:free';

// Keep every OpenRouter request on this explicit free-model allowlist. Do not use
// openrouter/free: its random routing makes model quality and activity logs vary.
export const FREE_OPENROUTER_MODELS = [
  GEMMA_4_31B_FREE_MODEL,
  GEMMA_4_26B_FREE_MODEL,
  NEMOTRON_3_ULTRA_FREE_MODEL,
  NORTH_MINI_CODE_FREE_MODEL,
] as const;

export const DEFAULT_OPENROUTER_MODEL = GEMMA_4_31B_FREE_MODEL;
export const PINNED_RESUME_PARSER_MODEL = GEMMA_4_31B_FREE_MODEL;
export const RESUME_PARSER_ESCALATION_MODEL = GEMMA_4_26B_FREE_MODEL;
export const QUICK_OPTIMIZATION_MODEL = GEMMA_4_26B_FREE_MODEL;
export const SMART_OPTIMIZATION_MODEL = NEMOTRON_3_ULTRA_FREE_MODEL;
export const DEEP_OPTIMIZATION_MODEL = NEMOTRON_3_ULTRA_FREE_MODEL;

const MODEL_FALLBACK_POOL = FREE_OPENROUTER_MODELS;
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

export const supportsCustomSamplingParameters = (model?: string) => {
  void model;
  return true;
};

export const getOpenRouterTemperature = (
  model: string | undefined,
  requestedTemperature: number | undefined,
  fallbackTemperature = 0.3,
) => supportsCustomSamplingParameters(model)
  ? requestedTemperature ?? fallbackTemperature
  : undefined;

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
  if (!normalizedRequestedModel || !SHARED_MODEL_SET.has(normalizedRequestedModel)) {
    return [...OPENROUTER_MODEL_FALLBACKS];
  }

  return dedupeModels([normalizedRequestedModel, ...OPENROUTER_MODEL_FALLBACKS]);
};

export const shouldRetryWithNextOpenRouterModel = (
  error: unknown,
  currentIndex: number,
  modelsToTry: readonly string[],
) =>
  currentIndex < modelsToTry.length - 1 &&
  (isRateLimitLikeOpenRouterError(error) || isUnavailableOpenRouterModelError(error));
