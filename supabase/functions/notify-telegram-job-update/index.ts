import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotifyTelegramJobUpdateRequest {
  jobId: string;
}

interface JobListingRow {
  id: string;
  company_name: string;
  role_title: string;
  domain: string;
  application_link: string;
  location_type: string | null;
  location_city: string | null;
  package_amount: number | null;
  package_type: string | null;
  eligible_years: string | string[] | null;
  experience_required: string | null;
  is_active: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCompensation(job: JobListingRow): string {
  const amount = typeof job.package_amount === "number" ? job.package_amount : 0;
  if (amount <= 0) return "Not disclosed";

  const packageType = (job.package_type || "").toLowerCase();
  if (packageType === "stipend") return `Rs.${Math.round(amount).toLocaleString("en-IN")} / month`;
  if (packageType === "hourly") return `Rs.${Math.round(amount).toLocaleString("en-IN")} / hour`;

  const inLakhs = amount / 100000;
  const formattedLakhs = Number.isInteger(inLakhs) ? inLakhs.toString() : inLakhs.toFixed(1);
  return `${formattedLakhs} LPA`;
}

function formatLocation(job: JobListingRow): string {
  if (job.location_city && job.location_city.trim()) {
    return `${job.location_city.trim()} (${job.location_type || "Not specified"})`;
  }
  return job.location_type || "Not specified";
}

function formatEligibleYears(job: JobListingRow): string {
  const value = job.eligible_years;
  if (!value) return "Not specified";

  const items = Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean)
    : value
        .split(value.includes(",") || value.includes("|") || value.includes("/") ? /[,|/]/ : /\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

  return items.length ? items.join(", ") : "Not specified";
}

function formatExperience(job: JobListingRow): string {
  return typeof job.experience_required === "string" && job.experience_required.trim()
    ? job.experience_required.trim()
    : "Not specified";
}

function buildTelegramMessage(job: JobListingRow, applyUrl: string): string {
  return [
    "🆕 <b>New Job Posted</b>",
    "",
    `<b>Company:</b> ${escapeHtml(job.company_name)}`,
    `<b>Role:</b> ${escapeHtml(job.role_title)}`,
    `<b>Package:</b> ${escapeHtml(formatCompensation(job))}`,
    `<b>Location:</b> ${escapeHtml(formatLocation(job))}`,
    `<b>Eligible Years:</b> ${escapeHtml(formatEligibleYears(job))}`,
    `<b>Experience:</b> ${escapeHtml(formatExperience(job))}`,
    "",
    `<b>Apply Now:</b> ${applyUrl}`,
  ].join("\n");
}

/**
 * Fires immediately when an admin manually posts a single job (see
 * persistJobListing in JobUploadForm.tsx, right next to notify-new-job) — NOT
 * for bulk imports or the Apify sync, which could insert many jobs at once
 * and would spam the Telegram group with one message per job. Scoped and
 * fire-and-forget, matching notify-new-job's contract exactly.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { jobId }: NotifyTelegramJobUpdateRequest = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ success: false, error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      console.warn("notify-telegram-job-update: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured, skipping.");
      return new Response(
        JSON.stringify({ success: false, skipped: true, message: "Telegram is not configured." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const siteUrl = Deno.env.get("SITE_URL") || "https://primoboost.ai";

    const { data: job, error: jobError } = await supabase
      .from("job_listings")
      .select(
        "id, company_name, role_title, domain, application_link, location_type, location_city, package_amount, package_type, eligible_years, experience_required, is_active",
      )
      .eq("id", jobId)
      .maybeSingle<JobListingRow>();

    if (jobError) throw new Error(`Failed to fetch job: ${jobError.message}`);
    if (!job || !job.is_active) {
      return new Response(
        JSON.stringify({ success: true, message: "Job not found or inactive, nothing to post." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const applyUrl = `${siteUrl}/jobs/${job.id}`;
    const text = buildTelegramMessage(job, applyUrl);

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      throw new Error(telegramResult.description || `Telegram API request failed (${telegramResponse.status})`);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: telegramResult.result?.message_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in notify-telegram-job-update:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to post to Telegram" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
