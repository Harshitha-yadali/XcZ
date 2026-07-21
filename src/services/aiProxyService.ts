import {
  SUPABASE_ANON_KEY,
  SUPABASE_DIRECT_URL,
  fetchWithSupabaseFallback,
  getSupabaseEdgeFunctionUrl,
} from '../config/env';
import {
  getOpenRouterTemperature,
  getOpenRouterModelsToTry,
  shouldRetryWithNextOpenRouterModel,
} from './openrouterModelConfig';

const PROXY_URL = getSupabaseEdgeFunctionUrl('ai-proxy');
const buildEdgeFunctionUrl = (baseUrl: string, functionName: string) =>
  `${baseUrl.replace(/\/+$/, '')}/functions/v1/${functionName.replace(/^\/+/, '')}`;
const DIRECT_PROXY_URL = buildEdgeFunctionUrl(SUPABASE_DIRECT_URL, 'ai-proxy');
const RETRYABLE_PROXY_STATUSES = new Set([502, 503, 504, 522, 524, 546]);
const RETRYABLE_PROXY_BODY_PATTERNS = [
  'worker_resource_limit',
  'not having enough compute resources',
  'function failed due to not having enough compute resources',
];

const getProxyAttemptUrls = () =>
  Array.from(
    new Set([PROXY_URL, DIRECT_PROXY_URL].filter((url) => /^https?:\/\//i.test(url)))
  );

const shouldRetryOnDirectRoute = (
  status: number,
  responseText: string,
  currentUrl: string,
  attemptIndex: number,
  attemptUrls: string[],
) => {
  if (attemptIndex >= attemptUrls.length - 1) return false;
  if (currentUrl === DIRECT_PROXY_URL) return false;

  const normalizedText = responseText.toLowerCase();
  return (
    RETRYABLE_PROXY_STATUSES.has(status) ||
    RETRYABLE_PROXY_BODY_PATTERNS.some((pattern) => normalizedText.includes(pattern))
  );
};

const callProxy = async (service: string, action: string, params: Record<string, unknown> = {}) => {
  const attemptUrls = getProxyAttemptUrls();
  if (attemptUrls.length === 0) {
    throw new Error(
      'AI proxy URL is not configured. Set VITE_SUPABASE_PUBLIC_URL (or VITE_SUPABASE_URL) in deployment env vars.'
    );
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase anon key is missing. Set VITE_SUPABASE_ANON_KEY in deployment env vars.'
    );
  }

  for (let attemptIndex = 0; attemptIndex < attemptUrls.length; attemptIndex += 1) {
    const requestUrl = attemptUrls[attemptIndex];
    const response = await fetchWithSupabaseFallback(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ service, action, ...params }),
    });

    const rawText = await response.text();
    const data = rawText
      ? (() => {
          try {
            return JSON.parse(rawText);
          } catch {
            return null;
          }
        })()
      : null;

    if (!response.ok) {
      const responseError =
        typeof data?.error === 'string' && data.error.trim()
          ? data.error.trim()
          : rawText.trim() || 'Empty response body';

      if (shouldRetryOnDirectRoute(response.status, responseError, requestUrl, attemptIndex, attemptUrls)) {
        console.warn('AI proxy route failed, retrying against direct Supabase function URL', {
          status: response.status,
          requestUrl,
          fallbackUrl: attemptUrls[attemptIndex + 1],
        });
        continue;
      }

      throw new Error(`AI proxy request failed (${response.status}): ${responseError}`);
    }

    if (!data) {
      throw new Error(
        `AI proxy returned empty or non-JSON response for ${service}/${action}. URL: ${requestUrl}`
      );
    }

    return data;
  }

  throw new Error(`AI proxy request failed for ${service}/${action}`);
};

