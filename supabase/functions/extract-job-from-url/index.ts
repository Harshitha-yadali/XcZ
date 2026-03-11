import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { load } from "npm:cheerio@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_HTML_CHARS = 180000;
const MAX_TEXT_CHARS = 24000;
const ADMIN_EMAIL = "primoboostai@gmail.com";
const SPIRE_PUBLIC_API_BASE = "https://io.spire2grow.com/ies/v1/p";
const SPIRE_PUBLIC_ASSET_BASE = "https://io-public.spire2grow.com";
const SPIRE_SEARCH_PAGE_SIZE = 250;
const LEGACY_OPENROUTER_MODEL = "stepfun/step-3.5-flash:free";
const DEFAULT_OPENAI_BULK_MODEL = "gpt-5-mini";
const DEFAULT_OPENAI_STANDARD_MODEL = "gpt-5";
const DEFAULT_OPENAI_PRIORITY_MODEL = "gpt-5.2";
const DEFAULT_OPENROUTER_BULK_MODEL = "openai/gpt-5-mini";
const DEFAULT_OPENROUTER_STANDARD_MODEL = "openai/gpt-5";
const DEFAULT_OPENROUTER_PRIORITY_MODEL = "openai/gpt-5.2";

type ExtractionAiMode = "bulk" | "standard" | "priority";
type ExtractionAiProvider = "openai" | "openrouter";

interface ExtractJobRequest {
  jobUrl?: string;
  aiMode?: ExtractionAiMode;
  priority?: boolean | null;
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
  expires_at: string;
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

interface SupersetJobProfileResponse {
  identifier?: string | null;
  title?: string | null;
  location?: string | null;
  companyDeadlineForApplications?: number | null;
  jobApplicationDeadline?: number | null;
  positionType?: string | null;
  processType?: string | null;
  companyCode?: string | null;
  companyLogoDocumentId?: string | null;
  companyName?: string | null;
  jobDescription?: string | null;
  ctcMin?: number | null;
  ctcCurrency?: string | null;
  ctcInterval?: string | null;
  ctcHasAdditionalComponents?: boolean | null;
  ctcAdditionalInfo?: string | null;
  categoryName?: string | null;
  jobProfileOutlineUuid?: string | null;
}

interface SupersetJobProfileOutlineResponse {
  title?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  companyLogoDocumentId?: string | null;
  companyDeadlineForApplications?: number | null;
  location?: string | null;
  status?: string | null;
  sectorCode?: string[] | null;
  sectorMap?: Record<string, string> | null;
  allowedBatches?: Array<string | number> | null;
  allowedProgramLevels?: Array<string | number> | null;
  allowedPrograms?: Array<Record<string, unknown> | string> | null;
  majors?: Array<Record<string, unknown> | string> | null;
}

interface SpireWorkspaceStaticContentResponse {
  workspaceId?: string | null;
  contentSettings?: {
    general?: {
      name?: string | null;
      siteBrand?: string | null;
      faviconImageUrl?: string | null;
      logoProperties?: {
        url?: string | null;
      } | null;
    } | null;
  } | null;
}

interface SpireCountResponse {
  totalCount?: number | null;
}

interface SpireExperienceRange {
  from?: number | null;
  to?: number | null;
}

interface SpireSkillResponse {
  skill?: string | null;
  isMandatory?: boolean | null;
  reqId?: string | null;
}

interface SpireLocationResponse {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  fqLocationName?: string | null;
}

interface SpireJobPostingResponse {
  startDate?: number | null;
  endDate?: number | null;
  status?: string | null;
}

interface SpireRequisitionResponse {
  id?: string | null;
  displayId?: string | null;
  workspaceId?: string | null;
  jobTitle?: string | null;
  requiredExperienceInMonths?: SpireExperienceRange | null;
  jobType?: string | null;
  skills?: Array<SpireSkillResponse | string> | null;
  jobLocation?: Array<SpireLocationResponse> | null;
  requiredEducation?: Array<Record<string, unknown> | string> | null;
  departmentName?: string | null;
  employmentType?: string | null;
  jobPosting?: SpireJobPostingResponse | null;
  createdOn?: number | null;
  updatedOn?: number | null;
  jobDescription?: string | null;
  aboutCompany?: string | null;
  isFresherJob?: boolean | null;
}

interface SpireRequisitionSearchResponse {
  entities?: SpireRequisitionResponse[] | null;
}

interface ParamCompanyDetailsResponse {
  company_name?: string | null;
  company_logo?: string | null;
  company_banner?: string | null;
  other_details?: {
    about?: string | null;
    website?: string | null;
  } | null;
}

interface ParamJobResponse {
  id?: string | null;
  title?: string | null;
  req_id?: number | null;
  slug?: string | null;
  created_at?: string | null;
  published_on_career_page?: string | null;
  locations?: Array<string> | null;
  description?: string | null;
  job_type?: string | null;
  min_exp?: number | null;
  max_exp?: number | null;
  experience_units?: string | null;
  is_remote?: boolean | null;
  category?: string | null;
  business_unit_name?: string | null;
  organization_name?: string | null;
  apply_url?: string | null;
}

interface ParamJobDetailsResponse {
  job?: ParamJobResponse | null;
}

interface GreenhouseLocationResponse {
  name?: string | null;
}

interface GreenhouseMetadataFieldResponse {
  id?: number | null;
  name?: string | null;
  value?: unknown;
  value_type?: string | null;
}

interface GreenhouseDepartmentResponse {
  id?: number | null;
  name?: string | null;
  child_ids?: Array<number> | null;
  parent_id?: number | null;
}

interface GreenhouseOfficeResponse {
  id?: number | null;
  name?: string | null;
  location?: string | null;
  child_ids?: Array<number> | null;
  parent_id?: number | null;
}

interface GreenhouseJobResponse {
  absolute_url?: string | null;
  internal_job_id?: number | null;
  location?: GreenhouseLocationResponse | null;
  metadata?: Array<GreenhouseMetadataFieldResponse> | null;
  id?: number | null;
  updated_at?: string | null;
  requisition_id?: string | null;
  title?: string | null;
  company_name?: string | null;
  first_published?: string | null;
  language?: string | null;
  content?: string | null;
  departments?: Array<GreenhouseDepartmentResponse> | null;
  offices?: Array<GreenhouseOfficeResponse> | null;
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

const decodeEscapedHtmlFragment = (value: string): string => {
  if (!value) return "";
  if (!/&lt;\/?[a-z][^&]*&gt;/i.test(value)) return value;
  return load(`<div id="decode-root">${value}</div>`)("#decode-root").text();
};

const htmlFragmentToText = (value: string): string => {
  if (!value) return "";
  const normalizedValue = decodeEscapedHtmlFragment(value);
  const $ = load(`<div id="extract-root">${normalizedValue}</div>`);
  $("#extract-root br").replaceWith(" ");
  $("#extract-root p, #extract-root div, #extract-root li, #extract-root h1, #extract-root h2, #extract-root h3, #extract-root h4, #extract-root h5, #extract-root h6")
    .each((_, element) => {
      $(element).append(" ");
    });
  return cleanWhitespace($("#extract-root").text());
};

const htmlFragmentToList = (value: string): string[] => {
  if (!value) return [];
  const normalizedValue = decodeEscapedHtmlFragment(value);
  const $ = load(`<div id="extract-root">${normalizedValue}</div>`);
  const listItems = $("#extract-root li")
    .map((_, element) => cleanWhitespace($(element).text()))
    .get()
    .filter(Boolean);

  return listItems;
};

const resolveUrl = (value: string, baseUrl: string): string => {
  const normalized = cleanWhitespace(value);
  if (!normalized) return "";

  try {
    if (normalized.startsWith("//")) {
      return new URL(`https:${normalized}`).toString();
    }

    return new URL(normalized, baseUrl).toString();
  } catch {
    return normalized;
  }
};

const normalizePostedDate = (value: string): string => {
  const normalized = cleanWhitespace(value.replace(/^posted on:\s*/i, ""));
  if (!normalized) return "";

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
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
  if (
    lower.includes("boards.greenhouse.io") ||
    lower.includes("job-boards.greenhouse.io") ||
    lower.includes("greenhouse.io") ||
    lower.includes("gh_jid=") ||
    lower.includes("gh_src=")
  ) {
    return "greenhouse";
  }
  if (lower.includes("joinsuperset.com") || lower.includes("superset.com")) return "superset";
  if (lower.includes("app.param.ai")) return "paramai";
  if (
    lower.includes("careers.irissoftware.com") ||
    lower.includes("sapsf.com") ||
    lower.includes("successfactors.com")
  ) {
    return "successfactors";
  }
  if (lower.includes("jobs.tatacommunications.com")) return "spire2grow";
  if (lower.includes("jobs.lever.co") || lower.includes("lever.co")) return "lever";

  return "generic";
};

const buildDefaultRequestHeaders = () => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
});

const fetchJson = async <T>(
  url: string,
  extraHeaders: Record<string, string> = {}
): Promise<T> => {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "application/json,text/plain,*/*",
      ...buildDefaultRequestHeaders(),
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch the job page (${response.status}).`);
  }

  return await response.json() as T;
};

const fetchText = async (
  url: string,
  extraHeaders: Record<string, string> = {}
): Promise<string> => {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "text/plain,application/json,text/html,*/*",
      ...buildDefaultRequestHeaders(),
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch the job page (${response.status}).`);
  }

  return await response.text();
};

const extractSupersetJobProfileId = (jobUrl: string): string => {
  const match = jobUrl.match(/jobprofiles\/([0-9a-f-]{36})/i);
  if (!match?.[1]) {
    throw new Error("Could not find a Superset job profile id in the URL.");
  }

  return match[1];
};

const buildSupersetLogoUrl = (documentId: unknown): string => {
  const normalizedId = safeString(documentId);
  return normalizedId ? `https://greekturtle-prod.s3.amazonaws.com/${normalizedId}` : "";
};

