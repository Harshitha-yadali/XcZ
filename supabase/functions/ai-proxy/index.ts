import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_OPENROUTER_MODELS = new Set([
  "openai/gpt-5.6-terra",
  "google/gemini-3.5-flash-lite",
  "anthropic/claude-opus-4.8",
  "openai/gpt-6-luna",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "cohere/north-mini-code:free",
]);
const configuredDefaultModel = Deno.env.get("OPENROUTER_DEFAULT_MODEL")?.trim() || "";
const DEFAULT_OPENROUTER_MODEL = ALLOWED_OPENROUTER_MODELS.has(configuredDefaultModel)
  ? configuredDefaultModel
  : "google/gemma-4-31b-it:free";
const MODELS_WITH_FIXED_SAMPLING = new Set([
  "openai/gpt-5.6-terra",
  "openai/gpt-6-luna",
]);
// Models served by ZenMux (OpenAI-compatible) instead of OpenRouter.
const ZENMUX_MODELS = new Set([
  "openai/gpt-6-luna",
]);

// Returns [url, apiKey] for the provider serving this model; apiKey is empty when unset.
const chatEndpointFor = (model: string): [string, string] =>
  ZENMUX_MODELS.has(model)
    ? ["https://zenmux.ai/api/v1/chat/completions", Deno.env.get("ZENMUX_API_KEY") || ""]
    : ["https://openrouter.ai/api/v1/chat/completions", Deno.env.get("OPENROUTER_API_KEY") || ""];

const resolveAllowedModel = (requestedModel: unknown): string | null => {
  const model = typeof requestedModel === "string" && requestedModel.trim()
    ? requestedModel.trim()
    : DEFAULT_OPENROUTER_MODEL;
  return ALLOWED_OPENROUTER_MODELS.has(model) ? model : null;
};

const MAX_OUTPUT_TOKENS = 8000;
const GUEST_MAX_OUTPUT_TOKENS = 500;

// GitHub names are [A-Za-z0-9._-]; anything else (e.g. "../user/repos") would
// let callers walk the API path with our token.
const GITHUB_NAME = /^(?!\.+$)[A-Za-z0-9._-]{1,100}$/;

const withSupportedSampling = (model: string, temperature: number) =>
  MODELS_WITH_FIXED_SAMPLING.has(model) ? {} : { temperature };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Logged-out visitors (homepage chatbot) may use free models only.
  const { user } = await getCaller(req);
  const isGuest = !user;

  try {
    const { service, action, ...params } = await req.json();

    switch (service) {
      case "openrouter":
        return await handleOpenRouter(action, params, isGuest);
      case "github":
        if (isGuest) return jsonResponse({ error: "Sign in required." }, 401);
        return await handleGitHub(action, params);
      default:
        return jsonResponse({ error: `Unknown service: ${service}` }, 400);
    }
  } catch (error: any) {
    console.error("AI Proxy Error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});

async function handleOpenRouter(action: string, params: any, isGuest: boolean) {
  const outputCap = isGuest ? GUEST_MAX_OUTPUT_TOKENS : MAX_OUTPUT_TOKENS;

  switch (action) {
    case "chat": {
      const { prompt, temperature = 0.3, maxTokens = 4000 } = params;
      const model = resolveAllowedModel(params.model);
      if (!model) return jsonResponse({ error: "Requested model is not in the approved model allowlist" }, 400);
      if (isGuest && !model.endsWith(":free")) return jsonResponse({ error: "Sign in required for this model." }, 401);
      const [url, apiKey] = chatEndpointFor(model);
      if (!apiKey) return jsonResponse({ error: `API key not configured for ${model}` }, 500);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          ...withSupportedSampling(model, temperature),
          max_tokens: Math.min(Math.max(1, Number(maxTokens) || 4000), outputCap),
        }),
      });
      return jsonResponse(await res.json(), res.status);
    }

    case "chat_with_system": {
      const { systemPrompt, userPrompt, temperature = 0.3 } = params;
      const model = resolveAllowedModel(params.model);
      if (!model) return jsonResponse({ error: "Requested model is not in the approved model allowlist" }, 400);
      if (isGuest && !model.endsWith(":free")) return jsonResponse({ error: "Sign in required for this model." }, 401);
      const [url, apiKey] = chatEndpointFor(model);
      if (!apiKey) return jsonResponse({ error: `API key not configured for ${model}` }, 500);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          ...withSupportedSampling(model, temperature),
          max_tokens: outputCap,
        }),
      });
      return jsonResponse(await res.json(), res.status);
    }

    default:
      return jsonResponse({ error: `Unknown OpenRouter action: ${action}` }, 400);
  }
}

async function handleGitHub(action: string, params: any) {
  const API_TOKEN = Deno.env.get("GITHUB_API_TOKEN");
  if (!API_TOKEN) return jsonResponse({ error: "GITHUB_API_TOKEN not configured" }, 500);

  const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    "User-Agent": "PrimoBoostAI",
    Accept: "application/vnd.github.v3+json",
  };

  for (const key of ["username", "owner", "repo"] as const) {
    if (params[key] !== undefined && !GITHUB_NAME.test(String(params[key]))) {
      return jsonResponse({ error: `Invalid GitHub ${key}` }, 400);
    }
  }

  switch (action) {
    case "user": {
      const res = await fetch(`https://api.github.com/users/${params.username}`, { headers });
      return jsonResponse(await res.json(), res.status);
    }

    case "repo": {
      const res = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}`, { headers });
      return jsonResponse(await res.json(), res.status);
    }

    case "commits": {
      const res = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/commits`, { headers });
      return jsonResponse(await res.json(), res.status);
    }

    case "search_repos": {
      const { query, sort = "stars", order = "desc", perPage = 10 } = params;
      const qs = new URLSearchParams({ q: String(query ?? ""), sort: String(sort), order: String(order), per_page: String(Math.min(Number(perPage) || 10, 50)) });
      const url = `https://api.github.com/search/repositories?${qs}`;
      const res = await fetch(url, { headers });
      return jsonResponse(await res.json(), res.status);
    }

    default:
      return jsonResponse({ error: `Unknown GitHub action: ${action}` }, 400);
  }
}
