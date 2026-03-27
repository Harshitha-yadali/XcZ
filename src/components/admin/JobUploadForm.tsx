// src/components/admin/JobUploadForm.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Briefcase,
  MapPin,
  Clock,
  Calendar,
  GraduationCap,
  IndianRupee,
  ExternalLink,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Plus,
  Target,
  FileText,
  Image,
  RotateCw,
  Trash2,
  Info,
  Mail,
  Code,
  Link as LinkIcon,
  Users,
  Award,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobsService } from '../../services/jobsService';
import { JobListing } from '../../types/jobs';
import { ImageUpload } from './ImageUpload';
import { useJobFormAutoSave } from '../../hooks/useJobFormAutoSave';
import { openrouter } from '../../services/aiProxyService';
import { jobExtractionService, type ExtractedJobFromUrl } from '../../services/jobExtractionService';
import { supabase } from '../../lib/supabaseClient';

const MAX_SUPPORTED_DB_INTEGER = 2147483647;
const RUPEES_PER_LAKH = 100000;
const RUPEES_PER_THOUSAND = 1000;

// Helper to truly make optional number inputs tolerant of empty string/NaN from form
const optionalPositiveNumber = (message: string, tooLargeMessage: string) =>
  z.preprocess(
    (val) => {
      if (val === '' || val === null || typeof val === 'undefined') return undefined;
      // react-hook-form with valueAsNumber can pass NaN when input is empty
      if (typeof val === 'number' && Number.isNaN(val)) return undefined;
      // strings that are numeric
      if (typeof val === 'string' && val.trim() === '') return undefined;
      return val;
    },
    z.number().positive(message).max(MAX_SUPPORTED_DB_INTEGER, tooLargeMessage).optional()
  );

const parseSkillsInput = (value: string | string[] | null | undefined): string[] => {
  const rawSkills = Array.isArray(value)
    ? value.filter((skill): skill is string => typeof skill === 'string')
    : (value || '').split(/[\n,;|]/);

  const seen = new Set<string>();
  const normalizedSkills: string[] = [];

  rawSkills.forEach((skill) => {
    const cleaned = skill
      .replace(/^[-*]+/, '')
      .trim();

    if (!cleaned) return;

    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) return;

    seen.add(dedupeKey);
    normalizedSkills.push(cleaned);
  });

  return normalizedSkills;
};

const DEFAULT_PACKAGE_AMOUNT_PLACEHOLDER = 'e.g., 1200000';

const EXTRACTION_PLACEHOLDER_VALUES = new Set([
  'not specified',
  'not disclosed',
  'not available',
  'n/a',
  'na',
  'nil',
  'none',
]);

const isExtractionPlaceholderText = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return EXTRACTION_PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
};

const normalizeOptionalTextForSave = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || isExtractionPlaceholderText(normalized)) return undefined;
  return normalized;
};

const normalizeSkillsForSave = (value: string | string[] | null | undefined): string[] | undefined => {
  const normalizedSkills = parseSkillsInput(value).filter((skill) => !isExtractionPlaceholderText(skill));
  return normalizedSkills.length > 0 ? normalizedSkills : undefined;
};

// Zod schema for job listing validation
const jobListingSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  role_title: z.string().min(1, 'Role title is required'),
  package_amount: optionalPositiveNumber('Package amount must be positive', 'Package amount is too large'),
  package_type: z.enum(['CTC', 'stipend', 'hourly']).optional(),
  domain: z.string().min(1, 'Domain is required'),
  location_type: z.enum(['Remote', 'Onsite', 'Hybrid']),
  location_city: z.string().optional(),
  experience_required: z.string().min(1, 'Experience requirement is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  eligible_years: z.string().optional().or(z.literal('')),
  skills: z.string().optional().or(z.literal('')),
  short_description: z.string().min(50, 'Short description must be at least 50 characters'),
  full_description: z.string().min(100, 'Full description must be at least 100 characters'),
  application_link: z.string().url('Must be a valid URL'),
  expires_at: z.string().optional().or(z.literal('')),
  is_active: z.boolean().default(true),

  // Referral fields
  referral_person_name: z.string().optional(),
  referral_email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  referral_code: z.string().optional(),
  referral_link: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  referral_bonus_amount: optionalPositiveNumber('Bonus amount must be positive', 'Bonus amount is too large'),
  referral_terms: z.string().optional(),

  // Test pattern fields
  test_requirements: z.string().optional(),
  has_coding_test: z.boolean().default(false),
  has_aptitude_test: z.boolean().default(false),
  has_technical_interview: z.boolean().default(false),
  has_hr_interview: z.boolean().default(false),
  test_duration_minutes: optionalPositiveNumber('Duration must be positive', 'Duration is too large'),
});

type JobFormData = z.infer<typeof jobListingSchema>;

type AiJobFieldValue = string | number | boolean | null | undefined;
type AiJobFieldMap = Partial<Record<keyof JobFormData, AiJobFieldValue>> & {
  description?: AiJobFieldValue;
  job_description?: AiJobFieldValue;
  full_job_description?: AiJobFieldValue;
  jd?: AiJobFieldValue;
  job_details?: AiJobFieldValue;
  summary?: AiJobFieldValue;
  job_summary?: AiJobFieldValue;
  required_skills?: AiJobFieldValue;
  skills_required?: AiJobFieldValue;
  company?: AiJobFieldValue;
  role?: AiJobFieldValue;
  title?: AiJobFieldValue;
  city?: AiJobFieldValue;
  work_mode?: AiJobFieldValue;
  experience?: AiJobFieldValue;
  education?: AiJobFieldValue;
  apply_link?: AiJobFieldValue;
  job_url?: AiJobFieldValue;
};

const AI_ALLOWED_JOB_FIELDS: Array<keyof JobFormData> = [
  'company_name',
  'company_logo_url',
  'role_title',
  'package_amount',
  'package_type',
  'domain',
  'location_type',
  'location_city',
  'experience_required',
  'qualification',
  'eligible_years',
  'skills',
  'short_description',
  'full_description',
  'application_link',
  'expires_at',
  'is_active',
  'referral_person_name',
  'referral_email',
  'referral_code',
  'referral_link',
  'referral_bonus_amount',
  'referral_terms',
  'test_requirements',
  'has_coding_test',
  'has_aptitude_test',
  'has_technical_interview',
  'has_hr_interview',
  'test_duration_minutes',
];

const OPTIONAL_STRING_FIELDS = new Set<keyof JobFormData>([
  'company_logo_url',
  'location_city',
  'eligible_years',
  'skills',
  'expires_at',
  'referral_person_name',
  'referral_email',
  'referral_code',
  'referral_link',
  'referral_terms',
  'test_requirements',
]);

const parseAiJsonObject = (rawResponse: string): Record<string, unknown> => {
  const trimmed = rawResponse.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  const parseCandidate = (json: string) => {
    const parsed = JSON.parse(json);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('AI response must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  };

  try {
    return parseCandidate(candidate);
  } catch {
    const objectStart = candidate.indexOf('{');
    const objectEnd = candidate.lastIndexOf('}');
    if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
      throw new Error('AI returned invalid JSON. Please try again.');
    }
    return parseCandidate(candidate.slice(objectStart, objectEnd + 1));
  }
};

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  return null;
};

const normalizePositiveNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const rounded = Math.round(value);
    return rounded <= MAX_SUPPORTED_DB_INTEGER ? rounded : null;
  }
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const numericMatches = Array.from(normalized.matchAll(/\d[\d,]*(?:\.\d+)?/g));
  if (numericMatches.length === 0) return null;

  const firstRawValue = numericMatches[0]?.[0]?.replace(/,/g, '') || '';
  const parsed = Number.parseFloat(firstRawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const hasLakhHint = /\b(lpa|lakhs?|lacs?)\b/i.test(normalized);
  const hasThousandHint = /\bthousand\b/i.test(normalized) || /\d[\d,]*(?:\.\d+)?\s*k\b/i.test(normalized);

  let resolvedValue = parsed;
  if (hasLakhHint && parsed < 1000) {
    resolvedValue = parsed * RUPEES_PER_LAKH;
  } else if (hasThousandHint && parsed < 100000) {
    resolvedValue = parsed * RUPEES_PER_THOUSAND;
  }

  const rounded = Math.round(resolvedValue);
  return rounded <= MAX_SUPPORTED_DB_INTEGER ? rounded : null;
};