const inferQualificationFromText = (value: string): string => {
  const source = value.toLowerCase();
  const qualifications = [
    { pattern: /\bm\.?\s*tech\b/, label: "M.Tech" },
    { pattern: /\bb\.?\s*tech\b/, label: "B.Tech" },
    { pattern: /\bm(?:[./-]\s*|\s+)e\b/, label: "M.E" },
    { pattern: /\bb(?:[./-]\s*|\s+)e\b/, label: "B.E" },
    { pattern: /\bmca\b/, label: "MCA" },
    { pattern: /\bbca\b/, label: "BCA" },
    { pattern: /\bmba\b/, label: "MBA" },
    { pattern: /\bbsc\b/, label: "BSc" },
    { pattern: /\bmsc\b/, label: "MSc" },
    { pattern: /\bphd\b/, label: "PhD" },
  ];

  const matched = qualifications
    .filter(({ pattern }) => pattern.test(source))
    .map(({ label }) => label);

  return matched.join(", ");
};

const inferExperienceFromText = (value: string): string => {
  const normalized = cleanWhitespace(value);
  if (!normalized) return "";

  const batchMatch = normalized.match(/\bbatch(?:es)?(?:\s+of)?\s+(20\d{2})\b/i);
  if (batchMatch?.[1]) {
    return `Freshers / Batch of ${batchMatch[1]}`;
  }

  const fresherMatch = normalized.match(/\bfresher(?:s)?\b/i);
  if (fresherMatch) {
    return "Freshers";
  }

  if (/\b(intern|internship)\b/i.test(normalized)) {
    return "Internship / Freshers";
  }

  if (
    /\b(early in career|early-career|entry[-\s]?level|graduate(?:s)?|post[-\s]?grad|post graduate|trainee)\b/i.test(
      normalized
    )
  ) {
    return "Freshers";
  }

  const yearsMatch = normalized.match(/\b(\d+\+?(?:\s*-\s*\d+\+?)?\s*(?:years?|yrs?))\b/i);
  return yearsMatch?.[1] ? cleanWhitespace(yearsMatch[1]) : "";
};

const inferLocationTypeFromText = (value: string): string => {
  const normalized = value.toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("hybrid")) return "Hybrid";
  if (normalized.includes("remote") || normalized.includes("work from home") || normalized.includes("wfh")) {
    return "Remote";
  }
  if (normalized.includes("onsite") || normalized.includes("on-site") || normalized.includes("office")) {
    return "Onsite";
  }
  return "";
};

const inferEligibleYearsFromSuperset = (
  outline: SupersetJobProfileOutlineResponse | null,
  value: string
): string => {
  const batchValues = (outline?.allowedBatches || [])
    .map((entry) => safeString(entry))
    .filter(Boolean);

  if (batchValues.length > 0) {
    return batchValues.join(", ");
  }

  const matches = Array.from(value.matchAll(/\b(20\d{2})\b/g)).map((match) => match[1]);
  const unique = Array.from(new Set(matches));
  return unique.join(", ");
};

const formatSupersetPackageAmount = (profile: SupersetJobProfileResponse): string => {
  const rawAmount = typeof profile.ctcMin === "number" ? profile.ctcMin : Number.parseFloat(safeString(profile.ctcMin));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return "";

  const amount = String(rawAmount);

  const currency = safeString(profile.ctcCurrency);
  const interval = safeString(profile.ctcInterval).toLowerCase();
  const intervalLabel =
    interval === "annum" ? "per annum" :
    interval === "month" ? "per month" :
    interval === "hour" ? "per hour" :
    "";

  return [currency, amount, intervalLabel].filter(Boolean).join(" ");
};

const formatSupersetPackageType = (profile: SupersetJobProfileResponse): string => {
  const rawAmount = typeof profile.ctcMin === "number" ? profile.ctcMin : Number.parseFloat(safeString(profile.ctcMin));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return "";
  }

  const interval = safeString(profile.ctcInterval).toLowerCase();
  if (interval === "annum") return "CTC";
  if (interval === "month") return "stipend";
  if (interval === "hour") return "hourly";
  return "";
};

const formatSupersetPostedDate = (profile: SupersetJobProfileResponse): string => {
  const rawDate =
    profile.jobApplicationDeadline ||
    profile.companyDeadlineForApplications ||
    null;

  if (typeof rawDate !== "number" || !Number.isFinite(rawDate)) {
    return "";
  }

  return new Date(rawDate).toISOString();
};

const formatSupersetExpiryDate = (
  profile: SupersetJobProfileResponse,
  outline: SupersetJobProfileOutlineResponse | null
): string => {
  const rawDate =
    profile.companyDeadlineForApplications ||
    profile.jobApplicationDeadline ||
    outline?.companyDeadlineForApplications ||
    null;

  if (typeof rawDate !== "number" || !Number.isFinite(rawDate)) {
    return "";
  }

  return new Date(rawDate).toISOString();
};

const normalizeSupersetLocationType = (value: string): string => {
  const normalized = value.toLowerCase();
  if (normalized.includes("hybrid")) return "Hybrid";
  if (normalized.includes("remote")) return "Remote";
  return value ? "Onsite" : "";
};

const inferSupersetDomain = (
  profile: SupersetJobProfileResponse,
  outline: SupersetJobProfileOutlineResponse | null
): string => {
  const sectorCodes = outline?.sectorCode || [];
  const sectorMap = outline?.sectorMap || {};

  const mappedSector = sectorCodes
    .map((code) => safeString(sectorMap[code]))
    .find(Boolean);

  return (
    mappedSector ||
    safeString(profile.categoryName) ||
    safeString(profile.positionType) ||
    safeString(profile.processType)
  );
};

const extractSupersetStructuredData = async (jobUrl: string): Promise<{
  metadata: SourceMetadata;
  structuredHints: Record<string, unknown>;
  textContent: string;
  supplementalNodes: Array<Record<string, unknown>>;
}> => {
  const profileId = extractSupersetJobProfileId(jobUrl);
  const { origin } = new URL(jobUrl);
  const profile = await fetchJson<SupersetJobProfileResponse>(
    `${origin}/tnpsuite-core/companies/job-profiles/${profileId}`
  );

  let outline: SupersetJobProfileOutlineResponse | null = null;
  if (profile.jobProfileOutlineUuid) {
    try {
      outline = await fetchJson<SupersetJobProfileOutlineResponse>(
        `${origin}/tnpsuite-core/companies/job-profile-outlines/${profile.jobProfileOutlineUuid}`
      );
    } catch (error) {
      console.warn("extract-job-from-url: Superset outline lookup failed:", error);
    }
  }

  const rawJobDescription =
    typeof profile.jobDescription === "string" ? profile.jobDescription : "";
  const rawCtcAdditionalInfo =
    typeof profile.ctcAdditionalInfo === "string" ? profile.ctcAdditionalInfo : "";
  const jobDescriptionText = htmlFragmentToText(rawJobDescription);
  const ctcAdditionalInfoText = htmlFragmentToText(rawCtcAdditionalInfo);
  const fullDescription = [jobDescriptionText, ctcAdditionalInfoText]
    .filter(Boolean)
    .join("\n\n");
  const qualificationSource = [
    safeString(profile.title),
    jobDescriptionText,
    (outline?.allowedProgramLevels || []).map((entry) => safeString(entry)).join(", "),
    (outline?.allowedPrograms || [])
      .map((entry) =>
        typeof entry === "string"
          ? cleanWhitespace(entry)
          : safeString(entry.name) || safeString(entry.programName) || safeString(entry.title)
      )
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(" ");
  const experienceSource = [
    safeString(profile.title),
    jobDescriptionText,
  ]
    .filter(Boolean)
    .join(" ");
  const location = safeString(profile.location) || safeString(outline?.location);
  const companyLogoUrl =
    buildSupersetLogoUrl(profile.companyLogoDocumentId) ||
    buildSupersetLogoUrl(outline?.companyLogoDocumentId);
  const inferredSkills = mergeUniqueStrings(
    htmlFragmentToList(rawJobDescription),
    inferSpireSkillsFromText(jobDescriptionText)
  );

  const structuredHints = {
    company_name: safeString(profile.companyName) || safeString(outline?.companyName),
    company_logo_url: companyLogoUrl,
    role_title: safeString(profile.title) || safeString(outline?.title),
    domain: inferSupersetDomain(profile, outline),
    package_amount: formatSupersetPackageAmount(profile),
    package_type: formatSupersetPackageType(profile),
    location_type: normalizeSupersetLocationType(location),
    city: location,
    experience_required: inferExperienceFromText(experienceSource),
    qualification: fallbackRequiredField(inferQualificationFromText(qualificationSource), "Not specified"),
    eligible_graduation_years: inferEligibleYearsFromSuperset(outline, qualificationSource),
    required_skills: inferredSkills,
    short_description: jobDescriptionText.slice(0, 220),
    full_job_description: fullDescription,
    application_link: jobUrl,
    posted_date: formatSupersetPostedDate(profile),
    expires_at: formatSupersetExpiryDate(profile, outline),
    source_url: jobUrl,
    source_platform: "superset",
  };

  const metadata: SourceMetadata = {
    title: safeString(structuredHints.role_title),
    description: safeString(structuredHints.short_description),
    siteName: "Superset",
    image: companyLogoUrl,
  };

  const textContent = [
    safeString(structuredHints.company_name),
    safeString(structuredHints.role_title),
    safeString(structuredHints.domain),
    jobDescriptionText,
    ctcAdditionalInfoText,
    JSON.stringify({
      sectorCode: outline?.sectorCode || [],
      sectorMap: outline?.sectorMap || {},
      allowedBatches: outline?.allowedBatches || [],
      allowedProgramLevels: outline?.allowedProgramLevels || [],
      allowedPrograms: outline?.allowedPrograms || [],
    }),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);

  const supplementalNodes = [
    profile as Record<string, unknown>,
    outline as Record<string, unknown> | null,
  ]
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .slice(0, 2);

  return { metadata, structuredHints, textContent, supplementalNodes };
};

const extractSpireDisplayId = (jobUrl: string): string => {
  const matches = Array.from(jobUrl.matchAll(/(\d{6,})/g)).map((match) => match[1]);
  const displayId = matches[matches.length - 1];

  if (!displayId) {
    throw new Error("Could not find a Tata Communications job id in the URL.");
  }

  return displayId;
};

const buildSpireHeaders = (workspaceId: string): Record<string, string> => ({
  workspaceId,
  "Content-Type": "application/json",
});

const buildSpireLogoUrl = (workspaceId: string): string =>
  workspaceId ? `${SPIRE_PUBLIC_ASSET_BASE}/${workspaceId}/appLogoColored.png` : "";

const formatSpirePostedDate = (job: SpireRequisitionResponse): string => {
  const rawDate =
    job.jobPosting?.startDate ??
    job.createdOn ??
    job.updatedOn ??
    null;

  if (typeof rawDate !== "number" || !Number.isFinite(rawDate)) {
    return "";
  }

  return new Date(rawDate).toISOString();
};

const formatSpireExpiryDate = (job: SpireRequisitionResponse): string => {
  const rawDate = job.jobPosting?.endDate ?? null;

  if (typeof rawDate !== "number" || !Number.isFinite(rawDate)) {
    return "";
  }

  return new Date(rawDate).toISOString();
};

const formatSpireLocation = (job: SpireRequisitionResponse): string => {
  const locations = (job.jobLocation || [])
    .map((entry) => {
      const fqLocationName = safeString(entry.fqLocationName);
      if (fqLocationName) return fqLocationName;

      return cleanWhitespace(
        [
          safeString(entry.city),
          safeString(entry.state),
          safeString(entry.country),
        ]
          .filter(Boolean)
          .join(", ")
      );
    })
    .filter(Boolean);

  return Array.from(new Set(locations)).join(" | ");
};

const normalizeSpireLocationType = (location: string, description: string): string => {
  const normalized = `${location} ${description}`.toLowerCase();
  if (normalized.includes("hybrid")) return "Hybrid";
  if (normalized.includes("remote")) return "Remote";
  return location ? "Onsite" : "";
};

const formatYearsFromMonths = (months: number): string => {
  const years = Math.round((months / 12) * 10) / 10;
  return Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1);
};

