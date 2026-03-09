import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { load } from "npm:cheerio@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENROUTER_MODEL = "stepfun/step-3.5-flash:free";
const MAX_HTML_CHARS = 180000;
const MAX_TEXT_CHARS = 24000;
const ADMIN_EMAIL = "primoboostai@gmail.com";

interface ExtractJobRequest {
  jobUrl?: string;
}

interface ExtractedJobPayload {
  company_name: string;
  company_logo_url: string;
  role_title: string;
  domain: string;
  package_amount: string;
  package_type: string;
  location_type: string;
  city: string;
  experience_required: string;
  qualification: string;
  eligible_graduation_years: string;
  required_skills: string[] | string;
  short_description: string;
  full_job_description: string;
  application_link: string;
  posted_date: string;
  source_url: string;
  source_platform: string;
  logo_reused_from_database?: boolean;
}

interface SourceMetadata {
  title: string;
  description: string;
  siteName: string;
  image: string;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripHtmlTags = (value: string) => value.replace(/<[^>]+>/g, " ");

const safeString = (value: unknown) => {
  if (typeof value === "string") return cleanWhitespace(stripHtmlTags(value));
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const isMissingColumnError = (error: unknown, column: string) => {
  if (!error || typeof error !== "object") return false;

  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return (
    code === "PGRST204" ||
    code === "42703" ||
    message.toLowerCase().includes(column.toLowerCase())
  );
};

const normalizeArrayToStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  value.forEach((entry) => {
    const nextValue = safeString(entry);
    if (!nextValue) return;

    const dedupeKey = nextValue.toLowerCase();
    if (seen.has(dedupeKey)) return;

    seen.add(dedupeKey);
    normalized.push(nextValue);
  });

  return normalized;
};

const normalizeCompanyNameForMatch = (value: string) =>
  cleanWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(inc|corp|corporation|ltd|llc|limited|pvt|private|company|co|technologies|technology|solutions|solution|services|service|holdings|group)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

const extractCompanySearchTokens = (companyName: string): string[] => {
  const seen = new Set<string>();
  const tokens: string[] = [];

  normalizeCompanyNameForMatch(companyName)
    .split(" ")
    .filter((token) => token.length >= 4)
    .forEach((token) => {
      if (seen.has(token)) return;
      seen.add(token);
      tokens.push(token);
    });

  return tokens.slice(0, 3);
};

const getBrandingLogo = (row: Record<string, unknown>) =>
  safeString(row.company_logo_url) || safeString(row.company_logo);

const scoreCompanyNameMatch = (candidateName: string, targetName: string) => {
  if (!candidateName || !targetName) return 0;
  if (candidateName === targetName) return 100;
  if (candidateName.includes(targetName) || targetName.includes(candidateName)) return 80;

  const candidateTokens = new Set(candidateName.split(" ").filter(Boolean));
  const targetTokens = targetName.split(" ").filter(Boolean);
  const overlapCount = targetTokens.filter((token) => candidateTokens.has(token)).length;

  return overlapCount * 10;
};

const tryParseJson = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parseAiJsonObject = (rawResponse: string): Record<string, unknown> => {
  const trimmed = rawResponse.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  const parseCandidate = (json: string) => {
    const parsed = JSON.parse(json);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("AI response must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  };

  try {
    return parseCandidate(candidate);
  } catch {
    const objectStart = candidate.indexOf("{");
    const objectEnd = candidate.lastIndexOf("}");
    if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
      throw new Error("AI returned invalid JSON for the job extractor.");
    }
    return parseCandidate(candidate.slice(objectStart, objectEnd + 1));
  }
};

const detectSourcePlatform = (jobUrl: string): string => {
  const lower = jobUrl.toLowerCase();

  if (lower.includes("myworkdayjobs.com") || lower.includes("workday")) return "workday";
  if (lower.includes("boards.greenhouse.io") || lower.includes("greenhouse.io")) return "greenhouse";
  if (lower.includes("joinsuperset.com") || lower.includes("superset.com")) return "superset";
  if (lower.includes("jobs.lever.co") || lower.includes("lever.co")) return "lever";

  return "generic";
};

const flattenJsonLdNodes = (value: unknown): Array<Record<string, unknown>> => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenJsonLdNodes(entry));
  }

  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const nodes = [record];

  if (Array.isArray(record["@graph"])) {
    nodes.push(...record["@graph"].flatMap((entry) => flattenJsonLdNodes(entry)));
  }

  return nodes;
};

