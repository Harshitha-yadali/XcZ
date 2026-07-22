import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "cohere/north-mini-code:free",
]);
const configuredDefaultModel = Deno.env.get("OPENROUTER_DEFAULT_MODEL")?.trim() || "";
const DEFAULT_OPENROUTER_MODEL = ALLOWED_OPENROUTER_MODELS.has(configuredDefaultModel)
  ? configuredDefaultModel
  : "google/gemma-4-31b-it:free";
const MODELS_WITH_FIXED_SAMPLING = new Set<string>();

const resolveAllowedModel = (requestedModel: unknown): string | null => {
  const model = typeof requestedModel === "string" && requestedModel.trim()
    ? requestedModel.trim()
    : DEFAULT_OPENROUTER_MODEL;
  return ALLOWED_OPENROUTER_MODELS.has(model) ? model : null;
};

const withSupportedSampling = (model: string, temperature: number) =>
  MODELS_WITH_FIXED_SAMPLING.has(model) ? {} : { temperature };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { service, action, ...params } = await req.json();

    switch (service) {
      case "openrouter":
        return await handleOpenRouter(action, params);
      case "github":
        return await handleGitHub(action, params);
      default:
        return jsonResponse({ error: `Unknown service: ${service}` }, 400);
    }
  } catch (error: any) {
    console.error("AI Proxy Error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});

async function handleOpenRouter(action: string, params: any) {
  const API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!API_KEY) return jsonResponse({ error: "OPENROUTER_API_KEY not configured" }, 500);

  switch (action) {
    case "chat": {
      const { prompt, temperature = 0.3, maxTokens = 4000 } = params;
      const model = resolveAllowedModel(params.model);
      if (!model) return jsonResponse({ error: "Requested model is not in the free-model allowlist" }, 400);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          ...withSupportedSampling(model, temperature),
          max_tokens: maxTokens,
        }),
      });
      return jsonResponse(await res.json(), res.status);
    }

    case "chat_with_system": {
      const { systemPrompt, userPrompt, temperature = 0.3 } = params;
      const model = resolveAllowedModel(params.model);
      if (!model) return jsonResponse({ error: "Requested model is not in the free-model allowlist" }, 400);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          ...withSupportedSampling(model, temperature),
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
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=${order}&per_page=${perPage}`;
      const res = await fetch(url, { headers });
      return jsonResponse(await res.json(), res.status);
    }

    default:
      return jsonResponse({ error: `Unknown GitHub action: ${action}` }, 400);
  }
}