const formatSpireExperience = (
  range: SpireExperienceRange | null | undefined,
  isFresherJob: boolean
): string => {
  const from = typeof range?.from === "number" ? range.from : null;
  const to = typeof range?.to === "number" ? range.to : null;

  if (from === 0 && to === 0 && isFresherJob) {
    return "Freshers";
  }

  if (from !== null && to !== null && to > 0) {
    const prefix = isFresherJob && from === 0 ? "Freshers / " : "";
    if (from === to) {
      return `${prefix}${formatYearsFromMonths(to)} years`;
    }
    return `${prefix}${formatYearsFromMonths(from)} - ${formatYearsFromMonths(to)} years`;
  }

  if (to !== null && to > 0) {
    const prefix = isFresherJob ? "Freshers / " : "";
    return `${prefix}${formatYearsFromMonths(to)} years`;
  }

  if (from !== null && from > 0) {
    return `${formatYearsFromMonths(from)}+ years`;
  }

  return isFresherJob ? "Freshers" : "";
};

const extractSpireSkills = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const skills: string[] = [];

  value.forEach((entry) => {
    const nextValue =
      typeof entry === "string"
        ? cleanWhitespace(entry)
        : entry && typeof entry === "object"
          ? safeString((entry as Record<string, unknown>).skill)
          : "";

    const normalizedValue = canonicalizeSpireSkill(nextValue);
    if (!normalizedValue) return;

    const dedupeKey = normalizedValue.toLowerCase();
    if (seen.has(dedupeKey)) return;

    seen.add(dedupeKey);
    skills.push(normalizedValue);
  });

  return skills;
};

const extractSpireEducation = (value: unknown): string => {
  if (!Array.isArray(value)) return "";

  const normalized = value
    .map((entry) => {
      if (typeof entry === "string") return cleanWhitespace(entry);
      if (!entry || typeof entry !== "object") return "";

      const record = entry as Record<string, unknown>;
      return (
        safeString(record.degree) ||
        safeString(record.education) ||
        safeString(record.name) ||
        safeString(record.title) ||
        safeString(record.label)
      );
    })
    .filter(Boolean);

  return Array.from(new Set(normalized)).join(", ");
};

const fallbackRequiredField = (value: string, fallback: string): string => {
  const normalized = cleanWhitespace(value);
  return normalized || fallback;
};

const SPIRE_SKILL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Java", pattern: /\bjava\b/i },
  { label: "C#", pattern: /\bc#\b/i },
  { label: "C++", pattern: /\bc\+\+\b/i },
  { label: "Python", pattern: /\bpython\b/i },
  { label: "JavaScript", pattern: /\bjavascript\b/i },
  { label: "TypeScript", pattern: /\btypescript\b/i },
  { label: "React", pattern: /\breact(?:\.js|js)?\b/i },
  { label: "Angular", pattern: /\bangular\b/i },
  { label: "Node.js", pattern: /\bnode(?:\.js|js)?\b/i },
  { label: "Full Stack Development", pattern: /\bfull[-\s]stack\b/i },
  { label: "Spring Boot", pattern: /\bspring\s*boot\b|\bspringboot\b/i },
  { label: "Spring", pattern: /\bspring\b/i },
  { label: "REST APIs", pattern: /\brest(?:ful)?\s*apis?\b|\brestapi\b/i },
  { label: "SQL", pattern: /\bsql(?:\s+databases?)?\b/i },
  { label: "MySQL", pattern: /\bmysql\b/i },
  { label: "PostgreSQL", pattern: /\bpostgres(?:ql)?\b/i },
  { label: "HTML", pattern: /\bhtml\b/i },
  { label: "CSS", pattern: /\bcss\b/i },
  { label: "Git", pattern: /\bgit\b/i },
  { label: "Apache Subversion", pattern: /\bapache\s+subversion\b/i },
  { label: "SVN", pattern: /\bsvn\b/i },
  { label: "Version Control", pattern: /\bversion\s+control(?:\s+practices?)?\b/i },
  { label: "Data Structures", pattern: /\bdata\s+structures?\b/i },
  { label: "Algorithms", pattern: /\balgorithms?\b/i },
  { label: "Object Oriented Programming", pattern: /\bobject[-\s]oriented\s+programming\b|\boop\b/i },
  { label: "Debugging", pattern: /\bdebugg(?:ing|er)?\b/i },
  { label: "Problem Solving", pattern: /\bproblem[-\s]solving\b/i },
  { label: "AWS", pattern: /\baws\b|amazon web services/i },
  { label: "Azure", pattern: /\bazure\b/i },
  { label: "GCP", pattern: /\bgcp\b|google cloud/i },
  { label: "Docker", pattern: /\bdocker\b/i },
  { label: "Kubernetes", pattern: /\bkubernetes\b|\bk8s\b/i },
  { label: "Linux", pattern: /\blinux\b/i },
  { label: "Networking", pattern: /\bnetwork(?:ing|s)?\b/i },
  { label: "Network Monitoring", pattern: /\bnetwork\s+monitoring\b/i },
  { label: "Packet Analysis", pattern: /\bpacket\s+(?:analysis|data)\b/i },
  { label: "TCP/IP", pattern: /\btcp\s*\/?\s*ip\b/i },
  { label: "Routing", pattern: /\brouting\b/i },
  { label: "Switching", pattern: /\bswitching\b/i },
  { label: "VoIP", pattern: /\bvoip\b/i },
  { label: "IoT", pattern: /\biot\b|internet of things/i },
  { label: "Juniper", pattern: /\bjuniper\b/i },
  { label: "Nokia", pattern: /\bnokia\b/i },
  { label: "IP/MPLS", pattern: /\bip\/mpls\b|\bmpls\b/i },
  { label: "Ethernet", pattern: /\bethernet\b/i },
  { label: "ServiceNow", pattern: /\bservicenow\b/i },
  { label: "Remedy", pattern: /\bremedy\b/i },
  { label: "ITIL", pattern: /\bitil\b/i },
  { label: "Netscout", pattern: /\bnetscout\b/i },
  { label: "LogRhythm", pattern: /\blogrhythm\b/i },
  { label: "MITRE ATT&CK", pattern: /\bmitre\s+att(?:&|and)?ck\b/i },
  { label: "Threat Hunting", pattern: /\bthreat[-\s]hunting\b/i },
  { label: "Threat Intelligence", pattern: /\bthreat\s+intelligence\b/i },
  { label: "Incident Response", pattern: /\bincident\s+response\b/i },
  { label: "Incident Management", pattern: /\bincident\s+management\b/i },
  { label: "CEH", pattern: /\bceh\b/i },
  { label: "CSA", pattern: /\bcsa\b/i },
];

const SPIRE_SKILL_STOPWORDS = new Set([
  "ability",
  "analytical",
  "communication",
  "communication skills",
  "customer centric",
  "documentation",
  "hands on learning",
  "learning",
  "motivated",
  "relevant experience",
  "technical staff",
  "willingness",
  "willingness to learn",
]);

const toTitleCase = (value: string) =>
  value.replace(/\b[a-z]/g, (match) => match.toUpperCase());