const normalizeExtractedPackageType = (value: unknown): JobFormData['package_type'] | undefined => {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized.includes('stipend')) return 'stipend';
  if (normalized.includes('hour')) return 'hourly';
  if (
    normalized.includes('ctc') ||
    normalized.includes('annual') ||
    normalized.includes('salary') ||
    normalized.includes('lpa')
  ) {
    return 'CTC';
  }

  return undefined;
};

const normalizeExtractedLocationType = (
  locationType: unknown,
  city: unknown
): JobFormData['location_type'] => {
  const combined = [locationType, city]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .trim()
    .toLowerCase();

  if (combined.includes('hybrid')) return 'Hybrid';
  if (combined.includes('remote') || combined.includes('work from home') || combined.includes('wfh')) {
    return 'Remote';
  }

  return 'Onsite';
};

const normalizeExtractedText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\.?contentreference\[[^\]]+\]\{[^}]+\}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeExtractedSkills = (value: unknown): string => {
  if (typeof value !== 'string' && !Array.isArray(value)) {
    return '';
  }

  return parseSkillsInput(value as string | string[]).join(', ');
};

const normalizeDateInputValue = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  const raw = typeof value === 'number' ? new Date(value).toISOString() : value.trim();
  if (!raw) return '';

  const exactDateMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (exactDateMatch) {
    return exactDateMatch[0];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString().slice(0, 10);
};

