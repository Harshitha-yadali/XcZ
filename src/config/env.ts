/**
 * Environment Configuration
 * 
 * This file centralizes all environment variables for the application.
 * 
 * HOW IT WORKS:
 * - Local Development: Uses .env.local file (not committed to git)
 * - Production (Cloudflare Pages): Uses Variables & Secrets from dashboard
 * 
 * All VITE_ prefixed variables are automatically available via import.meta.env
 */

// ======================
// SUPABASE
// ======================
const DEFAULT_SUPABASE_URL = 'https://rixmudvtbfkjpwjoefon.supabase.co';
const RAW_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const RAW_SUPABASE_PUBLIC_URL = (import.meta.env.VITE_SUPABASE_PUBLIC_URL || '').trim();
const RAW_SUPABASE_DIRECT_URL = (import.meta.env.VITE_SUPABASE_DIRECT_URL || '').trim();
const normalizeUrl = (url: string): string => url.trim().replace(/\/+$/, '');
const isValidAbsoluteUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};
const normalizeConfiguredUrl = (url: string): string => {
  const normalized = normalizeUrl(url);
  return normalized && isValidAbsoluteUrl(normalized) ? normalized : '';
};
const isSupabaseHostedUrl = (url: string): boolean => {
  try {
    return new URL(url).hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

const configuredSupabaseUrls = [
  normalizeConfiguredUrl(RAW_SUPABASE_PUBLIC_URL),
  normalizeConfiguredUrl(RAW_SUPABASE_URL),
  normalizeConfiguredUrl(RAW_SUPABASE_DIRECT_URL),
].filter(Boolean);

const proxySupabaseUrl = configuredSupabaseUrls.find((url) => !isSupabaseHostedUrl(url));
const directSupabaseUrl =
  normalizeConfiguredUrl(RAW_SUPABASE_DIRECT_URL) ||
  configuredSupabaseUrls.find((url) => isSupabaseHostedUrl(url)) ||
  normalizeUrl(DEFAULT_SUPABASE_URL);

export const SUPABASE_DIRECT_URL = directSupabaseUrl;
export const SUPABASE_PUBLIC_URL =
  proxySupabaseUrl ||
  normalizeConfiguredUrl(RAW_SUPABASE_PUBLIC_URL) ||
  normalizeConfiguredUrl(RAW_SUPABASE_URL) ||
  SUPABASE_DIRECT_URL;
export const SUPABASE_URL = SUPABASE_PUBLIC_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SUPABASE_FALLBACK_URL = SUPABASE_PUBLIC_URL === SUPABASE_DIRECT_URL ? '' : SUPABASE_DIRECT_URL;

// ======================
// RAZORPAY (Frontend - Public Key Only)
// ======================
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

// ======================
// CLOUDFLARE WORKER API
// ======================
export const WORKER_API_URL = import.meta.env.VITE_WORKER_API_URL || '';

// ======================
// AI SERVICES (all routed through OpenRouter/Gemini via Edge Function)
// ======================
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
export const EDENAI_API_KEY = '';
export const DEEPSEEK_API_KEY = '';
export const GEMINI_API_KEY = '';

// ======================
// GITHUB
// ======================
export const GITHUB_API_TOKEN = import.meta.env.VITE_GITHUB_API_TOKEN || '';

// ======================
// EXTERNAL SERVICES
// ======================
export const NETLIFY_API_TOKEN = import.meta.env.VITE_NETLIFY_API_TOKEN || '';
export const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || '';
export const EXTERNAL_BROWSER_SERVICE_URL = import.meta.env.VITE_EXTERNAL_BROWSER_SERVICE_URL || '';
export const EXTERNAL_BROWSER_API_KEY = import.meta.env.VITE_EXTERNAL_BROWSER_API_KEY || '';

// ======================
// BROWSER AUTOMATION
// ======================
export const BROWSER_WS = import.meta.env.BROWSER_WS || '';
export const BROWSER_TIMEOUT = import.meta.env.BROWSER_TIMEOUT || '60000';
export const BROWSER_HEADLESS = import.meta.env.BROWSER_HEADLESS !== 'false';

// ======================
// ENVIRONMENT FLAGS
// ======================
export const IS_DEVELOPMENT = import.meta.env.DEV;
export const IS_PRODUCTION = import.meta.env.PROD;
export const MODE = import.meta.env.MODE;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Get Supabase Edge Function URL
 */
export const getSupabaseEdgeFunctionUrl = (
  functionName: string,
  queryParams?: string | URLSearchParams
): string => {
  const normalizedFunctionName = functionName.replace(/^\/+/, '');
  const baseUrl = `${SUPABASE_URL}/functions/v1/${normalizedFunctionName}`;
  if (!queryParams) return baseUrl;

  const queryString = typeof queryParams === 'string' ? queryParams : queryParams.toString();
  if (!queryString) return baseUrl;
  return `${baseUrl}${queryString.startsWith('?') ? queryString : `?${queryString}`}`;
};

/**
 * Network-level routing failures seen on some ISPs.
 */
const SUPABASE_NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'networkerror',
  'err_network_changed',
  'network changed',
  'load failed',
  'network request failed',
];

export const isSupabaseNetworkRoutingError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return SUPABASE_NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const resolveRequestUrl = (input: RequestInfo | URL): string | null => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return null;
};

const UNIQUE_SUPABASE_BASE_URLS = Array.from(
  new Set([SUPABASE_PUBLIC_URL, SUPABASE_FALLBACK_URL].filter(Boolean))
);