const canonicalizeSpireSkill = (value: string): string => {
  let normalized = cleanWhitespace(stripHtmlTags(value))
    .replace(/^[^a-z0-9+#./&-]+|[^a-z0-9+#./&-]+$/gi, "")
    .replace(/\s+/g, " ");

  if (!normalized) return "";

  for (const { label, pattern } of SPIRE_SKILL_PATTERNS) {
    if (pattern.test(normalized)) return label;
  }

  normalized = normalized
    .replace(/\bpractices?\b/gi, "")
    .replace(/\bdatabases?\b/gi, "")
    .replace(/\btools?\b/gi, "")
    .replace(/\bskills?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const lowered = normalized.toLowerCase();
  if (!lowered || SPIRE_SKILL_STOPWORDS.has(lowered)) return "";
  if (normalized.length < 2 || normalized.length > 40) return "";
  if (/[,:;]/.test(normalized)) return "";
  if (
    /\b(able to|ability to|customer centric|experience|flexible|learn|motivated|required|understanding)\b/i.test(
      normalized
    )
  ) {
    return "";
  }

  if (!/^[a-z0-9+#./&-]+(?:\s+[a-z0-9+#./&-]+){0,3}$/i.test(normalized)) {
    return "";
  }

  if (/^[A-Z0-9+#./&-]+(?:\s+[A-Z0-9+#./&-]+)*$/.test(normalized)) {
    return normalized;
  }

  return toTitleCase(normalized.toLowerCase());
};

const mergeUniqueStrings = (...values: string[][]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.flat().forEach((value) => {
    const nextValue = cleanWhitespace(value);
    if (!nextValue) return;

    const dedupeKey = nextValue.toLowerCase();
    if (seen.has(dedupeKey)) return;

    seen.add(dedupeKey);
    normalized.push(nextValue);
  });

  return normalized;
};

const inferSpireQualificationFromText = (value: string): string => {
  const text = cleanWhitespace(value);
  if (!text) return "";

  const explicitSnippet =
    text.match(/qualification\s*[:-]\s*([^.\n]{4,160})/i)?.[1] ||
    text.match(/education\s*[:-]\s*([^.\n]{4,160})/i)?.[1] ||
    "";

  const qualifications: string[] = [];
  const addQualification = (nextValue: string) => {
    if (qualifications.includes(nextValue)) return;
    qualifications.push(nextValue);
  };

  if (/\bb(?:\.?\s*tech|tech)\b/i.test(text)) addQualification("B.Tech");
  if (/\bm(?:\.?\s*tech|tech)\b/i.test(text)) addQualification("M.Tech");
  if (/\bb\.\s*e\b|\bb\s*\/\s*e\b|\bb\s+e\b/i.test(text)) addQualification("B.E");
  if (/\bm\.\s*e\b|\bm\s*\/\s*e\b|\bm\s+e\b/i.test(text)) addQualification("M.E");
  if (/\bmca\b/i.test(text)) addQualification("MCA");
  if (/\bbca\b/i.test(text)) addQualification("BCA");
  if (/\bmba\b/i.test(text)) addQualification("MBA");
  if (/\bb\.?\s*sc\b|\bbsc\b/i.test(text)) addQualification("BSc");
  if (/\bm\.?\s*sc\b|\bmsc\b/i.test(text)) addQualification("MSc");
  if (/\bbachelor(?:'s)?\s+degree\b/i.test(text)) addQualification("Bachelor's degree");
  if (/\bmaster(?:'s)?\s+degree\b/i.test(text)) addQualification("Master's degree");

  const fields = [
    /computer science/i.test(text) ? "Computer Science" : "",
    /information technology|\bit\b/i.test(text) ? "Information Technology" : "",
    /electronics/i.test(text) ? "Electronics" : "",
    /electrical/i.test(text) ? "Electrical" : "",
    /telecommunications?/i.test(text) ? "Telecommunications" : "",
  ].filter(Boolean);

  if (qualifications.length > 0) {
    const fieldSuffix = fields.length > 0 ? ` in ${Array.from(new Set(fields)).join(", ")}` : "";
    const relatedFieldSuffix = /related field/i.test(text) ? " or related field" : "";
    return `${qualifications.join(" / ")}${fieldSuffix}${relatedFieldSuffix}`;
  }

  return cleanWhitespace(explicitSnippet);
};

const inferEligibleYearsFromText = (value: string): string => {
  const text = cleanWhitespace(value);
  if (!text) return "";

  const contextualMatches = Array.from(
    text.matchAll(
      /(?:batch(?:es)?|graduat(?:ion|ing|e)|pass(?:ed)?\s*out|eligible(?:\s+graduation)?\s+years?|year of passing)[^.\n]{0,80}/gi
    )
  )
    .map((match) => match[0])
    .join(" ");

  const yearSource = contextualMatches || text;
  const years = Array.from(yearSource.matchAll(/\b20\d{2}\b/g)).map((match) => match[0]);

  return Array.from(new Set(years)).join(", ");
};

const inferCompensationFromText = (value: string): { packageAmount: string; packageType: string } => {
  const text = cleanWhitespace(value);
  if (!text) return { packageAmount: "", packageType: "" };

  const rangeLpaMatch = text.match(
    /(?:ctc|salary|package|compensation)?[^.\n]{0,24}?(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:-|–|to)\s*([\d,]+(?:\.\d+)?)\s*(lpa|lakhs?\s+per\s+annum|lakhs?\b)/i
  );
  if (rangeLpaMatch) {
    const amount = Number.parseFloat(rangeLpaMatch[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      return {
        packageAmount: String(Math.round(amount * 100000)),
        packageType: "CTC",
      };
    }
  }

  const singleLpaMatch = text.match(
    /(?:ctc|salary|package|compensation)?[^.\n]{0,24}?(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(lpa|lakhs?\s+per\s+annum|lakhs?\b)/i
  );
  if (singleLpaMatch) {
    const amount = Number.parseFloat(singleLpaMatch[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      return {
        packageAmount: String(Math.round(amount * 100000)),
        packageType: "CTC",
      };
    }
  }

  const stipendMatch = text.match(
    /(?:stipend|monthly compensation|per month)[^.\n]{0,24}?(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i
  );
  if (stipendMatch) {
    return {
      packageAmount: stipendMatch[1].replace(/,/g, ""),
      packageType: "stipend",
    };
  }

  const annualRangeMatch = text.match(
    /(?:base\s+salary|salary(?:\s+range)?|package|compensation|pay\s+range)[^.\n]{0,48}?(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)?\s*([\d,]{4,}(?:\.\d+)?)\s*(?:-|–|to)\s*(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)?\s*([\d,]{4,}(?:\.\d+)?)(?:\s*(?:per annum|annum|annual|pa|\/year|yearly))?/i
  );
  if (annualRangeMatch) {
    return {
      packageAmount: annualRangeMatch[1].replace(/,/g, ""),
      packageType: "CTC",
    };
  }

  const annualMatch = text.match(
    /(?:ctc|base\s+salary|salary(?:\s+range)?|package|compensation|pay\s+range)[^.\n]{0,48}?(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)?\s*([\d,]{5,})(?:\s*(?:per annum|annum|annual|pa|\/year|yearly))?/i
  );
  if (annualMatch) {
    return {
      packageAmount: annualMatch[1].replace(/,/g, ""),
      packageType: "CTC",
    };
  }

  const hourlyMatch = text.match(
    /(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:per hour|\/hour|hourly)/i
  );
  if (hourlyMatch) {
    return {
      packageAmount: hourlyMatch[1].replace(/,/g, ""),
      packageType: "hourly",
    };
  }

  return { packageAmount: "", packageType: "" };
};

const findGreenhouseJobId = (jobUrl: string, html = ""): string => {
  const queryCandidates: string[] = [];

  try {
    const parsedUrl = new URL(jobUrl);
    queryCandidates.push(
      parsedUrl.searchParams.get("gh_jid") || "",
      parsedUrl.searchParams.get("job") || "",
      parsedUrl.searchParams.get("job_id") || "",
      parsedUrl.searchParams.get("jobid") || "",
      parsedUrl.searchParams.get("role") || ""
    );
  } catch {
    // Ignore invalid URLs here; the main request validation handles them separately.
  }

  const pathCandidates = [
    jobUrl.match(/\/jobs\/(\d{6,})(?:[/?#-]|$)/i)?.[1] || "",
    jobUrl.match(/\/job\/(\d{6,})(?:[/?#-]|$)/i)?.[1] || "",
  ];

  const htmlCandidates = [
    html.match(/[?&](?:gh_jid|job(?:_id)?|role)=([0-9]{6,})/i)?.[1] || "",
    html.match(/Grnhse\.Iframe\.load\((\d{6,})\)/i)?.[1] || "",
  ];

  return [...queryCandidates, ...pathCandidates, ...htmlCandidates]
    .map((candidate) => cleanWhitespace(candidate))
    .find((candidate) => /^\d{6,}$/.test(candidate)) || "";
};

const extractGreenhouseJobId = (jobUrl: string, html = ""): string => {
  const jobId = findGreenhouseJobId(jobUrl, html);
  if (!jobId) {
    throw new Error("Could not find a Greenhouse job id in the URL.");
  }

  return jobId;
};

const findGreenhouseBoardToken = (jobUrl: string, html = ""): string => {
  const candidates: string[] = [];

  try {
    const parsedUrl = new URL(jobUrl);
    const host = parsedUrl.hostname.toLowerCase();
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const jobsIndex = pathSegments.findIndex((segment) => segment.toLowerCase() === "jobs");

    if (host.includes("greenhouse.io")) {
      if (jobsIndex > 0) {
        candidates.push(pathSegments[jobsIndex - 1] || "");
      }
      if (pathSegments[0] && pathSegments[0].toLowerCase() !== "embed") {
        candidates.push(pathSegments[0]);
      }
      candidates.push(parsedUrl.searchParams.get("for") || "");
    }
  } catch {
    // Ignore invalid URLs here; the main request validation handles them separately.
  }

  const htmlCandidates = [
    html.match(/boards-api\.greenhouse\.io\/v1\/boards\/([^/"'?&\s]+)\/jobs/i)?.[1] || "",
    html.match(/boards\.greenhouse\.io\/embed\/job_(?:board|app)\/js\?for=([^&"' \s]+)/i)?.[1] || "",
  ];

  return [...candidates, ...htmlCandidates]
    .map((candidate) => cleanWhitespace(candidate))
    .find(Boolean) || "";
};

const extractGreenhouseBoardToken = (jobUrl: string, html = ""): string => {
  const boardToken = findGreenhouseBoardToken(jobUrl, html);
  if (!boardToken) {
    throw new Error("Could not find a Greenhouse board token for this job page.");
  }

  return boardToken;
};

const extractGreenhouseMetadataValues = (
  metadata: Array<GreenhouseMetadataFieldResponse> | null | undefined,
  fieldName: string
): string[] => {
  return (metadata || [])
    .filter((entry) => safeString(entry.name).toLowerCase() === fieldName.toLowerCase())
    .flatMap((entry) => Array.isArray(entry.value)
      ? normalizeArrayToStringArray(entry.value)
      : safeString(entry.value)
        ? [safeString(entry.value)]
        : []);
};

const extractGreenhouseStructuredData = async (
  jobUrl: string,
  preloadedHtml?: string
): Promise<{
  metadata: SourceMetadata;
  structuredHints: Record<string, unknown>;
  textContent: string;
  supplementalNodes: Array<Record<string, unknown>>;
}> => {
  const html = preloadedHtml ?? await fetchHtml(jobUrl);
  const pageData = extractPageData(html);
  const jobId = extractGreenhouseJobId(jobUrl, html);
  const boardToken = extractGreenhouseBoardToken(jobUrl, html);
  const job = await fetchJson<GreenhouseJobResponse>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${jobId}?content=true`
  );

  const roleTitle = safeString(job.title) || pageData.metadata.title;
  const companyName = safeString(job.company_name) || pageData.metadata.siteName || "Greenhouse";
  const descriptionHtml = typeof job.content === "string" ? decodeEscapedHtmlFragment(job.content) : "";
  const descriptionText = htmlFragmentToText(descriptionHtml);
  const workingLocationValues = extractGreenhouseMetadataValues(job.metadata, "Working Location");
  const employmentTypeValues = extractGreenhouseMetadataValues(job.metadata, "Employment Type");
  const geoValues = extractGreenhouseMetadataValues(job.metadata, "Geo");
  const departmentNames = normalizeArrayToStringArray(
    (job.departments || []).map((entry) => safeString(entry.name))
  );
  const officeLocations = normalizeArrayToStringArray(
    (job.offices || []).map((entry) => safeString(entry.location) || safeString(entry.name))
  );
  const location =
    safeString(job.location?.name) ||
    officeLocations.join(" | ");
  const locationType =
    inferLocationTypeFromText([
      location,
      workingLocationValues.join(", "),
      descriptionText,
    ].filter(Boolean).join("\n")) || (location ? "Onsite" : "");
  const qualification = fallbackRequiredField(
    inferSpireQualificationFromText(descriptionText),
    "Not specified"
  );
  const experienceRequired = fallbackRequiredField(
    inferExperienceFromText(`${roleTitle}\n${descriptionText}`),
    "Not specified"
  );
  const requiredSkills = inferSpireSkillsFromText(`${roleTitle}\n${descriptionText}`);
  const inferredCompensation = inferCompensationFromText(descriptionText);
  const eligibleGraduationYears = inferEligibleYearsFromText(descriptionText);
  const domain = fallbackRequiredField(
    departmentNames[0] || inferSuccessFactorsDomain(roleTitle, descriptionText),
    "General"
  );
  const shortDescription = (descriptionText || pageData.metadata.description).slice(0, 220);

  const structuredHints = {
    company_name: companyName,
    company_logo_url: "",
    role_title: roleTitle,
    domain,
    package_amount: inferredCompensation.packageAmount,
    package_type: inferredCompensation.packageType,
    location_type: locationType,
    city: location,
    experience_required: experienceRequired,
    qualification,
    eligible_graduation_years: eligibleGraduationYears,
    required_skills: requiredSkills,
    short_description: shortDescription,
    full_job_description: descriptionText || shortDescription,
    application_link: safeString(job.absolute_url) || jobUrl,
    posted_date: safeString(job.first_published) || safeString(job.updated_at),
    expires_at: "",
    source_url: jobUrl,
    source_platform: "greenhouse",
  };

  const metadata: SourceMetadata = {
    title: roleTitle,
    description: shortDescription,
    siteName: companyName,
    image: pageData.metadata.image,
  };

  const textContent = [
    companyName,
    roleTitle,
    location,
    locationType,
    employmentTypeValues.join(", "),
    geoValues.join(", "),
    departmentNames.join(", "),
    experienceRequired,
    qualification,
    requiredSkills.join(", "),
    descriptionText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);

  const supplementalNodes = [
    job as unknown as Record<string, unknown>,
    {
      board_token: boardToken,
      job_id: jobId,
      employment_type: employmentTypeValues,
      working_location: workingLocationValues,
      geo: geoValues,
    },
  ];

  return { metadata, structuredHints, textContent, supplementalNodes };
};

const inferSpireSkillsFromText = (value: string): string[] => {
  const text = cleanWhitespace(value);
  if (!text) return [];

  const matchedSkills = SPIRE_SKILL_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);

  const phraseSources = [
    ...Array.from(
      text.matchAll(
        /(?:skills?|competencies|skills?\s*&\s*competencies|technologies?|languages?)\s*[:-]\s*([^.\n]{4,180})/gi
      )
    ).map((match) => match[1]),
    ...Array.from(
      text.matchAll(
        /(?:knowledge of|experience with|hands[-\s]on experience with|proficiency in|understanding of|familiarity with|technologies? such as|languages? such as)\s*([^.\n]{4,180})/gi
      )
    ).map((match) => match[1]),
  ];

  const phraseMatches = phraseSources.flatMap((snippet) =>
    snippet
      .split(/,|;|\bor\b|\band\b/gi)
      .map((entry) => canonicalizeSpireSkill(entry))
      .filter(Boolean)
  );

  return mergeUniqueStrings(matchedSkills, phraseMatches);
};

const inferSpireDomain = (
  departmentName: string,
  jobType: string,
  roleTitle: string,
  description: string
): string => {
  const combined = `${roleTitle} ${description}`.toLowerCase();
  const looksInternalCode = /^[A-Z0-9]{4,8}$/.test(departmentName);

  if (departmentName && !looksInternalCode) {
    return departmentName;
  }

  if (combined.includes("software") || combined.includes("developer") || combined.includes("application development")) {
    if (combined.includes("intern")) return "Software Development / Internship";
    if (combined.includes("trainee")) return "Software Development / Graduate Trainee";
    return "Software Development";
  }

  if (combined.includes("iot")) return "IoT";
  if (combined.includes("network")) return "Networking";
  if (combined.includes("security")) return "Security";
  if (combined.includes("data")) return "Data / Analytics";

  return departmentName || jobType;
};

const inferSuccessFactorsDomain = (roleTitle: string, description: string): string => {
  const title = roleTitle.toLowerCase();
  const combined = `${roleTitle} ${description}`.toLowerCase();
  const traineeLikeTitle = /\b(graduate|trainee|intern|entry[-\s]?level)\b/i.test(roleTitle);
  const titleHasStrongTechnicalSignal =
    /\b(java|python|react|node|developer|software|engineer|sdet|qa|test|cloud|aws|azure|data|analytics|security|network)\b/i.test(
      roleTitle
    );

  if (traineeLikeTitle && !titleHasStrongTechnicalSignal) {
    return "Graduate Trainee";
  }

  if (/\b(sdet|qa|quality|testing|test automation)\b/.test(title)) {
    return traineeLikeTitle ? "Quality Engineering / Graduate Trainee" : "Quality Engineering";
  }

  if (/\b(cloud|devops|aws|azure|gcp)\b/.test(title) && /\b(java|python|react|node|developer|software|engineer|application)\b/.test(title)) {
    return traineeLikeTitle ? "Software Development / Graduate Trainee" : "Software Development";
  }

  if (/\b(java|python|react|node|developer|software|full stack|frontend|backend|engineer|application)\b/.test(title)) {
    return traineeLikeTitle ? "Software Development / Graduate Trainee" : "Software Development";
  }

  if (/\b(cloud|devops|aws|azure|gcp)\b/.test(title)) {
    return traineeLikeTitle ? "Cloud / DevOps / Graduate Trainee" : "Cloud / DevOps";
  }

  if (/\b(data|analytics|mlops|machine learning|artificial intelligence|ai)\b/.test(title)) {
    return traineeLikeTitle ? "Data / Analytics / Graduate Trainee" : "Data / Analytics";
  }

  if (/\b(security|soc|threat)\b/.test(title)) {
    return traineeLikeTitle ? "Security / Graduate Trainee" : "Security";
  }

  if (/\b(network|networking)\b/.test(title)) {
    return traineeLikeTitle ? "Networking / Graduate Trainee" : "Networking";
  }

  if (/\b(sdet|qa|quality|testing|test automation)\b/.test(combined)) {
    return traineeLikeTitle ? "Quality Engineering / Graduate Trainee" : "Quality Engineering";
  }

  if (/\b(cloud|devops|aws|azure|gcp)\b/.test(combined)) {
    return traineeLikeTitle ? "Cloud / DevOps / Graduate Trainee" : "Cloud / DevOps";
  }

  if (/\b(data|analytics|mlops|machine learning|artificial intelligence|ai)\b/.test(combined)) {
    return traineeLikeTitle ? "Data / Analytics / Graduate Trainee" : "Data / Analytics";
  }

  if (/\b(security|soc|threat)\b/.test(combined)) {
    return traineeLikeTitle ? "Security / Graduate Trainee" : "Security";
  }

  if (/\b(network|networking)\b/.test(combined)) {
    return traineeLikeTitle ? "Networking / Graduate Trainee" : "Networking";
  }

  if (/\b(java|python|react|node|developer|software|full stack|frontend|backend|engineer|application)\b/.test(combined)) {
    return traineeLikeTitle ? "Software Development / Graduate Trainee" : "Software Development";
  }

  if (traineeLikeTitle) {
    return "Graduate Trainee";
  }

  return "";
};

const inferSuccessFactorsExperience = (roleTitle: string, description: string): string => {
  const inferredFromText = inferExperienceFromText(`${roleTitle}\n${description}`);
  if (inferredFromText) return inferredFromText;

  if (/\b(intern|internship)\b/i.test(roleTitle)) return "Internship / Freshers";
  if (/\b(graduate|trainee|entry[-\s]?level|fresher)\b/i.test(`${roleTitle}\n${description}`)) {
    return "Freshers";
  }

  return "Not specified";
};

const extractParamJobSlug = (jobUrl: string): string => {
  const match = jobUrl.match(/\/jobs\/([^/?#]+)/i);
  if (!match?.[1]) {
    throw new Error("Could not find a Param job slug in the URL.");
  }

  return match[1];
};

const extractParamStructuredData = async (jobUrl: string): Promise<{
  metadata: SourceMetadata;
  structuredHints: Record<string, unknown>;
  textContent: string;
  supplementalNodes: Array<Record<string, unknown>>;
}> => {
  const parsedUrl = new URL(jobUrl);
  const jobSlug = extractParamJobSlug(jobUrl);
  const origin = parsedUrl.origin;

  const [companyDetails, jobDetails] = await Promise.all([
    fetchJson<ParamCompanyDetailsResponse>(`${origin}/api/career/get_company_details/`),
    fetchJson<ParamJobDetailsResponse>(`${origin}/api/career/get_job/${jobSlug}/`),
  ]);

  const job = jobDetails.job;
  if (!job) {
    throw new Error("Could not find Param job details for this URL.");
  }

  const roleTitle = safeString(job.title);
  const descriptionHtml = typeof job.description === "string" ? job.description : "";
  const descriptionText = htmlFragmentToText(descriptionHtml);
  const companyName = safeString(companyDetails.company_name) || "Param";
  const companyLogoUrl = safeString(companyDetails.company_logo);
  const location = (job.locations || [])
    .map((entry) => safeString(entry))
    .filter(Boolean)
    .join(", ");
  const locationType = job.is_remote
    ? "Remote"
    : inferLocationTypeFromText(`${location}\n${descriptionText}`) || (location ? "Onsite" : "");
  const qualification = fallbackRequiredField(
    inferSpireQualificationFromText(descriptionText),
    "Not specified"
  );
  const experienceRequired = fallbackRequiredField(
    inferExperienceFromText(`${roleTitle}\n${descriptionText}`),
    "Not specified"
  );
  const requiredSkills = inferSpireSkillsFromText(`${roleTitle}\n${descriptionText}`);
  const inferredCompensation = inferCompensationFromText(descriptionText);
  const eligibleGraduationYears = inferEligibleYearsFromText(descriptionText);
  const domain = fallbackRequiredField(
    inferSuccessFactorsDomain(roleTitle, descriptionText) ||
      safeString(job.business_unit_name) ||
      safeString(job.category) ||
      safeString(job.organization_name),
    "General"
  );
  const shortDescription = (descriptionText || safeString(companyDetails.other_details?.about)).slice(0, 220);

  const structuredHints = {
    company_name: companyName,
    company_logo_url: companyLogoUrl,
    role_title: roleTitle,
    domain,
    package_amount: inferredCompensation.packageAmount,
    package_type: inferredCompensation.packageType,
    location_type: locationType,
    city: location,
    experience_required: experienceRequired,
    qualification,
    eligible_graduation_years: eligibleGraduationYears,
    required_skills: requiredSkills,
    short_description: shortDescription,
    full_job_description: descriptionText || shortDescription,
    application_link: jobUrl,
    posted_date: safeString(job.published_on_career_page) || safeString(job.created_at),
    expires_at: "",
    source_url: jobUrl,
    source_platform: "paramai",
  };

  const metadata: SourceMetadata = {
    title: roleTitle,
    description: shortDescription,
    siteName: companyName,
    image: companyLogoUrl || safeString(companyDetails.company_banner),
  };

  const textContent = [
    companyName,
    roleTitle,
    domain,
    locationType,
    location,
    experienceRequired,
    qualification,
    requiredSkills.join(", "),
    descriptionText,
    safeString(companyDetails.other_details?.about),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);

  const supplementalNodes = [
    job as unknown as Record<string, unknown>,
    companyDetails as unknown as Record<string, unknown>,
  ];

  return { metadata, structuredHints, textContent, supplementalNodes };
};

const extractSuccessFactorsStructuredData = async (jobUrl: string): Promise<{
  metadata: SourceMetadata;
  structuredHints: Record<string, unknown>;
  textContent: string;
  supplementalNodes: Array<Record<string, unknown>>;
}> => {
  const html = await fetchHtml(jobUrl);
  const $ = load(html);
  const jobRoot = $(".jobDisplayShell[itemtype*='JobPosting']").first();

  if (!jobRoot.length) {
    throw new Error("Could not find SuccessFactors job details on this page.");
  }

  const roleTitle =
    cleanWhitespace(jobRoot.find("#job-title").first().text()) ||
    cleanWhitespace(jobRoot.find("[itemprop='title']").first().text()) ||
    cleanWhitespace($("meta[property='og:title']").attr("content") || "");
  const companyName =
    cleanWhitespace($("#job-company span").first().text()) ||
    cleanWhitespace(jobRoot.find("meta[itemprop='hiringOrganization']").attr("content") || "");
  const location =
    cleanWhitespace($("#job-location .jobGeoLocation").first().text()) ||
    cleanWhitespace(
      [
        jobRoot.find("meta[itemprop='addressLocality']").attr("content") || "",
        jobRoot.find("meta[itemprop='addressRegion']").attr("content") || "",
        jobRoot.find("meta[itemprop='addressCountry']").attr("content") || "",
      ]
        .filter(Boolean)
        .join(", ")
    );
  const rawDescriptionHtml = jobRoot.find(".jobdescription").first().html() || "";
  const descriptionText = htmlFragmentToText(rawDescriptionHtml);
  const logoUrl = resolveUrl(
    $(".custom-header-logo img.logo").first().attr("src") ||
      $("img.logo").first().attr("src") ||
      $("meta[property='og:image']").attr("content") ||
      "",
    jobUrl
  );
  const postedDate = normalizePostedDate(
    jobRoot.find("meta[itemprop='datePosted']").attr("content") ||
      $("#job-date").text() ||
      ""
  );
  const expiresAt = normalizePostedDate(
    jobRoot.find("meta[itemprop='validThrough']").attr("content") || ""
  );
  const shortDescription = (descriptionText || cleanWhitespace($("meta[name='description']").attr("content") || ""))
    .slice(0, 220);
  const domain = fallbackRequiredField(
    inferSuccessFactorsDomain(roleTitle, descriptionText),
    "General"
  );
  const qualification = fallbackRequiredField(
    inferSpireQualificationFromText(descriptionText),
    "Not specified"
  );
  const experienceRequired = inferSuccessFactorsExperience(roleTitle, descriptionText);
  const requiredSkills = inferSpireSkillsFromText(`${roleTitle}\n${descriptionText}`);
  const inferredCompensation = inferCompensationFromText(descriptionText);
  const eligibleGraduationYears = inferEligibleYearsFromText(descriptionText);

  const structuredHints = {
    company_name: companyName,
    company_logo_url: logoUrl,
    role_title: roleTitle,
    domain,
    package_amount: inferredCompensation.packageAmount,
    package_type: inferredCompensation.packageType,
    location_type: location ? "Onsite" : "",
    city: location,
    experience_required: experienceRequired,
    qualification,
    eligible_graduation_years: eligibleGraduationYears,
    required_skills: requiredSkills,
    short_description: shortDescription,
    full_job_description: descriptionText || shortDescription,
    application_link: jobUrl,
    posted_date: postedDate,
    expires_at: expiresAt,
    source_url: jobUrl,
    source_platform: "successfactors",
  };

  const metadata: SourceMetadata = {
    title: roleTitle,
    description: shortDescription,
    siteName: companyName,
    image: logoUrl,
  };

  const textContent = [
    companyName,
    roleTitle,
    location,
    domain,
    experienceRequired,
    qualification,
    requiredSkills.join(", "),
    descriptionText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);

  const supplementalNodes = [
    {
      title: roleTitle,
      companyName,
      location,
      postedDate,
      description: descriptionText,
      logoUrl,
    },
  ];

  return { metadata, structuredHints, textContent, supplementalNodes };
};

const findSpireRequisitionByDisplayId = async (
  workspaceId: string,
  displayId: string
): Promise<SpireRequisitionResponse | null> => {
  let totalCount = 0;

  try {
    const countResponse = await fetchJson<SpireCountResponse>(
      `${SPIRE_PUBLIC_API_BASE}/requisition/_count`,
      buildSpireHeaders(workspaceId)
    );
    totalCount = typeof countResponse.totalCount === "number" ? countResponse.totalCount : 0;
  } catch (error) {
    console.warn("extract-job-from-url: Spire count lookup failed:", error);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / SPIRE_SEARCH_PAGE_SIZE));

  for (let page = 1; page <= totalPages; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      size: String(SPIRE_SEARCH_PAGE_SIZE),
      selectedSortOrder: "desc",
      selectedSortField: "postedOn",
    });
    const searchResponse = await fetchJson<SpireRequisitionSearchResponse>(
      `${SPIRE_PUBLIC_API_BASE}/requisition/_search?${query.toString()}`,
      buildSpireHeaders(workspaceId)
    );
    const job = (searchResponse.entities || []).find(
      (entry) => safeString(entry.displayId) === displayId
    );

    if (job) {
      return job;
    }
  }

  return null;
};

const extractSpireStructuredData = async (jobUrl: string): Promise<{
  metadata: SourceMetadata;
  structuredHints: Record<string, unknown>;
  textContent: string;
  supplementalNodes: Array<Record<string, unknown>>;
}> => {
  const parsedUrl = new URL(jobUrl);
  const displayId = extractSpireDisplayId(jobUrl);
  const workspaceId = cleanWhitespace(
    await fetchText(
      `${SPIRE_PUBLIC_API_BASE}/workspaceId?domain=${encodeURIComponent(parsedUrl.hostname)}`
    )
  );

  if (!workspaceId) {
    throw new Error("Could not resolve the public workspace for this career portal.");
  }

  let staticContent: SpireWorkspaceStaticContentResponse | null = null;
  try {
    staticContent = await fetchJson<SpireWorkspaceStaticContentResponse>(
      `${SPIRE_PUBLIC_API_BASE}/workspace/static-content/${workspaceId}`,
      buildSpireHeaders(workspaceId)
    );
  } catch (error) {
    console.warn("extract-job-from-url: Spire static-content lookup failed:", error);
  }

  const job = await findSpireRequisitionByDisplayId(workspaceId, displayId);
  if (!job) {
    throw new Error(
      "This Tata Communications job page loads dynamically, and the posting could not be found in the public API. The job may be expired or unavailable."
    );
  }

  const companyNameRaw =
    safeString(staticContent?.contentSettings?.general?.name) ||
    safeString(staticContent?.contentSettings?.general?.siteBrand) ||
    "Tata Communications";
  const companyName =
    companyNameRaw.toUpperCase() === "TATA COMMUNICATIONS"
      ? "Tata Communications"
      : companyNameRaw;
  const fallbackLogoUrl =
    safeString(staticContent?.contentSettings?.general?.logoProperties?.url) ||
    buildSpireLogoUrl(workspaceId);
  const rawJobDescription =
    typeof job.jobDescription === "string" ? job.jobDescription : "";
  const jobDescriptionText = htmlFragmentToText(rawJobDescription);
  const aboutCompanyText = safeString(job.aboutCompany);
  const fullDescription = [
    jobDescriptionText,
    aboutCompanyText ? `About company: ${aboutCompanyText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const location = formatSpireLocation(job);
  const descriptionBasedSkills = inferSpireSkillsFromText(jobDescriptionText);
  const requiredSkills = mergeUniqueStrings(extractSpireSkills(job.skills), descriptionBasedSkills);
  const qualification = fallbackRequiredField(
    extractSpireEducation(job.requiredEducation) ||
      inferSpireQualificationFromText(jobDescriptionText),
    "Not specified"
  );
  const rawJobType = safeString(job.jobType);
  const normalizedJobType = rawJobType.toLowerCase() === "na" ? "" : rawJobType;
  const domain = inferSpireDomain(
    safeString(job.departmentName),
    normalizedJobType,
    safeString(job.jobTitle),
    jobDescriptionText
  );
  const inferredCompensation = inferCompensationFromText(`${jobDescriptionText}\n${aboutCompanyText}`);
  const eligibleGraduationYears = inferEligibleYearsFromText(jobDescriptionText);

  const structuredHints = {
    company_name: companyName,
    company_logo_url: fallbackLogoUrl,
    role_title: safeString(job.jobTitle),
    domain,
    package_amount: inferredCompensation.packageAmount,
    package_type: inferredCompensation.packageType,
    location_type: normalizeSpireLocationType(location, jobDescriptionText),
    city: location,
    experience_required: formatSpireExperience(
      job.requiredExperienceInMonths,
      Boolean(job.isFresherJob)
    ),
    qualification,
    eligible_graduation_years: eligibleGraduationYears,
    required_skills: requiredSkills,
    short_description: (jobDescriptionText || aboutCompanyText).slice(0, 220),
    full_job_description: fullDescription || aboutCompanyText,
    application_link: jobUrl,
    posted_date: formatSpirePostedDate(job),
    expires_at: formatSpireExpiryDate(job),
    source_url: jobUrl,
    source_platform: "spire2grow",
  };

  const metadata: SourceMetadata = {
    title: safeString(structuredHints.role_title),
    description: safeString(structuredHints.short_description),
    siteName: companyName,
    image:
      safeString(structuredHints.company_logo_url) ||
      safeString(staticContent?.contentSettings?.general?.faviconImageUrl),
  };

  const textContent = [
    companyName,
    safeString(job.jobTitle),
    safeString(job.departmentName),
    safeString(job.employmentType),
    location,
    safeString(structuredHints.experience_required),
    qualification,
    requiredSkills.join(", "),
    jobDescriptionText,
    aboutCompanyText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);

  const supplementalNodes = [
    job as unknown as Record<string, unknown>,
    staticContent as unknown as Record<string, unknown> | null,
  ]
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .slice(0, 2);

  return { metadata, structuredHints, textContent, supplementalNodes };
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
  const roleTitle =
    (jobPosting ? safeString(jobPosting.title) : "") ||
    metadata.title;
  const rawDescription =
    (jobPosting ? safeString(jobPosting.description) : "") ||
    metadata.description;
  const inferredCompensation =
    (jobPosting ? extractSalaryFromJobPosting(jobPosting) : "") ? { packageAmount: jobPosting ? extractSalaryFromJobPosting(jobPosting) : "", packageType: "" } : inferCompensationFromText(rawDescription);
  const inferredQualification = fallbackRequiredField(
    (jobPosting ? safeString(jobPosting.qualifications) : "") || inferSpireQualificationFromText(rawDescription),
    "Not specified"
  );
  const inferredExperience = fallbackRequiredField(
    inferSuccessFactorsExperience(roleTitle, rawDescription),
    "Not specified"
  );
  const inferredDomain = fallbackRequiredField(
    inferSuccessFactorsDomain(roleTitle, rawDescription),
    "General"
  );
  const inferredLocationType =
    (jobPosting && Boolean(jobPosting.jobLocationType) && safeString(jobPosting.jobLocationType)) ||
    inferLocationTypeFromText(`${extractLocationFromJobPosting(jobPosting || {})}\n${rawDescription}`);
  const inferredSkills = inferSpireSkillsFromText(`${roleTitle}\n${rawDescription}`);

  return {
    company_name: (companyRecord ? safeString(companyRecord.name) : "") || metadata.siteName,
    company_logo_url: (companyRecord ? safeString(companyRecord.logo) : "") || metadata.image,
    role_title: roleTitle,
    location_type: inferredLocationType,
    city: jobPosting ? extractLocationFromJobPosting(jobPosting) : "",
    experience_required: inferredExperience,
    qualification: inferredQualification,
    eligible_graduation_years: "",
    required_skills: inferredSkills,
    short_description: metadata.description || rawDescription.slice(0, 220),
    full_job_description: rawDescription || metadata.description,
    application_link: (jobPosting && safeString(jobPosting.url)) || jobUrl,
    posted_date: (jobPosting && safeString(jobPosting.datePosted)) || "",
    expires_at: (jobPosting && safeString(jobPosting.validThrough)) || "",
    package_amount: inferredCompensation.packageAmount,
    package_type: inferredCompensation.packageType,
    domain: inferredDomain,
    source_url: jobUrl,
    source_platform: sourcePlatform,
  };
};

const fetchHtml = async (jobUrl: string): Promise<string> => {
  const response = await fetch(jobUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...buildDefaultRequestHeaders(),
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

const buildJobExtractionPrompts = (
  sourcePlatform: string,
  jobUrl: string,
  metadata: SourceMetadata,
  structuredHints: Record<string, unknown>,
  textContent: string,
  jsonLdNodes: Array<Record<string, unknown>>
) => {
  const systemPrompt = [
    "You extract job data from career pages into a strict JSON object.",
    "Return only valid JSON. No markdown. No explanation.",
    "Use exactly these keys:",
    "company_name, company_logo_url, role_title, domain, package_amount, package_type, location_type, city, experience_required, qualification, eligible_graduation_years, required_skills, short_description, full_job_description, application_link, posted_date, expires_at, source_url, source_platform.",
    "Use strings for all scalar fields. required_skills can be either an array of strings or a comma-separated string.",
    "Use location_type only as Remote, Onsite, Hybrid, or empty string.",
    "Use package_type only as CTC, stipend, hourly, or empty string.",
    "Do not invent company_logo_url. Leave it empty unless clearly present in the supplied data.",
    "Do not invent salary or qualification. Leave them empty if not present.",
    "If the page includes an application deadline, closing date, or validThrough date, return it in expires_at.",
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

  return { systemPrompt, userPrompt };
};

const getConfiguredExtractionAiProvider = (): ExtractionAiProvider | null => {
  const preferredProvider = cleanWhitespace(Deno.env.get("JOB_EXTRACTION_AI_PROVIDER") || "").toLowerCase();
  const hasOpenAi = Boolean(cleanWhitespace(Deno.env.get("OPENAI_API_KEY") || ""));
  const hasOpenRouter = Boolean(cleanWhitespace(Deno.env.get("OPENROUTER_API_KEY") || ""));

  if (preferredProvider === "openai" && hasOpenAi) return "openai";
  if (preferredProvider === "openrouter" && hasOpenRouter) return "openrouter";
  if (hasOpenAi) return "openai";
  if (hasOpenRouter) return "openrouter";
  return null;
};

const getOpenAiModelForMode = (aiMode: ExtractionAiMode): string => {
  if (aiMode === "bulk") {
    return cleanWhitespace(Deno.env.get("JOB_EXTRACTION_OPENAI_BULK_MODEL") || DEFAULT_OPENAI_BULK_MODEL);
  }

  if (aiMode === "priority") {
    return cleanWhitespace(Deno.env.get("JOB_EXTRACTION_OPENAI_PRIORITY_MODEL") || DEFAULT_OPENAI_PRIORITY_MODEL);
  }

  return cleanWhitespace(Deno.env.get("JOB_EXTRACTION_OPENAI_STANDARD_MODEL") || DEFAULT_OPENAI_STANDARD_MODEL);
};

const getOpenRouterModelsForMode = (aiMode: ExtractionAiMode): string[] => {
  const preferredModel =
    aiMode === "bulk"
      ? cleanWhitespace(Deno.env.get("JOB_EXTRACTION_OPENROUTER_BULK_MODEL") || DEFAULT_OPENROUTER_BULK_MODEL)
      : aiMode === "priority"
        ? cleanWhitespace(Deno.env.get("JOB_EXTRACTION_OPENROUTER_PRIORITY_MODEL") || DEFAULT_OPENROUTER_PRIORITY_MODEL)
        : cleanWhitespace(Deno.env.get("JOB_EXTRACTION_OPENROUTER_STANDARD_MODEL") || DEFAULT_OPENROUTER_STANDARD_MODEL);

  return Array.from(new Set([preferredModel, LEGACY_OPENROUTER_MODEL].filter(Boolean)));
};

const getAiErrorMessage = (responseJson: unknown, fallbackMessage: string): string => {
  if (responseJson && typeof responseJson === "object") {
    const errorRecord = (responseJson as Record<string, unknown>).error;
    if (errorRecord && typeof errorRecord === "object") {
      const message = safeString((errorRecord as Record<string, unknown>).message);
      if (message) return message;
    }

    const topLevelMessage = safeString((responseJson as Record<string, unknown>).message);
    if (topLevelMessage) return topLevelMessage;
  }

  return fallbackMessage;
};

const hasMeaningfulStructuredHint = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return normalizeArrayToStringArray(value).length > 0;
  }

  return Boolean(safeString(value));
};

const countMissingImportantStructuredHints = (structuredHints: Record<string, unknown>): number => {
  const importantFields = [
    "company_name",
    "role_title",
    "domain",
    "location_type",
    "experience_required",
    "qualification",
    "short_description",
    "full_job_description",
  ];

  return importantFields.filter((field) => !hasMeaningfulStructuredHint(structuredHints[field])).length;
};

const normalizeRequestedAiMode = (value: unknown): ExtractionAiMode | null => {
  const normalized = safeString(value).toLowerCase();
  if (normalized === "bulk" || normalized === "standard" || normalized === "priority") {
    return normalized;
  }

  return null;
};

const normalizeBooleanLike = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = safeString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const resolveExtractionAiMode = (params: {
  requestedAiMode: ExtractionAiMode | null;
  priorityRequested: boolean;
  sourcePlatform: string;
  structuredHints: Record<string, unknown>;
  textContent: string;
}): ExtractionAiMode => {
  if (params.priorityRequested || params.requestedAiMode === "priority") {
    return "priority";
  }

  if (params.requestedAiMode === "bulk" || params.requestedAiMode === "standard") {
    return params.requestedAiMode;
  }

  const missingImportantHints = countMissingImportantStructuredHints(params.structuredHints);
  const genericSource = params.sourcePlatform === "generic";
  const descriptionText = safeString(params.structuredHints.full_job_description);
  const shortDescription = safeString(params.structuredHints.short_description);
  const weakDescription = descriptionText.length < 180 || shortDescription.length < 60;
  const textHeavy = params.textContent.length > 12000;
  const missingSkills = !hasMeaningfulStructuredHint(params.structuredHints.required_skills);

  if (
    missingImportantHints >= 5 ||
    textHeavy ||
    (genericSource && (missingImportantHints >= 3 || weakDescription || missingSkills))
  ) {
    return "priority";
  }

  return "standard";
};

const callOpenAiForJobExtraction = async (
  model: string,
  sourcePlatform: string,
  jobUrl: string,
  metadata: SourceMetadata,
  structuredHints: Record<string, unknown>,
  textContent: string,
  jsonLdNodes: Array<Record<string, unknown>>
): Promise<Record<string, unknown>> => {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const { systemPrompt, userPrompt } = buildJobExtractionPrompts(
    sourcePlatform,
    jobUrl,
    metadata,
    structuredHints,
    textContent,
    jsonLdNodes
  );

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(getAiErrorMessage(responseJson, "OpenAI job extraction request failed."));
  }

  const content = safeString(responseJson?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  return parseAiJsonObject(content);
};

const callOpenRouterForJobExtraction = async (
  aiMode: ExtractionAiMode,
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

  const { systemPrompt, userPrompt } = buildJobExtractionPrompts(
    sourcePlatform,
    jobUrl,
    metadata,
    structuredHints,
    textContent,
    jsonLdNodes
  );

  let lastError: Error | null = null;
  for (const model of getOpenRouterModelsForMode(aiMode)) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const responseJson = await response.json();
    if (!response.ok) {
      lastError = new Error(getAiErrorMessage(responseJson, "OpenRouter job extraction request failed."));
      console.warn(`extract-job-from-url: OpenRouter model ${model} failed, trying next fallback if available.`);
      continue;
    }

    const content = safeString(responseJson?.choices?.[0]?.message?.content);
    if (!content) {
      lastError = new Error(`OpenRouter model ${model} returned an empty response.`);
      console.warn(`extract-job-from-url: OpenRouter model ${model} returned empty content, trying next fallback if available.`);
      continue;
    }

    return parseAiJsonObject(content);
  }

  throw lastError || new Error("OpenRouter job extraction request failed.");
};

const callAiForJobExtraction = async (
  aiMode: ExtractionAiMode,
  sourcePlatform: string,
  jobUrl: string,
  metadata: SourceMetadata,
  structuredHints: Record<string, unknown>,
  textContent: string,
  jsonLdNodes: Array<Record<string, unknown>>
): Promise<Record<string, unknown>> => {
  const configuredProvider = getConfiguredExtractionAiProvider();
  if (!configuredProvider) {
    throw new Error("No AI provider is configured for job extraction.");
  }

  if (configuredProvider === "openai") {
    const model = getOpenAiModelForMode(aiMode);
    console.log(`extract-job-from-url: using OpenAI model ${model} for ${aiMode} extraction.`);
    return await callOpenAiForJobExtraction(
      model,
      sourcePlatform,
      jobUrl,
      metadata,
      structuredHints,
      textContent,
      jsonLdNodes
    );
  }

  const modelsToTry = getOpenRouterModelsForMode(aiMode).join(", ");
  console.log(`extract-job-from-url: using OpenRouter models [${modelsToTry}] for ${aiMode} extraction.`);
  return await callOpenRouterForJobExtraction(
    aiMode,
    sourcePlatform,
    jobUrl,
    metadata,
    structuredHints,
    textContent,
    jsonLdNodes
  );
};

const normalizeExtractedJobPayload = (
  raw: Record<string, unknown>,
  fallback: Record<string, unknown>
): ExtractedJobPayload => {
  const textFallbacks = {
    packageAmount: "Not disclosed",
    qualification: "Not specified",
    eligibleYears: "Not specified",
    requiredSkills: "Not specified",
  };

  const fallbackSkills = Array.isArray(fallback.required_skills)
    ? normalizeArrayToStringArray(fallback.required_skills)
    : safeString(fallback.required_skills);

  const rawSkills = Array.isArray(raw.required_skills)
    ? normalizeArrayToStringArray(raw.required_skills)
    : safeString(raw.required_skills);

  const skills =
    Array.isArray(rawSkills)
      ? (rawSkills.length > 0 ? rawSkills : fallbackSkills)
      : (rawSkills || fallbackSkills);
  const normalizedRequiredSkills =
    Array.isArray(skills)
      ? (skills.length > 0 ? skills : textFallbacks.requiredSkills)
      : (skills || textFallbacks.requiredSkills);

  const packageAmount =
    safeString(raw.package_amount) ||
    safeString(fallback.package_amount) ||
    textFallbacks.packageAmount;
  const packageType =
    packageAmount === textFallbacks.packageAmount
      ? ""
      : safeString(raw.package_type) || safeString(fallback.package_type);

  const shortDescription =
    safeString(raw.short_description) ||
    safeString(fallback.short_description);

  const fullDescription =
    safeString(raw.full_job_description) ||
    safeString(fallback.full_job_description) ||
    shortDescription;

  return {
    company_name: safeString(raw.company_name) || safeString(fallback.company_name),
    company_logo_url: safeString(raw.company_logo_url) || safeString(fallback.company_logo_url),
    role_title: safeString(raw.role_title) || safeString(fallback.role_title),
    domain: safeString(raw.domain) || safeString(fallback.domain),
    package_amount: packageAmount,
    package_type: packageType,
    location_type: safeString(raw.location_type) || safeString(fallback.location_type),
    city: safeString(raw.city) || safeString(fallback.city),
    experience_required:
      safeString(raw.experience_required) || safeString(fallback.experience_required),
    qualification:
      safeString(raw.qualification) ||
      safeString(fallback.qualification) ||
      textFallbacks.qualification,
    eligible_graduation_years:
      safeString(raw.eligible_graduation_years) ||
      safeString(fallback.eligible_graduation_years) ||
      textFallbacks.eligibleYears,
    required_skills: normalizedRequiredSkills,
    short_description: shortDescription,
    full_job_description: fullDescription,
    application_link:
      safeString(raw.application_link) || safeString(fallback.application_link),
    posted_date: safeString(raw.posted_date) || safeString(fallback.posted_date),
    expires_at: safeString(raw.expires_at) || safeString(fallback.expires_at),
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
    const { jobUrl, aiMode, priority }: ExtractJobRequest = await req.json();
    const normalizedJobUrl = safeString(jobUrl);
    const requestedAiMode = normalizeRequestedAiMode(aiMode);
    const priorityRequested = normalizeBooleanLike(priority);

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

    let sourcePlatform = detectSourcePlatform(parsedUrl.toString());
    let metadata: SourceMetadata;
    let structuredHints: Record<string, unknown>;
    let textContent: string;
    let jsonLdNodes: Array<Record<string, unknown>>;

    if (sourcePlatform === "superset") {
      const supersetData = await extractSupersetStructuredData(parsedUrl.toString());
      metadata = supersetData.metadata;
      structuredHints = supersetData.structuredHints;
      textContent = supersetData.textContent;
      jsonLdNodes = supersetData.supplementalNodes;
    } else if (sourcePlatform === "greenhouse") {
      const greenhouseData = await extractGreenhouseStructuredData(parsedUrl.toString());
      metadata = greenhouseData.metadata;
      structuredHints = greenhouseData.structuredHints;
      textContent = greenhouseData.textContent;
      jsonLdNodes = greenhouseData.supplementalNodes;
    } else if (sourcePlatform === "paramai") {
      const paramData = await extractParamStructuredData(parsedUrl.toString());
      metadata = paramData.metadata;
      structuredHints = paramData.structuredHints;
      textContent = paramData.textContent;
      jsonLdNodes = paramData.supplementalNodes;
    } else if (sourcePlatform === "successfactors") {
      const successFactorsData = await extractSuccessFactorsStructuredData(parsedUrl.toString());
      metadata = successFactorsData.metadata;
      structuredHints = successFactorsData.structuredHints;
      textContent = successFactorsData.textContent;
      jsonLdNodes = successFactorsData.supplementalNodes;
    } else if (sourcePlatform === "spire2grow") {
      const spireData = await extractSpireStructuredData(parsedUrl.toString());
      metadata = spireData.metadata;
      structuredHints = spireData.structuredHints;
      textContent = spireData.textContent;
      jsonLdNodes = spireData.supplementalNodes;
    } else {
      const html = await fetchHtml(parsedUrl.toString());
      const embeddedGreenhouseBoard = findGreenhouseBoardToken(parsedUrl.toString(), html);
      const embeddedGreenhouseJobId = findGreenhouseJobId(parsedUrl.toString(), html);

      if (embeddedGreenhouseBoard && embeddedGreenhouseJobId) {
        sourcePlatform = "greenhouse";
        const greenhouseData = await extractGreenhouseStructuredData(parsedUrl.toString(), html);
        metadata = greenhouseData.metadata;
        structuredHints = greenhouseData.structuredHints;
        textContent = greenhouseData.textContent;
        jsonLdNodes = greenhouseData.supplementalNodes;
      } else {
        const pageData = extractPageData(html);
        metadata = pageData.metadata;
        textContent = pageData.textContent;
        jsonLdNodes = pageData.jsonLdNodes;
        structuredHints = buildStructuredHints(
          pageData.jobPosting,
          metadata,
          parsedUrl.toString(),
          sourcePlatform
        );
      }
    }

    const resolvedAiMode = resolveExtractionAiMode({
      requestedAiMode,
      priorityRequested,
      sourcePlatform,
      structuredHints,
      textContent,
    });

    let aiResult: Record<string, unknown> = {};
    if (sourcePlatform !== "spire2grow") {
      try {
        aiResult = await callAiForJobExtraction(
          resolvedAiMode,
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
    const status =
      message.includes("Could not find a Greenhouse job id") ||
      message.includes("Could not find a Greenhouse board token") ||
      message.includes("Could not find a Tata Communications job id") ||
      message.includes("loads dynamically") ||
      message.includes("could not be found in the public API")
        ? 422
        : 500;
    return jsonResponse({ success: false, error: message }, status);
  }
});
