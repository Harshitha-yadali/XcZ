// Pure helpers for the job → Instagram Reel automation. No Deno or network
// access here so they run under vitest as well as in edge functions.

export const DM_KEYWORD = "LINK";

// Daily posting slots, as hours in IST.
const SLOT_HOURS_IST = [9, 13, 18];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// Rendering runs on a 30-minute GitHub Actions schedule, so a slot must be far
// enough away for the video to exist when it arrives.
const RENDER_BUFFER_MS = 45 * 60 * 1000;

/** Earliest slot at least 45 minutes after `now` that is not in `taken` (ISO strings). */
export function nextSlot(now: Date, taken: string[]): Date {
  const takenMs = new Set(taken.map((value) => new Date(value).getTime()));
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const earliest = now.getTime() + RENDER_BUFFER_MS;

  for (let day = 0; day < 366; day++) {
    for (const hour of SLOT_HOURS_IST) {
      const slot =
        Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + day, hour) - IST_OFFSET_MS;
      if (slot >= earliest && !takenMs.has(slot)) return new Date(slot);
    }
  }
  throw new Error("No free Instagram slot in the next year");
}

/** The text shown on the Reel and repeated in the caption. */
export interface JobCard {
  company: string;
  role: string;
  salary: string;
  experience: string;
  location: string;
  eligible: string;
}

// Caption hook A/B test. Hypothesis: job seekers screen openings by pay, so
// leading with the package draws more "LINK" comments than leading with the
// company. Results are in the instagram_hook_test view.
export type HookVariant = "role" | "salary";

const SALARY_UNKNOWN = "Not disclosed";

/**
 * Alternates variants so both get every time slot over two days. Jobs with no
 * disclosed package cannot lead with one, so they stay out of the test (null).
 */
export function pickVariant(card: JobCard, previous: HookVariant | null): HookVariant | null {
  if (card.salary === SALARY_UNKNOWN) return null;
  return previous === "role" ? "salary" : "role";
}

export function buildCaption(card: JobCard, variant: HookVariant | null): string {
  return [
    variant === "salary"
      ? `${card.salary} · ${card.role} at ${card.company}`
      : `${card.company} is hiring: ${card.role}`,
    "",
    `💰 Package: ${card.salary}`,
    `🎯 Experience: ${card.experience}`,
    `📍 Location: ${card.location}`,
    `🎓 Eligible: ${card.eligible}`,
    "",
    `Comment "${DM_KEYWORD}" and we'll DM you the apply link.`,
    "",
    "#hiring #jobsinindia #freshersjobs #jobsearch #primoboostai",
  ].join("\n");
}

/** The link sent by DM, tagged so Instagram traffic is identifiable in analytics. */
export function jobLink(siteUrl: string, jobId: string, variant: HookVariant | null): string {
  const utm = new URLSearchParams({ utm_source: "instagram", utm_medium: "social", utm_campaign: "job_reel", utm_content: variant ? `hook_${variant}` : "hook_none" });
  return `${siteUrl}/jobs/${jobId}?${utm}`;
}

export function matchesKeyword(text: string | null | undefined): boolean {
  return new RegExp(`\\b${DM_KEYWORD}\\b`, "i").test(text || "");
}

/** Checks Meta's `X-Hub-Signature-256` header (`sha256=<hex>`) against the raw request body. */
export async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=") || !appSecret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");

  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