const getSupabaseFallbackPlan = (requestUrl: string): { matchedBase: string; attemptUrls: string[] } | null => {
  const matchedBase = UNIQUE_SUPABASE_BASE_URLS.find((baseUrl) => requestUrl.startsWith(baseUrl));
  if (!matchedBase) return null;

  const alternateUrls = UNIQUE_SUPABASE_BASE_URLS
    .filter((baseUrl) => baseUrl !== matchedBase)
    .map((baseUrl) => requestUrl.replace(matchedBase, baseUrl));

  const attemptUrls = [
    requestUrl,
    requestUrl, // Retry same route once for intermittent mobile packet loss/timeouts.
    ...alternateUrls,
  ];

  return { matchedBase, attemptUrls };
};

const createRetryInput = (
  originalInput: RequestInfo | URL,
  requestTemplate: Request | null,
  retryUrl: string
): RequestInfo | URL => {
  if (typeof originalInput === 'string') return retryUrl;
  if (originalInput instanceof URL) return new URL(retryUrl);
  if (requestTemplate) return new Request(retryUrl, requestTemplate.clone());
  return originalInput;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a fetch wrapper that retries Supabase requests once via fallback URL
 * when the first request fails with a routing-level network error.
 */
export const createSupabaseNetworkFetch = (): typeof fetch => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = resolveRequestUrl(input);
    const fallbackPlan = requestUrl ? getSupabaseFallbackPlan(requestUrl) : null;
    const requestTemplate = input instanceof Request ? input.clone() : null;

    try {
      return await fetch(input, init);
    } catch (error) {
      const shouldRetry = !!fallbackPlan && isSupabaseNetworkRoutingError(error);
      if (!shouldRetry) {
        throw error;
      }

      let lastError: unknown = error;
      const retryUrls = fallbackPlan.attemptUrls.slice(1);
      for (let i = 0; i < retryUrls.length; i += 1) {
        const retryUrl = retryUrls[i];
        const isSameRouteRetry = retryUrl === requestUrl;

        console.warn('Supabase request failed, retrying with alternate route', {
          originalUrl: requestUrl,
          retryUrl,
          retryType: isSameRouteRetry ? 'same-route' : 'alternate-route',
        });

        try {
          await delay(250 * (i + 1));
          const retryInput = createRetryInput(input, requestTemplate, retryUrl);
          const retryInit = input instanceof Request ? undefined : init;
          return await fetch(retryInput, retryInit);
        } catch (retryError) {
          lastError = retryError;
          if (!isSupabaseNetworkRoutingError(retryError)) {
            throw retryError;
          }
        }
      }

      throw lastError;
    }
  };
};

const sharedSupabaseNetworkFetch = createSupabaseNetworkFetch();

/**
 * Shared fetch wrapper for Supabase edge-function calls.
 */
export const fetchWithSupabaseFallback = (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  return sharedSupabaseNetworkFetch(input, init);
};

if (SUPABASE_PUBLIC_URL === SUPABASE_DIRECT_URL) {
  console.warn('Supabase proxy route is not active. Set VITE_SUPABASE_PUBLIC_URL to your Worker/custom domain for mobile ISP resilience.');
}

if (!RAW_SUPABASE_PUBLIC_URL && !RAW_SUPABASE_URL) {
  console.warn('Supabase URL env vars are missing. Falling back to default project URL.');
}

/**
 * Get Worker API endpoint
 */
export const getWorkerEndpoint = (path: string): string => {
  const baseUrl = WORKER_API_URL.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Check if a required env variable is configured
 */
export const isConfigured = (value: string | undefined): boolean => {
  return !!value && value.length > 0;
};

/**
 * Validate required environment variables
 * Call this on app startup to catch missing config early
 */
export const validateRequiredEnvVars = (): { valid: boolean; missing: string[] } => {
  const required = [
    { name: 'VITE_SUPABASE_URL or VITE_SUPABASE_PUBLIC_URL', value: RAW_SUPABASE_URL || RAW_SUPABASE_PUBLIC_URL },
    { name: 'VITE_SUPABASE_ANON_KEY', value: SUPABASE_ANON_KEY },
    { name: 'VITE_RAZORPAY_KEY_ID', value: RAZORPAY_KEY_ID },
    { name: 'VITE_WORKER_API_URL', value: WORKER_API_URL },
  ];

  const missing = required.filter(v => !isConfigured(v.value)).map(v => v.name);

  if (missing.length > 0 && IS_DEVELOPMENT) {
    console.warn('⚠️ Missing environment variables:', missing);
  }

  return { valid: missing.length === 0, missing };
};

// ======================
// DEFAULT EXPORT
// ======================
const env = {
  // Supabase
  SUPABASE_DIRECT_URL,
  SUPABASE_PUBLIC_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_FALLBACK_URL,
  
  // Razorpay
  RAZORPAY_KEY_ID,
  
  // Worker
  WORKER_API_URL,
  
  // AI Services
  EDENAI_API_KEY,
  OPENROUTER_API_KEY,
  DEEPSEEK_API_KEY,
  GEMINI_API_KEY,
  
  // GitHub
  GITHUB_API_TOKEN,
  
  // External Services
  NETLIFY_API_TOKEN,
  RAPIDAPI_KEY,
  EXTERNAL_BROWSER_SERVICE_URL,
  EXTERNAL_BROWSER_API_KEY,
  
  // Browser
  BROWSER_WS,
  BROWSER_TIMEOUT,
  BROWSER_HEADLESS,
  
  // Flags
  IS_DEVELOPMENT,
  IS_PRODUCTION,
  MODE,
  
  // Helpers
  getSupabaseEdgeFunctionUrl,
  createSupabaseNetworkFetch,
  fetchWithSupabaseFallback,
  isSupabaseNetworkRoutingError,
  getWorkerEndpoint,
  isConfigured,
  validateRequiredEnvVars,
};

export default env;