export const openrouter = {
  async chat(prompt: string, options: { model?: string; temperature?: number; maxTokens?: number } = {}) {
    const modelsToTry = getOpenRouterModelsToTry(options.model);
    let lastError: unknown = null;

    for (let i = 0; i < modelsToTry.length; i += 1) {
      try {
        const temperature = getOpenRouterTemperature(modelsToTry[i], options.temperature);
        const result = await callProxy('openrouter', 'chat', {
          prompt,
          model: modelsToTry[i],
          ...(temperature === undefined ? {} : { temperature }),
          maxTokens: options.maxTokens ?? 4000,
        });

        return result.choices?.[0]?.message?.content || '';
      } catch (error) {
        lastError = error;
        const shouldRetryWithNext = shouldRetryWithNextOpenRouterModel(error, i, modelsToTry);
        if (!shouldRetryWithNext) throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('AI chat request failed');
  },

  async chatWithSystem(systemPrompt: string, userPrompt: string, options: { model?: string; temperature?: number } = {}) {
    const modelsToTry = getOpenRouterModelsToTry(options.model);
    let lastError: unknown = null;

    for (let i = 0; i < modelsToTry.length; i += 1) {
      try {
        const temperature = getOpenRouterTemperature(modelsToTry[i], options.temperature);
        const result = await callProxy('openrouter', 'chat_with_system', {
          systemPrompt,
          userPrompt,
          model: modelsToTry[i],
          ...(temperature === undefined ? {} : { temperature }),
        });

        return result.choices?.[0]?.message?.content || '';
      } catch (error) {
        lastError = error;
        const shouldRetryWithNext = shouldRetryWithNextOpenRouterModel(error, i, modelsToTry);
        if (!shouldRetryWithNext) throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('AI chat request failed');
  },

  async summarize(text: string, outputLength: 'short' | 'medium' | 'long' = 'medium') {
    const sentenceCount = outputLength === 'short' ? 3 : outputLength === 'long' ? 10 : 5;
    const systemPrompt = `You are a professional text summarizer. Summarize the given text in approximately ${sentenceCount} sentences. Focus on key responsibilities, required skills, and domain. Return only the summary text.`;
    return openrouter.chatWithSystem(systemPrompt, text, { temperature: 0.2 });
  },

  async spellCheck(text: string) {
    const systemPrompt = 'You are a professional proofreader. Correct any spelling and grammar errors in the following text. Return only the corrected text with no explanations.';
    return openrouter.chatWithSystem(systemPrompt, text.slice(0, 10000), { temperature: 0.1 });
  },

  async moderate(text: string) {
    const systemPrompt = 'Analyze this text for inappropriate, offensive, or harmful content. Return a JSON object with: {"flagged": boolean, "categories": [], "reason": ""}. If the text is clean, return {"flagged": false, "categories": [], "reason": ""}.';
    const response = await openrouter.chatWithSystem(systemPrompt, text.slice(0, 10000), { temperature: 0.1 });
    try {
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { flagged: false, categories: [], reason: '' };
    }
  },
};

export const github = {
  async getUser(username: string) {
    return callProxy('github', 'user', { username });
  },

  async getRepo(owner: string, repo: string) {
    return callProxy('github', 'repo', { owner, repo });
  },

  async getCommits(owner: string, repo: string) {
    return callProxy('github', 'commits', { owner, repo });
  },

  async searchRepos(query: string, options: { sort?: string; order?: string; perPage?: number } = {}) {
    return callProxy('github', 'search_repos', {
      query,
      sort: options.sort || 'stars',
      order: options.order || 'desc',
      perPage: options.perPage || 10,
    });
  },
};

export const edenai = {
  async extractText(_file: File): Promise<string> {
    console.warn('edenai.extractText is deprecated. Use fileParser + Gemini instead.');
    const { parseFile } = await import('../utils/fileParser');
    const result = await parseFile(_file);
    return result.text;
  },

  async chat(prompt: string, options: { provider?: string; temperature?: number; maxTokens?: number } = {}) {
    return openrouter.chat(prompt, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  },

  async summarize(text: string, outputLength: 'short' | 'medium' | 'long' = 'medium') {
    return openrouter.summarize(text, outputLength);
  },

  async moderate(text: string) {
    return openrouter.moderate(text);
  },

  async spellCheck(text: string) {
    return openrouter.spellCheck(text);
  },
};

export const gemini = {
  async generate(prompt: string, model = 'gemini-pro') {
    return openrouter.chat(prompt, { model });
  },
};

export const aiProxy = {
  edenai,
  openrouter,
  gemini,
  github,
};

export default aiProxy;
