import type { ResumeData, UserType } from '../types/resume';

export interface ResumeContactFallbacks {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

const isUsefulText = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text) return false;

  return !(
    /^(placeholder|example|sample|n\/?a|none|nil|-+)$/i.test(text) ||
    /^\[.*\]$/.test(text) ||
    /^your .+ here$/i.test(text)
  );
};

const hasValidEmail = (value: unknown): boolean =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const hasValidPhone = (value: unknown): boolean =>
  typeof value === 'string' && value.replace(/\D/g, '').length >= 7;

const hasWorkExperience = (resume: ResumeData): boolean =>
  Array.isArray(resume.workExperience) && resume.workExperience.some((entry) =>
    isUsefulText(entry?.role) ||
    isUsefulText(entry?.company) ||
    (Array.isArray(entry?.bullets) && entry.bullets.some(isUsefulText))
  );

const hasSkills = (resume: ResumeData): boolean =>
  Array.isArray(resume.skills) && resume.skills.some((category) => {
    if (typeof category === 'string') return isUsefulText(category);
    const possibleCategory = category as unknown as { list?: unknown[]; skills?: unknown[]; category?: unknown };
    const values = Array.isArray(possibleCategory.list)
      ? possibleCategory.list
      : Array.isArray(possibleCategory.skills)
        ? possibleCategory.skills
        : [];
    return values.some(isUsefulText) || isUsefulText(possibleCategory.category);
  });

const hasEducation = (resume: ResumeData): boolean =>
  Array.isArray(resume.education) && resume.education.some((entry) =>
    isUsefulText(entry?.degree) || isUsefulText(entry?.school)
  );

/**
 * Returns only information that must be supplied before optimization can run.
 * Optional resume enhancements (projects, certifications, social links and
 * incomplete dates) must never block a user from optimizing an otherwise
 * usable resume.
 */
export const findRequiredMissingSections = (
  resume: ResumeData,
  userType: UserType,
  fallbacks: ResumeContactFallbacks = {},
): string[] => {
  const missing: string[] = [];

  if (userType === 'experienced' && !hasWorkExperience(resume)) {
    missing.push('workExperience');
  }

  if (!hasSkills(resume)) {
    missing.push('skills');
  }

  if (userType !== 'experienced' && !hasEducation(resume)) {
    missing.push('education');
  }

  const resolvedName = isUsefulText(resume.name) ? resume.name : fallbacks.name;
  const resolvedEmail = hasValidEmail(resume.email) ? resume.email : fallbacks.email;
  const resolvedPhone = hasValidPhone(resume.phone) ? resume.phone : fallbacks.phone;

  if (!isUsefulText(resolvedName)) {
    missing.push('contactDetails:Name');
  }

  // One reliable contact method is sufficient. LinkedIn and GitHub are useful
  // enhancements but are never mandatory fields.
  if (!hasValidEmail(resolvedEmail) && !hasValidPhone(resolvedPhone)) {
    missing.push('contactDetails');
  }

  return missing;
};

