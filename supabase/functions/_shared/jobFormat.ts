// Display formatting for job fields, shared by every channel that announces a
// job (Telegram, Instagram caption, Instagram Reel) so they all read the same.

export interface JobDisplayFields {
  location_type: string | null;
  location_city: string | null;
  package_amount: number | null;
  package_type: string | null;
  eligible_years: string | string[] | null;
  experience_required: string | null;
}

export function formatCompensation(job: JobDisplayFields): string {
  const amount = typeof job.package_amount === "number" ? job.package_amount : 0;
  if (amount <= 0) return "Not disclosed";

  const packageType = (job.package_type || "").toLowerCase();
  if (packageType === "stipend") return `Rs.${Math.round(amount).toLocaleString("en-IN")} / month`;
  if (packageType === "hourly") return `Rs.${Math.round(amount).toLocaleString("en-IN")} / hour`;

  const inLakhs = amount / 100000;
  const formattedLakhs = Number.isInteger(inLakhs) ? inLakhs.toString() : inLakhs.toFixed(1);
  return `${formattedLakhs} LPA`;
}

export function formatLocation(job: JobDisplayFields): string {
  if (job.location_city && job.location_city.trim()) {
    return `${job.location_city.trim()} (${job.location_type || "Not specified"})`;
  }
  return job.location_type || "Not specified";
}

export function formatEligibleYears(job: JobDisplayFields): string {
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

export function formatExperience(job: JobDisplayFields): string {
  return typeof job.experience_required === "string" && job.experience_required.trim()
    ? job.experience_required.trim()
    : "Not specified";
}