const normalizeExpiryForSave = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed || isExtractionPlaceholderText(trimmed)) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T23:59:59.999`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const buildShortDescriptionFromText = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= 220) return normalized;

  const truncated = normalized.slice(0, 220);
  const sentenceBoundary = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? ')
  );

  if (sentenceBoundary >= 80) {
    return truncated.slice(0, sentenceBoundary + 1).trim();
  }

  const wordBoundary = truncated.lastIndexOf(' ');
  if (wordBoundary >= 80) {
    return truncated.slice(0, wordBoundary).trim();
  }

  return truncated.trim();
};

const normalizeAdminInputKey = (rawKey: string): string => {
  const normalized = rawKey
    .trim()
    .replace(/^["'{\s]+|["'}\s]+$/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'application_deadline':
    case 'deadline':
    case 'apply_by':
    case 'last_date_to_apply':
      return 'expires_at';
    case 'job_description':
    case 'jd_text':
      return 'job_description';
    case 'apply_url':
      return 'application_link';
    default:
      return normalized;
  }
};

const cleanAdminInputValue = (rawValue: string): string =>
  rawValue
    .trim()
    .replace(/^[",']+|[",']+$/g, '')
    .replace(/,\s*$/, '')
    .replace(/\s*}\s*$/, '')
    .replace(/\.?contentreference\[[^\]]+\]\{[^}]+\}/gi, ' ')
    .trim();

const parseAdminKeyValueInput = (input: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  let currentKey: string | null = null;

  input.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*[{"']?\s*([a-z][a-z0-9_ -]{0,60})\s*["']?\s*:\s*(.*)$/i);
    if (match) {
      currentKey = normalizeAdminInputKey(match[1]);
      parsed[currentKey] = cleanAdminInputValue(match[2]);
      return;
    }

    if (!currentKey) return;

    const nextLine = cleanAdminInputValue(line);
    if (!nextLine) {
      parsed[currentKey] = parsed[currentKey]
        ? `${parsed[currentKey]}\n`
        : '';
      return;
    }

    parsed[currentKey] = parsed[currentKey]
      ? `${parsed[currentKey]}\n${nextLine}`
      : nextLine;
  });

  return Object.fromEntries(
    Object.entries(parsed)
      .map(([key, value]) => [key, value.replace(/\n{3,}/g, '\n\n').trim()])
      .filter(([, value]) => Boolean(value))
  );
};

const pickFirstNonEmptyText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }

  return '';
};

const isLikelyRawJobDescription = (input: string, parsedInput: Record<string, string>): boolean => {
  if (!input.trim()) return false;
  if (Object.keys(parsedInput).length === 0) return input.trim().length >= 80;

  const nonDescriptionKeys = Object.keys(parsedInput).filter((key) =>
    !['application_link', 'apply_link', 'job_url', 'expires_at'].includes(key)
  );
  if (nonDescriptionKeys.length === 0) {
    const sanitizedInput = normalizeExtractedText(input);
    return sanitizedInput.length >= 80;
  }

  return false;
};

const extractFullDescriptionCandidate = (
  input: string,
  parsedInput: Record<string, string>,
  aiFields?: AiJobFieldMap
): string => {
  return pickFirstNonEmptyText(
    aiFields?.full_description,
    aiFields?.description,
    aiFields?.job_description,
    aiFields?.full_job_description,
    aiFields?.jd,
    aiFields?.job_details,
    parsedInput.full_description,
    parsedInput.description,
    parsedInput.job_description,
    parsedInput.full_job_description,
    parsedInput.jd,
    parsedInput.job_details,
    isLikelyRawJobDescription(input, parsedInput) ? input : ''
  );
};

const extractShortDescriptionCandidate = (
  parsedInput: Record<string, string>,
  aiFields?: AiJobFieldMap
): string => {
  return pickFirstNonEmptyText(
    aiFields?.short_description,
    aiFields?.summary,
    aiFields?.job_summary,
    parsedInput.short_description,
    parsedInput.summary,
    parsedInput.job_summary
  );
};

const buildExtractedShortDescription = (job: ExtractedJobFromUrl): string => {
  const shortDescription = normalizeExtractedText(job.short_description);
  if (shortDescription) return shortDescription;

  const fullDescription = normalizeExtractedText(job.full_job_description);
  if (!fullDescription) return '';

  return buildShortDescriptionFromText(fullDescription);
};

const buildExtractedFullDescription = (job: ExtractedJobFromUrl): string => {
  const fullDescription = normalizeExtractedText(job.full_job_description);
  if (fullDescription) return fullDescription;

  return normalizeExtractedText(job.short_description);
};

interface JobUploadFormProps {
  mode?: 'create' | 'edit';
}

const DEFAULT_JOB_FORM_VALUES: Partial<JobFormData> = {
  is_active: true,
  package_type: 'CTC',
  location_type: 'Remote',
  eligible_years: '',
  expires_at: '',
  skills: '',
};

interface ExtractedJobFormValuesResult {
  nextValues: Partial<JobFormData>;
  appliedFields: Array<keyof JobFormData>;
  updatedCount: number;
  normalizedSourcePlatform: string | null;
  platformLabel: string;
  logoReusedFromDatabase: boolean;
  normalizedLogoUrl: string;
  packageAmountPlaceholder: string;
  packageAmountSourceNote: string | null;
}

interface BulkImportFailure {
  url: string;
  reason: string;
}

interface BulkImportCreatedJob {
  companyName: string;
  roleTitle: string;
  url: string;
}

interface BulkImportSummary {
  totalUrls: number;
  createdCount: number;
  failed: BulkImportFailure[];
  createdJobs: BulkImportCreatedJob[];
}

const createDefaultBulkUrlRows = (): string[] => [''];

const extractUrlsFromText = (value: string): string[] => {
  // Support comma/semicolon/pipe-separated URL batches in addition to whitespace/newlines.
  const normalizedInput = value.replace(/([,;|])(?=https?:\/\/)/gi, '$1 ');
  const matches = normalizedInput.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];

  matches.forEach((match) => {
    const normalized = match.replace(/[,),.;!?]+$/g, '').trim();
    if (!normalized) return;

    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) return;

    seen.add(dedupeKey);
    urls.push(normalized);
  });

  return urls;
};

const extractUrlsFromBulkInputs = (values: string[]): string[] => {
  const seen = new Set<string>();
  const urls: string[] = [];

  values.forEach((value) => {
    extractUrlsFromText(value).forEach((url) => {
      const dedupeKey = url.toLowerCase();
      if (seen.has(dedupeKey)) return;

      seen.add(dedupeKey);
      urls.push(url);
    });
  });

  return urls;
};

const formatValidationFieldLabel = (field: string): string =>
  field
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const getValidationErrorMessage = (error: z.ZodError<JobFormData>): string => {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Extracted job data is incomplete. Review the URL manually.';
  }

  if (firstIssue.message === 'Required' && typeof firstIssue.path[0] === 'string') {
    return `${formatValidationFieldLabel(firstIssue.path[0])} is required`;
  }

  return firstIssue.message || 'Extracted job data is incomplete. Review the URL manually.';
};

const buildFormValuesFromExtractedJob = (
  extractedJob: ExtractedJobFromUrl,
  fallbackUrl: string,
  options?: {
    baseValues?: Partial<JobFormData>;
    clearPackageTypeWithoutAmount?: boolean;
  }
): ExtractedJobFormValuesResult => {
  const nextValues = { ...(options?.baseValues ?? {}) };
  const appliedFields = new Set<keyof JobFormData>();

  const applyValue = <K extends keyof JobFormData>(field: K, value: JobFormData[K]) => {
    if (nextValues[field] === value) return;
    nextValues[field] = value;
    appliedFields.add(field);
  };

  const normalizedCompanyName = normalizeExtractedText(extractedJob.company_name);
  if (normalizedCompanyName) applyValue('company_name', normalizedCompanyName);

  const normalizedLogoUrl = normalizeExtractedText(extractedJob.company_logo_url);
  if (normalizedLogoUrl) applyValue('company_logo_url', normalizedLogoUrl);

  const normalizedRoleTitle = normalizeExtractedText(extractedJob.role_title);
  if (normalizedRoleTitle) applyValue('role_title', normalizedRoleTitle);

  const normalizedDomain = normalizeExtractedText(extractedJob.domain);
  if (normalizedDomain) applyValue('domain', normalizedDomain);

  const normalizedPackageAmount = normalizePositiveNumber(extractedJob.package_amount);
  const extractedPackageText = normalizeExtractedText(extractedJob.package_amount);
  let packageAmountPlaceholder = DEFAULT_PACKAGE_AMOUNT_PLACEHOLDER;
  let packageAmountSourceNote: string | null = null;

  if (normalizedPackageAmount !== null) {
    applyValue('package_amount', normalizedPackageAmount);
  } else {
    packageAmountPlaceholder = extractedPackageText || DEFAULT_PACKAGE_AMOUNT_PLACEHOLDER;
    packageAmountSourceNote = extractedPackageText
      ? `Source package value: ${extractedPackageText}. This will stay empty unless you enter a numeric amount.`
      : null;

    if (options?.clearPackageTypeWithoutAmount) {
      applyValue('package_type', undefined as JobFormData['package_type']);
    }
  }

  const normalizedPackageType = normalizeExtractedPackageType(extractedJob.package_type);
  if (normalizedPackageAmount !== null && normalizedPackageType) {
    applyValue('package_type', normalizedPackageType);
  }

  const normalizedCity = normalizeExtractedText(extractedJob.city);
  const normalizedLocationType = normalizeExtractedText(extractedJob.location_type);
  if (normalizedLocationType || normalizedCity) {
    applyValue(
      'location_type',
      normalizeExtractedLocationType(extractedJob.location_type, extractedJob.city)
    );
  }

  if (normalizedCity) {
    applyValue('location_city', normalizedCity);
  }

  const normalizedExperience = normalizeExtractedText(extractedJob.experience_required);
  if (normalizedExperience) applyValue('experience_required', normalizedExperience);

  const normalizedQualification = normalizeExtractedText(extractedJob.qualification);
  if (normalizedQualification) applyValue('qualification', normalizedQualification);

  const normalizedEligibleYears = normalizeExtractedText(extractedJob.eligible_graduation_years);
  if (normalizedEligibleYears) {
    applyValue('eligible_years', normalizedEligibleYears);
  }

  const normalizedExpiryDate = normalizeDateInputValue(extractedJob.expires_at);
  if (normalizedExpiryDate) {
    applyValue('expires_at', normalizedExpiryDate);
  }

  const normalizedSkills = normalizeExtractedSkills(extractedJob.required_skills);
  if (normalizedSkills) {
    applyValue('skills', normalizedSkills);
  }

  const normalizedShortDescription = buildExtractedShortDescription(extractedJob);
  if (normalizedShortDescription) {
    applyValue('short_description', normalizedShortDescription);
  }

  const normalizedFullDescription = buildExtractedFullDescription(extractedJob);
  if (normalizedFullDescription) {
    applyValue('full_description', normalizedFullDescription);
  }

  const normalizedApplicationLink =
    normalizeExtractedText(extractedJob.application_link) ||
    normalizeExtractedText(extractedJob.source_url) ||
    fallbackUrl;
  if (normalizedApplicationLink) {
    applyValue('application_link', normalizedApplicationLink);
  }

  const normalizedSourcePlatform = normalizeExtractedText(extractedJob.source_platform) || null;

  return {
    nextValues,
    appliedFields: Array.from(appliedFields),
    updatedCount: appliedFields.size,
    normalizedSourcePlatform,
    platformLabel: normalizedSourcePlatform || 'job page',
    logoReusedFromDatabase: !!extractedJob.logo_reused_from_database,
    normalizedLogoUrl,
    packageAmountPlaceholder,
    packageAmountSourceNote,
  };
};

export const JobUploadForm: React.FC<JobUploadFormProps> = ({ mode = 'create' }) => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const isEditMode = mode === 'edit';
  const jobUrlInputRef = useRef<HTMLInputElement | null>(null);
  const aiKeyValueInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJobData, setIsLoadingJobData] = useState(isEditMode);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [packageAmountPlaceholder, setPackageAmountPlaceholder] = useState(DEFAULT_PACKAGE_AMOUNT_PLACEHOLDER);
  const [packageAmountSourceNote, setPackageAmountSourceNote] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showDraftNotification, setShowDraftNotification] = useState(false);
  const [bulkJobUrlInputs, setBulkJobUrlInputs] = useState<string[]>(createDefaultBulkUrlRows);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkImportSummary, setBulkImportSummary] = useState<BulkImportSummary | null>(null);
  const [bulkImportProgress, setBulkImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [isUrlExtracting, setIsUrlExtracting] = useState(false);
  const [isAutoCreatingFromUrl, setIsAutoCreatingFromUrl] = useState(false);
  const [urlExtractError, setUrlExtractError] = useState<string | null>(null);
  const [urlExtractSuccess, setUrlExtractSuccess] = useState<string | null>(null);
  const [extractedSourcePlatform, setExtractedSourcePlatform] = useState<string | null>(null);
  const [aiKeyValueInput, setAiKeyValueInput] = useState('');
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [aiCheckError, setAiCheckError] = useState<string | null>(null);
  const [aiCheckSuccess, setAiCheckSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobListingSchema),
    defaultValues: DEFAULT_JOB_FORM_VALUES,
  });

  const watchedLocationType = watch('location_type');
  const formData = watch();
  const isUrlImportBusy = isUrlExtracting || isAutoCreatingFromUrl || isSubmitting || isBulkImporting;

  const applyFieldUpdate = <K extends keyof JobFormData>(field: K, value: JobFormData[K]) => {
    const currentValue = getValues(field);
    if (currentValue === value) return false;

    setValue(field, value, { shouldDirty: true, shouldValidate: true });
    if (field === 'company_logo_url') {
      setCompanyLogoUrl((value as string) || '');
    }

    return true;
  };

  const { saveStatus, loadDraft, deleteDraft, clearDraft } = useJobFormAutoSave({
    formData,
    enabled: !isEditMode && !isSubmitting && draftLoaded,
    debounceMs: 2000,
  });

  useEffect(() => {
    if (isEditMode) {
      setDraftLoaded(true);
      return;
    }

    const restoreDraft = async () => {
      const draft = await loadDraft();
      if (draft) {
        Object.entries(draft).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const typedKey = key as keyof JobFormData;
            setValue(typedKey, value as JobFormData[typeof typedKey], {
              shouldDirty: false,
            });
          }
        });
        if (draft.company_logo_url) {
          setCompanyLogoUrl(draft.company_logo_url);
        }
        setShowDraftNotification(true);
        setTimeout(() => setShowDraftNotification(false), 5000);
      }
      setDraftLoaded(true);
    };
    restoreDraft();
  }, [isEditMode, loadDraft, setValue]);

  useEffect(() => {
    if (!isEditMode) {
      setIsLoadingJobData(false);
      return;
    }

    if (!jobId) {
      setSubmitError('Job ID is missing.');
      setIsLoadingJobData(false);
      return;
    }

    const fetchJobData = async () => {
      setIsLoadingJobData(true);
      setSubmitError(null);

      try {
        const { data, error } = await supabase
          .from('job_listings')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) throw error;

        const resolvedLogoUrl = data.company_logo_url || data.company_logo || '';
        const eligibleYearsValue = Array.isArray(data.eligible_years)
          ? data.eligible_years.join(', ')
          : (data.eligible_years || '');
        const resolvedFullDescription =
          data.full_description || data.description || data.original_description || '';
        const resolvedShortDescription =
          data.short_description || buildShortDescriptionFromText(resolvedFullDescription);

        reset({
          company_name: data.company_name || '',
          company_logo_url: resolvedLogoUrl,
          role_title: data.role_title || '',
          package_amount: data.package_amount || undefined,
          package_type: data.package_type || 'CTC',
          domain: data.domain || '',
          location_type: data.location_type || 'Remote',
          location_city: data.location_city || '',
          experience_required: data.experience_required || '',
          qualification: data.qualification || '',
          eligible_years: eligibleYearsValue,
          expires_at: normalizeDateInputValue(data.expires_at),
          skills: parseSkillsInput(data.skills).join(', '),
          short_description: resolvedShortDescription,
          full_description: resolvedFullDescription,
          application_link: data.application_link || '',
          is_active: data.is_active ?? true,
          referral_person_name: data.referral_person_name || '',
          referral_email: data.referral_email || '',
          referral_code: data.referral_code || '',
          referral_link: data.referral_link || '',
          referral_bonus_amount: data.referral_bonus_amount || undefined,
          referral_terms: data.referral_terms || '',
          test_requirements: data.test_requirements || '',
          has_coding_test: !!data.has_coding_test,
          has_aptitude_test: !!data.has_aptitude_test,
          has_technical_interview: !!data.has_technical_interview,
          has_hr_interview: !!data.has_hr_interview,
          test_duration_minutes: data.test_duration_minutes || undefined,
        });

        setCompanyLogoUrl(resolvedLogoUrl);
        setPackageAmountPlaceholder(DEFAULT_PACKAGE_AMOUNT_PLACEHOLDER);
        setPackageAmountSourceNote(null);
      } catch (error) {
        console.error('Error fetching job listing for edit:', error);
        setSubmitError(error instanceof Error ? error.message : 'Failed to load job listing');
      } finally {
        setIsLoadingJobData(false);
      }
    };

    fetchJobData();
  }, [isEditMode, jobId, reset]);

  const handleClearDraft = () => {
    clearDraft();
    reset(DEFAULT_JOB_FORM_VALUES);
    setCompanyLogoUrl('');
    setPackageAmountPlaceholder(DEFAULT_PACKAGE_AMOUNT_PLACEHOLDER);
    setPackageAmountSourceNote(null);
    setShowDraftNotification(false);
    setBulkJobUrlInputs(createDefaultBulkUrlRows());
    setBulkImportError(null);
    setBulkImportSummary(null);
    setBulkImportProgress(null);
    setJobUrlInput('');
    setUrlExtractError(null);
    setUrlExtractSuccess(null);
    setExtractedSourcePlatform(null);
    setAiCheckError(null);
    setAiCheckSuccess(null);
    setAiKeyValueInput('');
  };

  const buildJobPayload = (
    data: JobFormData,
    options?: {
      sourcePlatformOverride?: string | null;
      companyLogoUrlOverride?: string | null;
    }
  ): Partial<JobListing> => {
    const normalizedPackageAmount =
      typeof data.package_amount === 'number' && Number.isFinite(data.package_amount) && data.package_amount > 0
        ? data.package_amount
        : undefined;
    const normalizedExpiryAt = normalizeExpiryForSave(data.expires_at);
    const rawCompanyLogoUrl =
      options && 'companyLogoUrlOverride' in options
        ? options.companyLogoUrlOverride
        : (companyLogoUrl || data.company_logo_url);
    const resolvedCompanyLogoUrl = normalizeOptionalTextForSave(
      rawCompanyLogoUrl
    );
    const isExpiredAtSaveTime =
      typeof normalizedExpiryAt === 'string' &&
      !Number.isNaN(new Date(normalizedExpiryAt).getTime()) &&
      new Date(normalizedExpiryAt).getTime() <= Date.now();

    return {
      company_name: data.company_name,
      company_logo_url: resolvedCompanyLogoUrl,
      role_title: data.role_title,
      package_amount: normalizedPackageAmount,
      package_type: normalizedPackageAmount ? data.package_type || undefined : undefined,
      domain: data.domain,
      location_type: data.location_type,
      location_city: normalizeOptionalTextForSave(data.location_city),
      experience_required: data.experience_required,
      qualification: data.qualification,
      eligible_years: normalizeOptionalTextForSave(data.eligible_years),
      skills: normalizeSkillsForSave(data.skills),
      short_description: data.short_description,
      full_description: data.full_description,
      application_link: data.application_link,
      expires_at: normalizedExpiryAt,
      source_api: options?.sourcePlatformOverride ? `manual_extract_${options.sourcePlatformOverride}` : undefined,
      is_active: isExpiredAtSaveTime ? false : data.is_active,

      referral_person_name: normalizeOptionalTextForSave(data.referral_person_name),
      referral_email: normalizeOptionalTextForSave(data.referral_email),
      referral_code: normalizeOptionalTextForSave(data.referral_code),
      referral_link: normalizeOptionalTextForSave(data.referral_link),
      referral_bonus_amount: data.referral_bonus_amount || undefined,
      referral_terms: normalizeOptionalTextForSave(data.referral_terms),

      test_requirements: normalizeOptionalTextForSave(data.test_requirements),
      has_coding_test: data.has_coding_test || false,
      has_aptitude_test: data.has_aptitude_test || false,
      has_technical_interview: data.has_technical_interview || false,
      has_hr_interview: data.has_hr_interview || false,
      test_duration_minutes: data.test_duration_minutes || undefined,
    };
  };

  const resetCreateFormForNextUrl = async () => {
    await deleteDraft();
    reset(DEFAULT_JOB_FORM_VALUES);
    setCompanyLogoUrl('');
    setPackageAmountPlaceholder(DEFAULT_PACKAGE_AMOUNT_PLACEHOLDER);
    setPackageAmountSourceNote(null);
    setJobUrlInput('');
    setUrlExtractError(null);
    setExtractedSourcePlatform(null);
    setAiCheckError(null);
    setAiCheckSuccess(null);
    setAiKeyValueInput('');
  };

  const persistJobListing = async (
    data: JobFormData,
    options?: {
      stayOnPageAfterCreate?: boolean;
      sourcePlatformOverride?: string | null;
      successMessage?: string;
      successMessageTarget?: 'url' | 'ai';
      focusTarget?: 'url' | 'ai' | 'none';
    }
  ) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const jobData = buildJobPayload(data, {
        sourcePlatformOverride: options?.sourcePlatformOverride ?? extractedSourcePlatform,
      });

      if (isEditMode) {
        if (!jobId) {
          throw new Error('Job ID is missing.');
        }

        await jobsService.updateJobListing(jobId, jobData);
      } else {
        await jobsService.createJobListing(jobData);
      }

      setSubmitSuccess(true);

      if (!isEditMode) {
        await resetCreateFormForNextUrl();
      }

      if (options?.stayOnPageAfterCreate && !isEditMode) {
        if (options.successMessage) {
          if (options.successMessageTarget === 'ai') {
            setAiCheckSuccess(options.successMessage);
          } else {
            setUrlExtractSuccess(options.successMessage);
          }
        }
        window.setTimeout(() => {
          setSubmitSuccess(false);
        }, 4000);
        window.setTimeout(() => {
          if (options.focusTarget === 'none') {
            return;
          }

          if (options.focusTarget === 'ai') {
            aiKeyValueInputRef.current?.focus();
            return;
          }

          jobUrlInputRef.current?.focus();
        }, 0);
        return;
      }

      if (isEditMode) {
        window.setTimeout(() => {
          setSubmitSuccess(false);
        }, 4000);
        return;
      }

      setTimeout(() => {
        setSubmitSuccess(false);
        navigate('/admin/jobs');
      }, 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} job listing`);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyExtractedJobToForm = (
    extractedJob: ExtractedJobFromUrl,
    fallbackUrl: string,
    options?: { replaceExisting?: boolean }
  ) => {
    const nextValues = options?.replaceExisting
      ? { ...DEFAULT_JOB_FORM_VALUES }
      : { ...getValues() };

    if (options?.replaceExisting) {
      reset(DEFAULT_JOB_FORM_VALUES);
      setCompanyLogoUrl('');
    }

    const extractionResult = buildFormValuesFromExtractedJob(extractedJob, fallbackUrl, {
      baseValues: nextValues,
      clearPackageTypeWithoutAmount: !!options?.replaceExisting,
    });
    let updatedCount = 0;

    extractionResult.appliedFields.forEach((field) => {
      const nextValue = extractionResult.nextValues[field] as JobFormData[typeof field];
      if (applyFieldUpdate(field, nextValue)) {
        updatedCount += 1;
      }
    });

    setPackageAmountPlaceholder(extractionResult.packageAmountPlaceholder);
    setPackageAmountSourceNote(extractionResult.packageAmountSourceNote);
    setExtractedSourcePlatform(extractionResult.normalizedSourcePlatform);

    return {
      updatedCount,
      nextValues: extractionResult.nextValues,
      normalizedSourcePlatform: extractionResult.normalizedSourcePlatform,
      platformLabel: extractionResult.platformLabel,
      logoReusedFromDatabase: extractionResult.logoReusedFromDatabase,
    };
  };

  const handleExtractFromJobUrl = async (options?: { jobUrl?: string; autoCreate?: boolean }) => {
    const trimmedUrl = (options?.jobUrl ?? jobUrlInput).trim();

    if (!trimmedUrl) {
      setUrlExtractError('Paste a job URL first, then extract.');
      setUrlExtractSuccess(null);
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setUrlExtractError('Enter a valid URL starting with http:// or https://');
      setUrlExtractSuccess(null);
      return;
    }

    setIsUrlExtracting(true);
    setIsAutoCreatingFromUrl(!!options?.autoCreate);
    setUrlExtractError(null);
    setUrlExtractSuccess(null);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const extractedJob = await jobExtractionService.extractJobFromUrl(trimmedUrl);
      const extractionResult = applyExtractedJobToForm(extractedJob, trimmedUrl, {
        replaceExisting: !!options?.autoCreate && !isEditMode,
      });

      if (extractionResult.updatedCount === 0) {
        setUrlExtractError('No usable job fields were extracted from this URL.');
        return;
      }

      const logoNote = extractionResult.logoReusedFromDatabase
        ? ' Existing company logo was reused from your database.'
        : '';

      if (options?.autoCreate && !isEditMode) {
        const validationResult = jobListingSchema.safeParse(extractionResult.nextValues);
        if (!validationResult.success) {
          const firstIssue = validationResult.error.issues[0];
          setUrlExtractSuccess(
            `Extracted ${extractionResult.updatedCount} field${extractionResult.updatedCount > 1 ? 's' : ''} from ${extractionResult.platformLabel}.${logoNote}`
          );
          setUrlExtractError(
            firstIssue?.message
              ? `Job extracted, but auto-create stopped: ${firstIssue.message}. Review the form and save manually.`
              : 'Job extracted, but auto-create stopped. Review the form and save manually.'
          );
          return;
        }

        await persistJobListing(validationResult.data, {
          stayOnPageAfterCreate: true,
          sourcePlatformOverride: extractionResult.normalizedSourcePlatform,
          successMessage: `Job created automatically from ${extractionResult.platformLabel}. Paste the next URL.`,
        });
        return;
      }

      setUrlExtractSuccess(
        `Extracted ${extractionResult.updatedCount} field${extractionResult.updatedCount > 1 ? 's' : ''} from ${extractionResult.platformLabel}.${logoNote}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extract job details from the URL.';
      setUrlExtractError(message);
    } finally {
      setIsUrlExtracting(false);
      setIsAutoCreatingFromUrl(false);
    }
  };

  const handleBulkUrlInputChange = (index: number, value: string) => {
    setBulkJobUrlInputs((currentValues) =>
      currentValues.map((currentValue, currentIndex) => (currentIndex === index ? value : currentValue))
    );
  };

  const handleAddBulkUrlInput = () => {
    setBulkJobUrlInputs((currentValues) => [...currentValues, '']);
  };

  const handleRemoveBulkUrlInput = (index: number) => {
    setBulkJobUrlInputs((currentValues) => {
      if (currentValues.length <= 1) {
        return createDefaultBulkUrlRows();
      }

      return currentValues.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleBulkCreateFromUrls = async () => {
    if (isEditMode || isUrlImportBusy) return;

    const urls = extractUrlsFromBulkInputs(bulkJobUrlInputs);
    if (urls.length === 0) {
      setBulkImportError('Add one or more valid job URLs first.');
      setBulkImportSummary(null);
      return;
    }

    setIsBulkImporting(true);
    setBulkImportError(null);
    setBulkImportSummary(null);
    setBulkImportProgress({ current: 0, total: urls.length });
    setSubmitError(null);
    setSubmitSuccess(false);
    setUrlExtractError(null);
    setUrlExtractSuccess(null);

    const failed: BulkImportFailure[] = [];
    const createdJobs: BulkImportCreatedJob[] = [];

    try {
      for (let index = 0; index < urls.length; index += 1) {
        const url = urls[index];
        setBulkImportProgress({ current: index + 1, total: urls.length });

        try {
          const extractedJob = await jobExtractionService.extractJobFromUrl(url, { aiMode: 'bulk' });
          const extractionResult = buildFormValuesFromExtractedJob(extractedJob, url, {
            baseValues: { ...DEFAULT_JOB_FORM_VALUES },
            clearPackageTypeWithoutAmount: true,
          });

          if (extractionResult.updatedCount === 0) {
            throw new Error('No usable job fields were extracted from this URL.');
          }

          const validationResult = jobListingSchema.safeParse(extractionResult.nextValues);
          if (!validationResult.success) {
            throw new Error(getValidationErrorMessage(validationResult.error));
          }

          const jobPayload = buildJobPayload(validationResult.data, {
            sourcePlatformOverride: extractionResult.normalizedSourcePlatform,
            companyLogoUrlOverride: extractionResult.normalizedLogoUrl,
          });

          await jobsService.createJobListing(jobPayload);
          createdJobs.push({
            companyName: validationResult.data.company_name,
            roleTitle: validationResult.data.role_title,
            url,
          });
        } catch (error) {
          failed.push({
            url,
            reason: error instanceof Error ? error.message : 'Failed to create this job listing.',
          });
        }
      }
    } finally {
      setIsBulkImporting(false);
      setBulkImportProgress(null);
    }

    setBulkImportSummary({
      totalUrls: urls.length,
      createdCount: createdJobs.length,
      failed,
      createdJobs,
    });

    setBulkJobUrlInputs(failed.length > 0 ? failed.map((item) => item.url) : createDefaultBulkUrlRows());

    if (createdJobs.length === 0) {
      setBulkImportError('No jobs were created. Review the failed URLs below and retry.');
      return;
    }

    setBulkImportError(null);
    window.setTimeout(() => {
      jobUrlInputRef.current?.focus();
    }, 0);
  };

  const handleAiCheckAndFill = async () => {
    const trimmedInput = aiKeyValueInput.trim();
    if (!trimmedInput) {
      setAiCheckError('Add job details or a job description first, then run AI fill.');
      setAiCheckSuccess(null);
      return;
    }

    setIsAiChecking(true);
    setAiCheckError(null);
    setAiCheckSuccess(null);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const currentFormValues = getValues();
      const nextValues: JobFormData = { ...currentFormValues };
      const parsedAdminInput = parseAdminKeyValueInput(trimmedInput);
      const systemPrompt = [
        'You are an assistant that converts admin job notes or a pasted job description into job form values.',
        'Return only a valid JSON object with keys from the allowed list.',
        `Allowed keys: ${AI_ALLOWED_JOB_FIELDS.join(', ')}.`,
        'Do not return markdown, explanation, or extra keys.',
        'Use location_type exactly as Remote, Onsite, or Hybrid.',
        'Use package_type exactly as CTC, stipend, or hourly.',
        'Use boolean values for checkbox fields.',
        'If the input contains a job description, map it into full_description and create short_description when possible.',
        'If a value is unknown, omit that key.',
      ].join(' ');

      const userPrompt = [
        'Admin input (may be key:value notes or a raw job description):',
        trimmedInput,
        '',
        'Current form values (useful context):',
        JSON.stringify(currentFormValues, null, 2),
        '',
        'Fill missing values, correct clearly wrong values, and keep good existing values.',
      ].join('\n');

      const aiResponse = await openrouter.chatWithSystem(systemPrompt, userPrompt, {
        temperature: 0.1,
      });

      const parsed = parseAiJsonObject(aiResponse) as AiJobFieldMap;
      let updatedCount = 0;

      const applyFormValue = <K extends keyof JobFormData>(field: K, value: JobFormData[K]) => {
        nextValues[field] = value;
        if (applyFieldUpdate(field, value)) {
          updatedCount += 1;
        }
      };

      const applyStringField = (field: keyof JobFormData, rawValue: unknown) => {
        if (typeof rawValue !== 'string') return;
        const normalized = rawValue.trim();
        const isOptional = OPTIONAL_STRING_FIELDS.has(field);
        if (!normalized && !isOptional) return;
        applyFormValue(field, normalized as JobFormData[typeof field]);
      };

      const applyNumberField = (
        field: 'package_amount' | 'referral_bonus_amount' | 'test_duration_minutes',
        rawValue: unknown
      ) => {
        if (rawValue === null || rawValue === '') return;
        const normalized = normalizePositiveNumber(rawValue);
        if (normalized === null) return;
        applyFormValue(field, normalized as JobFormData[typeof field]);
      };

      const applyBooleanField = (
        field: 'is_active' | 'has_coding_test' | 'has_aptitude_test' | 'has_technical_interview' | 'has_hr_interview',
        rawValue: unknown
      ) => {
        const normalized = normalizeBoolean(rawValue);
        if (normalized === null) return;
        applyFormValue(field, normalized as JobFormData[typeof field]);
      };

      applyStringField('company_name', pickFirstNonEmptyText(parsed.company_name, parsed.company, parsedAdminInput.company_name, parsedAdminInput.company));
      applyStringField('company_logo_url', parsed.company_logo_url);
      applyStringField('role_title', pickFirstNonEmptyText(parsed.role_title, parsed.role, parsed.title, parsedAdminInput.role_title, parsedAdminInput.role, parsedAdminInput.title));
      applyStringField('domain', parsed.domain);
      applyStringField('location_city', pickFirstNonEmptyText(parsed.location_city, parsed.city, parsedAdminInput.location_city, parsedAdminInput.city));
      applyStringField('experience_required', pickFirstNonEmptyText(parsed.experience_required, parsed.experience, parsedAdminInput.experience_required, parsedAdminInput.experience));
      applyStringField('qualification', pickFirstNonEmptyText(parsed.qualification, parsed.education, parsedAdminInput.qualification, parsedAdminInput.education));
      applyStringField('eligible_years', parsed.eligible_years);
      const resolvedSkills = parsed.skills ?? parsed.required_skills ?? parsed.skills_required ?? parsedAdminInput.skills ?? parsedAdminInput.required_skills ?? parsedAdminInput.skills_required;
      if (typeof resolvedSkills === 'string' || Array.isArray(resolvedSkills)) {
        const normalizedSkills = parseSkillsInput(resolvedSkills as string | string[]);
        applyFormValue('skills', normalizedSkills.join(', '));
      }
      const resolvedFullDescription = extractFullDescriptionCandidate(trimmedInput, parsedAdminInput, parsed);
      const resolvedShortDescription =
        extractShortDescriptionCandidate(parsedAdminInput, parsed) ||
        buildShortDescriptionFromText(resolvedFullDescription);
      applyStringField('short_description', resolvedShortDescription);
      applyStringField('full_description', resolvedFullDescription);
      applyStringField('application_link', pickFirstNonEmptyText(parsed.application_link, parsed.apply_link, parsed.job_url, parsedAdminInput.application_link, parsedAdminInput.apply_link, parsedAdminInput.job_url));
      applyStringField('expires_at', normalizeDateInputValue(pickFirstNonEmptyText(
        typeof parsed.expires_at === 'string' ? parsed.expires_at : '',
        parsedAdminInput.expires_at
      )));
      applyStringField('referral_person_name', parsed.referral_person_name);
      applyStringField('referral_email', parsed.referral_email);
      applyStringField('referral_code', parsed.referral_code);
      applyStringField('referral_link', parsed.referral_link);
      applyStringField('referral_terms', parsed.referral_terms);
      applyStringField('test_requirements', parsed.test_requirements);

      applyNumberField('package_amount', parsed.package_amount);
      applyNumberField('referral_bonus_amount', parsed.referral_bonus_amount);
      applyNumberField('test_duration_minutes', parsed.test_duration_minutes);

      if (typeof parsed.package_type === 'string') {
        const packageType = parsed.package_type.trim().toLowerCase();
        if (packageType === 'ctc') applyFormValue('package_type', 'CTC');
        if (packageType === 'stipend') applyFormValue('package_type', 'stipend');
        if (packageType === 'hourly') applyFormValue('package_type', 'hourly');
      }

      if (typeof parsed.location_type === 'string') {
        const locationType = parsed.location_type.trim().toLowerCase();
        if (locationType === 'remote') applyFormValue('location_type', 'Remote');
        if (locationType === 'onsite') applyFormValue('location_type', 'Onsite');
        if (locationType === 'hybrid') applyFormValue('location_type', 'Hybrid');
      } else {
        const locationModeHint = pickFirstNonEmptyText(
          typeof parsed.work_mode === 'string' ? parsed.work_mode : '',
          parsedAdminInput.location_type,
          parsedAdminInput.work_mode
        );
        const locationCityHint = pickFirstNonEmptyText(
          typeof parsed.location_city === 'string' ? parsed.location_city : '',
          typeof parsed.city === 'string' ? parsed.city : '',
          parsedAdminInput.location_city,
          parsedAdminInput.city
        );
        if (locationModeHint || locationCityHint) {
          const normalizedLocationType = normalizeExtractedLocationType(locationModeHint, locationCityHint);
          applyFormValue('location_type', normalizedLocationType);
        }
      }

      applyBooleanField('is_active', parsed.is_active);
      applyBooleanField('has_coding_test', parsed.has_coding_test);
      applyBooleanField('has_aptitude_test', parsed.has_aptitude_test);
      applyBooleanField('has_technical_interview', parsed.has_technical_interview);
      applyBooleanField('has_hr_interview', parsed.has_hr_interview);

      if (updatedCount === 0) {
        setAiCheckError('AI returned no usable updates. Try clearer job details or paste the JD directly.');
        return;
      }

      if (!isEditMode) {
        const validationResult = jobListingSchema.safeParse(nextValues);
        if (!validationResult.success) {
          const firstIssue = validationResult.error.issues[0];
          setAiCheckSuccess(
            `AI updated ${updatedCount} field${updatedCount > 1 ? 's' : ''}. Review the form and create the job manually.`
          );
          setAiCheckError(
            firstIssue?.message
              ? `AI filled the form, but auto-create stopped: ${firstIssue.message}.`
              : 'AI filled the form, but auto-create stopped. Review the form and save manually.'
          );
          return;
        }

        await persistJobListing(validationResult.data, {
          stayOnPageAfterCreate: true,
          successMessageTarget: 'ai',
          focusTarget: 'ai',
          successMessage: 'AI filled the form and created the job automatically. Paste the next details.',
        });
        return;
      }

      setAiCheckSuccess(
        `AI updated ${updatedCount} field${updatedCount > 1 ? 's' : ''}. Review and update the job.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI check failed. Please retry.';
      setAiCheckError(message);
    } finally {
      setIsAiChecking(false);
    }
  };

  const onSubmit = async (data: JobFormData) => {
    try {
      await persistJobListing(
        data,
        isEditMode
          ? undefined
          : {
              stayOnPageAfterCreate: true,
              focusTarget: 'none',
            }
      );
    } catch {
      return;
    }
  };

  const domainSuggestions = [
    'SDE', 'Data Science', 'Product', 'Design', 'Marketing', 'Sales',
    'Analytics', 'AI', 'DevOps', 'Mobile', 'Frontend', 'Backend',
    'Full-Stack', 'QA', 'Content', 'HR', 'Finance', 'Operations',
    'Cloud', 'Security', 'Blockchain', 'IoT', 'Machine Learning',
    'Data Engineering', 'Business Analyst', 'Consulting', 'Support',
  ];

  if (isLoadingJobData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-neon-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading job data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 lg:pl-16 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 py-3">
            <button
              onClick={() => navigate('/admin/jobs')}
              className="lg:hidden bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Jobs</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isEditMode ? 'Admin - Edit Job Listing' : 'Admin - Create Job Listing'}
            </h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              {isEditMode ? <Save className="w-10 h-10 text-white" /> : <Plus className="w-10 h-10 text-white" />}
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {isEditMode ? 'Update Job Listing' : 'Create New Job Listing'}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {isEditMode
                ? 'Edit the existing job with the same admin format used during creation'
                : 'Add a new job opportunity to help candidates find their dream role'}
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Job Details
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mt-1">
                    {isEditMode
                      ? 'Update the job details using the same admin fields available during creation'
                      : 'Fill in all the required information for the job listing'}
                  </p>
                </div>
                {!isEditMode && (
                  <div className="flex items-center space-x-2">
                  {saveStatus.status === 'saving' && (
                    <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Saving...</span>
                    </div>
                  )}
                  {saveStatus.status === 'saved' && saveStatus.lastSaved && (
                    <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Saved {new Date(saveStatus.lastSaved).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {saveStatus.status === 'error' && (
                    <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Save failed</span>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              {!isEditMode && showDraftNotification && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-blue-900/20 dark:border-blue-500/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                          Draft restored from previous session
                        </p>
                        <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                          Your form data has been automatically restored. Continue editing or start fresh.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 flex items-center space-x-1 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Draft</span>
                    </button>
                  </div>
                </div>
              )}

              {!isEditMode && (
                <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-dark-200 dark:to-dark-300 p-6 rounded-xl border border-emerald-100 dark:border-dark-400">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-emerald-600 dark:text-green-400" />
                    Bulk Create From Job URLs
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Add job URLs one by one. We will process them top to bottom, create all valid listings in Supabase, and auto-generate the WhatsApp updates for every created job.
                  </p>
                  <div className="space-y-3">
                    {bulkJobUrlInputs.map((value, index) => (
                      <div key={`bulk-job-url-${index}`} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/80 dark:bg-dark-100 border border-emerald-200 dark:border-dark-400 text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                          {index + 1}
                        </div>
                        <input
                          type="url"
                          value={value}
                          onChange={(event) => handleBulkUrlInputChange(index, event.target.value)}
                          disabled={isUrlImportBusy}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:disabled:bg-dark-300"
                          placeholder={`Job URL ${index + 1} - https://company.myworkdayjobs.com/...`}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveBulkUrlInput(index)}
                          disabled={isUrlImportBusy || bulkJobUrlInputs.length === 1}
                          className={`px-3 py-3 rounded-xl border transition-colors ${
                            isUrlImportBusy || bulkJobUrlInputs.length === 1
                              ? 'border-gray-200 text-gray-400 cursor-not-allowed dark:border-dark-400 dark:text-gray-500'
                              : 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-900/20'
                          }`}
                          aria-label={`Remove job URL ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Failed URLs stay in these rows after the run so you can retry only those links.
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={handleAddBulkUrlInput}
                        disabled={isUrlImportBusy}
                        className={`font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2 ${
                          isUrlImportBusy
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-dark-300 dark:text-gray-500'
                            : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 dark:bg-dark-100 dark:text-emerald-300 dark:border-emerald-500/40 dark:hover:bg-dark-100/80'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Another URL</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkCreateFromUrls}
                        disabled={isUrlImportBusy}
                        className={`font-semibold py-3 px-5 rounded-xl transition-colors flex items-center justify-center space-x-2 ${
                          isUrlImportBusy
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isBulkImporting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>
                              {bulkImportProgress
                                ? `Creating ${bulkImportProgress.current}/${bulkImportProgress.total}`
                                : 'Creating...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Users className="w-4 h-4" />
                            <span>Extract All & Create Jobs</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {bulkImportError && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">{bulkImportError}</p>
                  )}
                  {bulkImportSummary && (
                    <div className={`mt-4 rounded-xl border p-4 ${
                      bulkImportSummary.failed.length === 0
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-500/40'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/40'
                    }`}>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Created {bulkImportSummary.createdCount} of {bulkImportSummary.totalUrls} job listing{bulkImportSummary.totalUrls === 1 ? '' : 's'}.
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        WhatsApp updates are generated automatically for each successfully created job.
                      </p>
                      {bulkImportSummary.createdJobs.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Created
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                            {bulkImportSummary.createdJobs.slice(0, 5).map((job) => (
                              <li key={job.url}>
                                {job.companyName} - {job.roleTitle}
                              </li>
                            ))}
                            {bulkImportSummary.createdJobs.length > 5 && (
                              <li>+{bulkImportSummary.createdJobs.length - 5} more created jobs</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {bulkImportSummary.failed.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                            Failed URLs
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                            {bulkImportSummary.failed.map((item) => (
                              <li key={item.url}>
                                <p className="break-all">{item.url}</p>
                                <p className="text-xs text-red-600 dark:text-red-400">{item.reason}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-dark-200 dark:to-dark-300 p-6 rounded-xl border border-cyan-100 dark:border-dark-400">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <LinkIcon className="w-5 h-5 mr-2 text-cyan-600 dark:text-neon-cyan-400" />
                  Extract From Job URL
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {isEditMode
                    ? 'Paste a Workday, Superset, or Greenhouse job link to fill this form without saving yet.'
                    : 'Paste a Workday, Superset, or Greenhouse job link, then click the button to extract and create the job instantly.'}
                </p>
                <div className="flex flex-col lg:flex-row gap-3">
                  <input
                    ref={jobUrlInputRef}
                    type="url"
                    value={jobUrlInput}
                    onChange={(event) => setJobUrlInput(event.target.value)}
                    disabled={isUrlImportBusy}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:disabled:bg-dark-300"
                    placeholder="https://company.myworkdayjobs.com/... or https://boards.greenhouse.io/..."
                  />
                  <button
                    type="button"
                    onClick={() => handleExtractFromJobUrl({ autoCreate: !isEditMode })}
                    disabled={isUrlImportBusy}
                    className={`font-semibold py-3 px-5 rounded-xl transition-colors flex items-center justify-center space-x-2 ${
                      isUrlImportBusy
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                    }`}
                  >
                    {isAutoCreatingFromUrl ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : isUrlExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        <span>{isEditMode ? 'Extract Only' : 'Extract & Add'}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {isEditMode
                    ? 'Paste a valid URL to fill the current form only.'
                    : 'Nothing runs in the background. The job is extracted and added only when you click the button.'}
                </p>
                {urlExtractError && (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400">{urlExtractError}</p>
                )}
                {urlExtractSuccess && (
                  <p className="mt-3 text-sm text-green-600 dark:text-green-400">{urlExtractSuccess}</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-dark-200 dark:to-dark-300 p-6 rounded-xl border border-indigo-100 dark:border-dark-400">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-indigo-600 dark:text-neon-cyan-400" />
                  AI Job Details Check
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {isEditMode
                    ? 'Paste raw key:value job details or the full job description. AI will map the description into the form before you update the job.'
                    : 'Paste raw key:value job details or the full job description. AI will auto-fill the form and create the job when the required fields validate.'}
                </p>
                <textarea
                  ref={aiKeyValueInputRef}
                  value={aiKeyValueInput}
                  onChange={(event) => setAiKeyValueInput(event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-y dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder={`company_name: Acme Labs\nrole_title: Backend Engineer\ndomain: SDE\nlocation_type: Hybrid\nlocation_city: Bengaluru\nexperience_required: 2-4 years\nqualification: B.Tech CSE\nexpires_at: 2026-03-31\njob_description: We are hiring a backend engineer...\napplication_link: https://company.com/jobs/123\n\nOr paste the full JD directly here.`}
                />
                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tip: `description`, `job_description`, and a raw pasted JD all map into the job detail fields.
                  </p>
                  <button
                    type="button"
                    onClick={handleAiCheckAndFill}
                    disabled={isAiChecking}
                    className={`font-semibold py-2.5 px-5 rounded-lg transition-colors flex items-center space-x-2 ${
                      isAiChecking
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isAiChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isEditMode ? 'Checking...' : 'Checking & Adding...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{isEditMode ? 'AI Check & Fill' : 'AI Fill & Add'}</span>
                      </>
                    )}
                  </button>
                </div>
                {aiCheckError && (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400">{aiCheckError}</p>
                )}
                {aiCheckSuccess && (
                  <p className="mt-3 text-sm text-green-600 dark:text-green-400">{aiCheckSuccess}</p>
                )}
              </div>

              {/* Company Logo Upload Section */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-dark-200 dark:to-dark-300 p-6 rounded-xl border border-blue-100 dark:border-dark-400">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Image className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Company Branding
                </h3>
                <ImageUpload
                  currentImageUrl={companyLogoUrl}
                  onImageUploaded={(url) => {
                    setCompanyLogoUrl(url);
                    setValue('company_logo_url', url);
                  }}
                  onImageRemoved={() => {
                    setCompanyLogoUrl('');
                    setValue('company_logo_url', '');
                  }}
                />
              </div>
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm font-medium">{submitError}</p>
                  </div>
                </div>
              )}

              {submitSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 mt-0.5" />
                    <div>
                      <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">
                        {isEditMode ? 'Job listing updated successfully!' : 'Job listing created successfully! AI enhancement in progress...'}
                      </p>
                      {!isEditMode && (
                        <p className="text-green-600 dark:text-neon-cyan-400 text-xs mt-1">
                          Your job description will be automatically polished and enhanced by AI.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Company Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Company Name *
                  </label>
                  <input
                    type="text"
                    {...register('company_name')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Google, Microsoft, Startup Inc."
                  />
                  {errors.company_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.company_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Image className="w-4 h-4 inline mr-1" />
                    Company Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    {...register('company_logo_url')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="https://example.com/logo.png"
                  />
                  {errors.company_logo_url && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.company_logo_url.message}</p>
                  )}
                </div>
              </div>

              {/* Job Role Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Role Title *
                  </label>
                  <input
                    type="text"
                    {...register('role_title')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Senior Software Engineer, Product Manager"
                  />
                  {errors.role_title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.role_title.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Target className="w-4 h-4 inline mr-1" />
                    Domain *
                  </label>
                  <input
                    type="text"
                    {...register('domain')}
                    list="domain-suggestions"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., SDE, Data Science, Product, DevOps"
                  />
                  <datalist id="domain-suggestions">
                    {domainSuggestions.map(d => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Type a domain or pick from suggestions
                  </p>
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.domain.message}</p>
                  )}
                </div>
              </div>

              {/* Package Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <IndianRupee className="w-4 h-4 inline mr-1" />
                    Package Amount (Optional)
                  </label>
                  <input
                    type="number"
                    {...register('package_amount', { valueAsNumber: true })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder={packageAmountPlaceholder}
                    min="0"
                  />
                  {errors.package_amount && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.package_amount.message}</p>
                  )}
                  {!errors.package_amount && packageAmountSourceNote && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{packageAmountSourceNote}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Package Type
                  </label>
                  <select
                    {...register('package_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="">Select Type</option>
                    <option value="CTC">CTC (Annual)</option>
                    <option value="stipend">Stipend (Monthly)</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                  {errors.package_type && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.package_type.message}</p>
                  )}
                </div>
              </div>

              {/* Location Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location Type *
                  </label>
                  <select
                    {...register('location_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                  {errors.location_type && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location_type.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    City (Optional)
                  </label>
                  <input
                    type="text"
                    {...register('location_city')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Bangalore, Mumbai, Delhi"
                    disabled={watchedLocationType === 'Remote'}
                  />
                  {errors.location_city && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location_city.message}</p>
                  )}
                </div>
              </div>

              {/* Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Experience Required *
                  </label>
                  <input
                    type="text"
                    {...register('experience_required')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., 0-2 years, 3-5 years, 5+ years"
                  />
                  {errors.experience_required && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.experience_required.message}</p>
                  )}
                </div>

                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <GraduationCap className="w-4 h-4 inline mr-1" />
                  Qualification *
                </label>
                <input
                    type="text"
                    {...register('qualification')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., B.Tech/B.E in Computer Science, MBA"
                  />
                  {errors.qualification && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.qualification.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Eligible Graduation Years
                </label>
                <input
                  type="text"
                  {...register('eligible_years')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="e.g., 2024, 2025, 2026"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Mention the graduation batches that can apply. Separate multiple years with commas.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Code className="w-4 h-4 inline mr-1" />
                  Required Skills
                </label>
                <textarea
                  {...register('skills')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="React, TypeScript, Node.js, PostgreSQL"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Add comma-separated skills or one skill per line. These appear as searchable skill chips on job cards and the detail page.
                </p>
                {errors.skills && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.skills.message}</p>
                )}
              </div>
            </div>

              {/* Descriptions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Short Description *
                </label>
                <textarea
                  {...register('short_description')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="Brief overview of the role and company (50+ characters)"
                />
                {errors.short_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.short_description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Full Job Description *
                </label>
                <textarea
                  {...register('full_description')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="Complete job description including responsibilities, requirements, skills, and benefits (100+ characters)"
                />
                {errors.full_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.full_description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <ExternalLink className="w-4 h-4 inline mr-1" />
                    Application Link *
                  </label>
                  <input
                    type="url"
                    {...register('application_link')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="https://company.com/careers/apply"
                  />
                  {errors.application_link && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.application_link.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Application Deadline
                  </label>
                  <input
                    type="date"
                    {...register('expires_at')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    On this date, the job will automatically show as expired in the listings and details page.
                  </p>
                  {errors.expires_at && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.expires_at.message}</p>
                  )}
                </div>
              </div>

              {/* Referral Information Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 p-6 rounded-xl border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                  Referral Information (Optional)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Add employee referral contact details if someone from the company can refer candidates
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Users className="w-4 h-4 inline mr-1" />
                      Referral Person Name
                    </label>
                    <input
                      type="text"
                      {...register('referral_person_name')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., John Doe"
                    />
                    {errors.referral_person_name && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_person_name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Referral Email
                    </label>
                    <input
                      type="email"
                      {...register('referral_email')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="john.doe@company.com"
                    />
                    {errors.referral_email && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Code className="w-4 h-4 inline mr-1" />
                      Referral Code
                    </label>
                    <input
                      type="text"
                      {...register('referral_code')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., REF123ABC"
                    />
                    {errors.referral_code && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_code.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <LinkIcon className="w-4 h-4 inline mr-1" />
                      Referral Link
                    </label>
                    <input
                      type="url"
                      {...register('referral_link')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="https://company.com/referral/..."
                    />
                    {errors.referral_link && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_link.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Award className="w-4 h-4 inline mr-1" />
                      Referral Bonus Amount (₹)
                    </label>
                    <input
                      type="number"
                      {...register('referral_bonus_amount', { valueAsNumber: true })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., 50000"
                      min="0"
                    />
                    {errors.referral_bonus_amount && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_bonus_amount.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Referral Terms & Conditions
                    </label>
                    <textarea
                      {...register('referral_terms')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 h-20 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="Terms and conditions for the referral bonus (e.g., payable after 90 days of joining)"
                    />
                    {errors.referral_terms && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_terms.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Patterns Section */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <ClipboardCheck className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
                  Selection Process & Tests (Optional)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Specify the tests and interviews candidates will face during the selection process
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Test Requirements Overview
                    </label>
                    <textarea
                      {...register('test_requirements')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-20 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="Brief description of the overall selection process and what to expect"
                    />
                    {errors.test_requirements && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.test_requirements.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_coding_test')}
                        id="has_coding_test"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_coding_test" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Code className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        Coding Test
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_aptitude_test')}
                        id="has_aptitude_test"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_aptitude_test" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Target className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        Aptitude Test
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_technical_interview')}
                        id="has_technical_interview"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_technical_interview" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Sparkles className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        Technical Interview
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_hr_interview')}
                        id="has_hr_interview"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_hr_interview" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Users className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        HR Interview
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Estimated Total Duration (minutes)
                    </label>
                    <input
                      type="number"
                      {...register('test_duration_minutes', { valueAsNumber: true })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., 120"
                      min="0"
                    />
                    {errors.test_duration_minutes && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.test_duration_minutes.message}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Total estimated time for all tests and interviews combined
                    </p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  id="is_active"
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job is active and accepting applications
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-dark-300">
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/jobs')}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  {!isEditMode && isDirty && (
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="border-2 border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Clear Draft</span>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || isBulkImporting || !isDirty}
                  className={`font-semibold py-3 px-8 rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                    isSubmitting || isBulkImporting || !isDirty
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{isEditMode ? 'Updating Job...' : 'Creating Job...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>{isEditMode ? 'Update Job Listing' : 'Create Job Listing'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