const findJobPostingNode = (nodes: Array<Record<string, unknown>>): Record<string, unknown> | null => {
  for (const node of nodes) {
    const rawType = node["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    const normalizedTypes = types
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.toLowerCase());

    if (normalizedTypes.includes("jobposting")) {
      return node;
    }
  }

  return null;
};

const extractLocationFromJobPosting = (jobPosting: Record<string, unknown>): string => {
  const rawLocation = jobPosting.jobLocation;
  const locations = Array.isArray(rawLocation) ? rawLocation : [rawLocation];

  for (const locationEntry of locations) {
    if (!locationEntry || typeof locationEntry !== "object") continue;

    const locationRecord = locationEntry as Record<string, unknown>;
    const address = locationRecord.address;
    if (!address || typeof address !== "object") continue;

    const addressRecord = address as Record<string, unknown>;
    const parts = [
      safeString(addressRecord.addressLocality),
      safeString(addressRecord.addressRegion),
      safeString(addressRecord.addressCountry),
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  return "";
};

const extractSalaryFromJobPosting = (jobPosting: Record<string, unknown>): string => {
  const baseSalary = jobPosting.baseSalary;
  if (!baseSalary || typeof baseSalary !== "object") return "";

  const record = baseSalary as Record<string, unknown>;
  const currency = safeString(record.currency);
  const value = record.value;

  if (value && typeof value === "object") {
    const valueRecord = value as Record<string, unknown>;
    const minValue = safeString(valueRecord.minValue);
    const maxValue = safeString(valueRecord.maxValue);
    const singleValue = safeString(valueRecord.value);
    const unitText = safeString(valueRecord.unitText);

    if (minValue && maxValue) {
      return `${currency} ${minValue} - ${maxValue} ${unitText}`.trim();
    }

    if (singleValue) {
      return `${currency} ${singleValue} ${unitText}`.trim();
    }
  }

  return "";
};

const buildStructuredHints = (
  jobPosting: Record<string, unknown> | null,
  metadata: SourceMetadata,
  jobUrl: string,
  sourcePlatform: string
) => {
  const companyRecord =
    jobPosting?.hiringOrganization && typeof jobPosting.hiringOrganization === "object"
      ? (jobPosting.hiringOrganization as Record<string, unknown>)
      : null;

  return {
    company_name: companyRecord ? safeString(companyRecord.name) : "",
    company_logo_url: companyRecord ? safeString(companyRecord.logo) : "",
    role_title: jobPosting ? safeString(jobPosting.title) : "",
    location_type:
      (jobPosting && Boolean(jobPosting.jobLocationType) && safeString(jobPosting.jobLocationType)) ||
      "",
    city: jobPosting ? extractLocationFromJobPosting(jobPosting) : "",
    experience_required: "",
    qualification: jobPosting ? safeString(jobPosting.qualifications) : "",
    eligible_graduation_years: "",
    required_skills: "",
    short_description: metadata.description || (jobPosting ? safeString(jobPosting.description).slice(0, 220) : ""),
    full_job_description: jobPosting ? safeString(jobPosting.description) : metadata.description,
    application_link: (jobPosting && safeString(jobPosting.url)) || jobUrl,
    posted_date: (jobPosting && safeString(jobPosting.datePosted)) || "",
    package_amount: jobPosting ? extractSalaryFromJobPosting(jobPosting) : "",
    package_type: "",
    domain: "",
    source_url: jobUrl,
    source_platform: sourcePlatform,
  };
};

const fetchHtml = async (jobUrl: string): Promise<string> => {
  const response = await fetch(jobUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch the job page (${response.status}).`);
  }

  return (await response.text()).slice(0, MAX_HTML_CHARS);
};

const extractPageData = (html: string) => {
  const $ = load(html);

  const metadata: SourceMetadata = {
    title: cleanWhitespace(
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='twitter:title']").attr("content") ||
      $("title").text() ||
      ""
    ),
    description: cleanWhitespace(
      $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='twitter:description']").attr("content") ||
      ""
    ),
    siteName: cleanWhitespace(
      $("meta[property='og:site_name']").attr("content") ||
      $("meta[name='application-name']").attr("content") ||
      ""
    ),
    image: cleanWhitespace(
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image']").attr("content") ||
      ""
    ),
  };

  const jsonLdScripts = $("script[type='application/ld+json']")
    .map((_, element) => $(element).contents().text())
    .get()
    .map((raw) => raw.trim())
    .filter(Boolean);

  const jsonLdNodes = jsonLdScripts
    .map((raw) => tryParseJson(raw))
    .flatMap((entry) => flattenJsonLdNodes(entry));

  const jobPosting = findJobPostingNode(jsonLdNodes);

  $("script, style, noscript, svg").remove();
  const textContent = cleanWhitespace($("body").text()).slice(0, MAX_TEXT_CHARS);

  return {
    metadata,
    jobPosting,
    textContent,
    jsonLdNodes: jsonLdNodes.slice(0, 12),
  };
};

const callOpenRouterForJobExtraction = async (
  sourcePlatform: string,
  jobUrl: string,
  metadata: SourceMetadata,
  structuredHints: Record<string, unknown>,
  textContent: string,
  jsonLdNodes: Array<Record<string, unknown>>
): Promise<Record<string, unknown>> => {
  const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const systemPrompt = [
    "You extract job data from career pages into a strict JSON object.",
    "Return only valid JSON. No markdown. No explanation.",
    "Use exactly these keys:",
    "company_name, company_logo_url, role_title, domain, package_amount, package_type, location_type, city, experience_required, qualification, eligible_graduation_years, required_skills, short_description, full_job_description, application_link, posted_date, source_url, source_platform.",
    "Use strings for all scalar fields. required_skills can be either an array of strings or a comma-separated string.",
    "Use location_type only as Remote, Onsite, Hybrid, or empty string.",
    "Use package_type only as CTC, stipend, hourly, or empty string.",
    "Do not invent company_logo_url. Leave it empty unless clearly present in the supplied data.",
    "Do not invent salary or qualification. Leave them empty if not present.",
    "Keep short_description concise and keep full_job_description informative.",
  ].join(" ");

  const userPrompt = [
    `Source platform: ${sourcePlatform}`,
    `Job URL: ${jobUrl}`,
    "",
    "Structured hints already extracted from the page:",
    JSON.stringify(structuredHints, null, 2),
    "",
    "Page metadata:",
    JSON.stringify(metadata, null, 2),
    "",
    "Relevant JSON-LD nodes:",
    JSON.stringify(jsonLdNodes, null, 2),
    "",
    "Visible page text excerpt:",
    textContent,
  ].join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof responseJson?.error?.message === "string"
        ? responseJson.error.message
        : "OpenRouter job extraction request failed."
    );
  }

  const content = safeString(responseJson?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return parseAiJsonObject(content);
};

const normalizeExtractedJobPayload = (
  raw: Record<string, unknown>,
  fallback: Record<string, unknown>
): ExtractedJobPayload => {
  const skills = Array.isArray(raw.required_skills)
    ? normalizeArrayToStringArray(raw.required_skills)
    : safeString(raw.required_skills);

  const packageAmount =
    safeString(raw.package_amount) ||
    safeString(fallback.package_amount);

  const shortDescription =
    safeString(raw.short_description) ||
    safeString(fallback.short_description);

  const fullDescription =
    safeString(raw.full_job_description) ||
    safeString(fallback.full_job_description) ||
    shortDescription;

  return {
    company_name: safeString(raw.company_name) || safeString(fallback.company_name),
    company_logo_url: safeString(raw.company_logo_url),
    role_title: safeString(raw.role_title) || safeString(fallback.role_title),
    domain: safeString(raw.domain) || safeString(fallback.domain),
    package_amount: packageAmount,
    package_type: safeString(raw.package_type),
    location_type: safeString(raw.location_type) || safeString(fallback.location_type),
    city: safeString(raw.city) || safeString(fallback.city),
    experience_required:
      safeString(raw.experience_required) || safeString(fallback.experience_required),
    qualification: safeString(raw.qualification) || safeString(fallback.qualification),
    eligible_graduation_years:
      safeString(raw.eligible_graduation_years) || safeString(fallback.eligible_graduation_years),
    required_skills: skills,
    short_description: shortDescription,
    full_job_description: fullDescription,
    application_link:
      safeString(raw.application_link) || safeString(fallback.application_link),
    posted_date: safeString(raw.posted_date) || safeString(fallback.posted_date),
    source_url: safeString(raw.source_url) || safeString(fallback.source_url),
    source_platform: safeString(raw.source_platform) || safeString(fallback.source_platform),
  };
};

const selectBrandingRows = async (
  supabase: ReturnType<typeof createClient>,
  filterValue: string
): Promise<Array<Record<string, unknown>>> => {
  const selectVariants = [
    "company_name, company_logo_url, company_logo",
    "company_name, company_logo",
    "company_name, company_logo_url",
  ];

  for (const columns of selectVariants) {
    const { data, error } = await supabase
      .from("job_listings")
      .select(columns)
      .ilike("company_name", filterValue)
      .order("updated_at", { ascending: false })
      .limit(12);

    if (!error) {
      return data || [];
    }

    if (
      !isMissingColumnError(error, "company_logo_url") &&
      !isMissingColumnError(error, "company_logo")
    ) {
      console.warn("extract-job-from-url: branding lookup failed:", error);
      return [];
    }
  }

  return [];
};

const findExistingCompanyBranding = async (
  supabase: ReturnType<typeof createClient>,
  companyName: string
): Promise<{ company_logo_url: string }> => {
  const normalizedCompanyName = cleanWhitespace(companyName);
  if (!normalizedCompanyName) {
    return { company_logo_url: "" };
  }

  const collectedRows: Array<Record<string, unknown>> = [];
  const seenRows = new Set<string>();
  const searchFilters = [
    normalizedCompanyName,
    `%${normalizedCompanyName}%`,
    ...extractCompanySearchTokens(normalizedCompanyName).map((token) => `%${token}%`),
  ];

  for (const filterValue of searchFilters) {
    const rows = await selectBrandingRows(supabase, filterValue);
    rows.forEach((row) => {
      const key = `${safeString(row.company_name)}|${getBrandingLogo(row)}`;
      if (!key || seenRows.has(key)) return;
      seenRows.add(key);
      collectedRows.push(row);
    });

    if (collectedRows.some((row) => scoreCompanyNameMatch(
      normalizeCompanyNameForMatch(safeString(row.company_name)),
      normalizeCompanyNameForMatch(normalizedCompanyName)
    ) >= 80)) {
      break;
    }
  }

  const targetName = normalizeCompanyNameForMatch(normalizedCompanyName);
  const bestCandidate = collectedRows
    .filter((row) => Boolean(getBrandingLogo(row)))
    .sort((left, right) => {
      const leftScore = scoreCompanyNameMatch(
        normalizeCompanyNameForMatch(safeString(left.company_name)),
        targetName
      );
      const rightScore = scoreCompanyNameMatch(
        normalizeCompanyNameForMatch(safeString(right.company_name)),
        targetName
      );
      return rightScore - leftScore;
    })[0];

  return {
    company_logo_url: bestCandidate ? getBrandingLogo(bestCandidate) : "",
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobUrl }: ExtractJobRequest = await req.json();
    const normalizedJobUrl = safeString(jobUrl);

    if (!normalizedJobUrl) {
      return jsonResponse({ success: false, error: "jobUrl is required." }, 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedJobUrl);
    } catch {
      return jsonResponse({ success: false, error: "Enter a valid job URL." }, 400);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return jsonResponse({ success: false, error: "Only http and https URLs are supported." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization header missing." }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized request." }, 401);
    }

    const appMetadata =
      user.app_metadata && typeof user.app_metadata === "object"
        ? (user.app_metadata as Record<string, unknown>)
        : {};
    const userMetadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : {};
    const userRole = safeString(appMetadata.role) || safeString(userMetadata.role);
    const isAdmin =
      safeString(user.email).toLowerCase() === ADMIN_EMAIL || userRole.toLowerCase() === "admin";

    if (!isAdmin) {
      return jsonResponse({ success: false, error: "Admin access required." }, 403);
    }

    const sourcePlatform = detectSourcePlatform(parsedUrl.toString());
    const html = await fetchHtml(parsedUrl.toString());
    const { metadata, jobPosting, textContent, jsonLdNodes } = extractPageData(html);
    const structuredHints = buildStructuredHints(
      jobPosting,
      metadata,
      parsedUrl.toString(),
      sourcePlatform
    );

    let aiResult: Record<string, unknown> = {};
    try {
      aiResult = await callOpenRouterForJobExtraction(
        sourcePlatform,
        parsedUrl.toString(),
        metadata,
        structuredHints,
        textContent,
        jsonLdNodes
      );
    } catch (error) {
      console.error("extract-job-from-url: AI normalization failed, using structured fallback:", error);
    }

    const extractedJob = normalizeExtractedJobPayload(aiResult, structuredHints);

    if (!extractedJob.company_name || !extractedJob.role_title) {
      return jsonResponse(
        {
          success: false,
          error: "Could not extract enough job details from this URL. Try a different page or paste the raw details manually.",
        },
        422
      );
    }

    const existingBranding = await findExistingCompanyBranding(supabase, extractedJob.company_name);
    if (!extractedJob.company_logo_url && existingBranding.company_logo_url) {
      extractedJob.company_logo_url = existingBranding.company_logo_url;
      extractedJob.logo_reused_from_database = true;
    }

    return jsonResponse({ success: true, job: extractedJob });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to extract the job from the URL.";
    console.error("extract-job-from-url:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
