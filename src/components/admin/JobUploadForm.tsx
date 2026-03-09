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

// Helper to truly make optional number inputs tolerant of empty string/NaN from form
const optionalPositiveNumber = (message: string) =>
  z.preprocess(
    (val) => {
      if (val === '' || val === null || typeof val === 'undefined') return undefined;
      // react-hook-form with valueAsNumber can pass NaN when input is empty
      if (typeof val === 'number' && Number.isNaN(val)) return undefined;
      // strings that are numeric
      if (typeof val === 'string' && val.trim() === '') return undefined;
      return val;
    },
    z.number().positive(message).optional()
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

// Zod schema for job listing validation
const jobListingSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  role_title: z.string().min(1, 'Role title is required'),
  package_amount: optionalPositiveNumber('Package amount must be positive'),
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
  is_active: z.boolean().default(true),

  // Referral fields
  referral_person_name: z.string().optional(),
  referral_email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  referral_code: z.string().optional(),
  referral_link: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  referral_bonus_amount: optionalPositiveNumber('Bonus amount must be positive'),
  referral_terms: z.string().optional(),

  // Test pattern fields
  test_requirements: z.string().optional(),
  has_coding_test: z.boolean().default(false),
  has_aptitude_test: z.boolean().default(false),
  has_technical_interview: z.boolean().default(false),
  has_hr_interview: z.boolean().default(false),
  test_duration_minutes: optionalPositiveNumber('Duration must be positive'),
});

type JobFormData = z.infer<typeof jobListingSchema>;

type AiJobFieldValue = string | number | boolean | null | undefined;
type AiJobFieldMap = Partial<Record<keyof JobFormData, AiJobFieldValue>>;

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
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const sanitized = value.replace(/[^0-9.]/g, '');
  if (!sanitized) return null;
  const parsed = Number.parseFloat(sanitized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
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
  return value.replace(/\s+/g, ' ').trim();
};

const normalizeExtractedSkills = (value: unknown): string => {
  if (typeof value !== 'string' && !Array.isArray(value)) {
    return '';
  }

  return parseSkillsInput(value as string | string[]).join(', ');
};

const buildExtractedShortDescription = (job: ExtractedJobFromUrl): string => {
  const shortDescription = normalizeExtractedText(job.short_description);
  if (shortDescription) return shortDescription;

  const fullDescription = normalizeExtractedText(job.full_job_description);
  if (!fullDescription) return '';

  return fullDescription.slice(0, 220).trim();
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
  skills: '',
};

export const JobUploadForm: React.FC<JobUploadFormProps> = ({ mode = 'create' }) => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const isEditMode = mode === 'edit';
  const jobUrlInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJobData, setIsLoadingJobData] = useState(isEditMode);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showDraftNotification, setShowDraftNotification] = useState(false);
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
  const isUrlImportBusy = isUrlExtracting || isAutoCreatingFromUrl || isSubmitting;

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
          skills: parseSkillsInput(data.skills).join(', '),
          short_description: data.short_description || '',
          full_description: data.full_description || '',
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
    setShowDraftNotification(false);
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
    sourcePlatformOverride?: string | null
  ): Partial<JobListing> => ({
    company_name: data.company_name,
    company_logo_url: companyLogoUrl || data.company_logo_url || undefined,
    role_title: data.role_title,
    package_amount: data.package_amount || undefined,
    package_type: data.package_type || undefined,
    domain: data.domain,
    location_type: data.location_type,
    location_city: data.location_city || undefined,
    experience_required: data.experience_required,
    qualification: data.qualification,
    eligible_years: data.eligible_years?.trim() ? data.eligible_years.trim() : undefined,
    skills: parseSkillsInput(data.skills),
    short_description: data.short_description,
    full_description: data.full_description,
    application_link: data.application_link,
    source_api: sourcePlatformOverride ? `manual_extract_${sourcePlatformOverride}` : undefined,
    is_active: data.is_active,

    referral_person_name: data.referral_person_name || undefined,
    referral_email: data.referral_email || undefined,
    referral_code: data.referral_code || undefined,
    referral_link: data.referral_link || undefined,
    referral_bonus_amount: data.referral_bonus_amount || undefined,
    referral_terms: data.referral_terms || undefined,

    test_requirements: data.test_requirements || undefined,
    has_coding_test: data.has_coding_test || false,
    has_aptitude_test: data.has_aptitude_test || false,
    has_technical_interview: data.has_technical_interview || false,
    has_hr_interview: data.has_hr_interview || false,
    test_duration_minutes: data.test_duration_minutes || undefined,
  });

  const resetCreateFormForNextUrl = async () => {
    await deleteDraft();
    reset(DEFAULT_JOB_FORM_VALUES);
    setCompanyLogoUrl('');
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
    }
  ) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const jobData = buildJobPayload(data, options?.sourcePlatformOverride ?? extractedSourcePlatform);

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
          setUrlExtractSuccess(options.successMessage);
        }
        window.setTimeout(() => {
          setSubmitSuccess(false);
        }, 4000);
        window.setTimeout(() => {
          jobUrlInputRef.current?.focus();
        }, 0);
        return;
      }

      setTimeout(() => {
        setSubmitSuccess(false);
        navigate('/admin/jobs');
      }, isEditMode ? 1500 : 2000);
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
    let updatedCount = 0;
    const nextValues = options?.replaceExisting
      ? { ...DEFAULT_JOB_FORM_VALUES }
      : { ...getValues() };

    if (options?.replaceExisting) {
      reset(DEFAULT_JOB_FORM_VALUES);
      setCompanyLogoUrl('');
    }

    const applyIfChanged = <K extends keyof JobFormData>(field: K, value: JobFormData[K]) => {
      nextValues[field] = value;
      if (applyFieldUpdate(field, value)) {
        updatedCount += 1;
      }
    };

    const normalizedCompanyName = normalizeExtractedText(extractedJob.company_name);
    if (normalizedCompanyName) applyIfChanged('company_name', normalizedCompanyName);

    const normalizedLogoUrl = normalizeExtractedText(extractedJob.company_logo_url);
    if (normalizedLogoUrl) applyIfChanged('company_logo_url', normalizedLogoUrl);

    const normalizedRoleTitle = normalizeExtractedText(extractedJob.role_title);
    if (normalizedRoleTitle) applyIfChanged('role_title', normalizedRoleTitle);

    const normalizedDomain = normalizeExtractedText(extractedJob.domain);
    if (normalizedDomain) applyIfChanged('domain', normalizedDomain);

    const normalizedPackageAmount = normalizePositiveNumber(extractedJob.package_amount);
    if (normalizedPackageAmount !== null) {
      applyIfChanged('package_amount', normalizedPackageAmount);
    }

    const normalizedPackageType = normalizeExtractedPackageType(extractedJob.package_type);
    if (normalizedPackageType) applyIfChanged('package_type', normalizedPackageType);

    const normalizedCity = normalizeExtractedText(extractedJob.city);
    const normalizedLocationType = normalizeExtractedText(extractedJob.location_type);
    if (normalizedLocationType || normalizedCity) {
      applyIfChanged(
        'location_type',
        normalizeExtractedLocationType(extractedJob.location_type, extractedJob.city)
      );
    }

    if (normalizedCity) {
      applyIfChanged('location_city', normalizedCity);
    }

    const normalizedExperience = normalizeExtractedText(extractedJob.experience_required);
    if (normalizedExperience) applyIfChanged('experience_required', normalizedExperience);

    const normalizedQualification = normalizeExtractedText(extractedJob.qualification);
    if (normalizedQualification) applyIfChanged('qualification', normalizedQualification);

    const normalizedEligibleYears = normalizeExtractedText(extractedJob.eligible_graduation_years);
    if (normalizedEligibleYears) {
      applyIfChanged('eligible_years', normalizedEligibleYears);
    }

    const normalizedSkills = normalizeExtractedSkills(extractedJob.required_skills);
    if (normalizedSkills) {
      applyIfChanged('skills', normalizedSkills);
    }

    const normalizedShortDescription = buildExtractedShortDescription(extractedJob);
    if (normalizedShortDescription) {
      applyIfChanged('short_description', normalizedShortDescription);
    }

    const normalizedFullDescription = buildExtractedFullDescription(extractedJob);
    if (normalizedFullDescription) {
      applyIfChanged('full_description', normalizedFullDescription);
    }

    const normalizedApplicationLink =
      normalizeExtractedText(extractedJob.application_link) ||
      normalizeExtractedText(extractedJob.source_url) ||
      fallbackUrl;
    if (normalizedApplicationLink) {
      applyIfChanged('application_link', normalizedApplicationLink);
    }

    const normalizedSourcePlatform = normalizeExtractedText(extractedJob.source_platform) || null;
    setExtractedSourcePlatform(normalizedSourcePlatform);

    return {
      updatedCount,
      nextValues,
      normalizedSourcePlatform,
      platformLabel: normalizedSourcePlatform || 'job page',
      logoReusedFromDatabase: !!extractedJob.logo_reused_from_database,
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

  const handleJobUrlPaste = async (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (isEditMode || isUrlImportBusy) return;

    const pastedUrl = event.clipboardData.getData('text').trim();
    if (!/^https?:\/\//i.test(pastedUrl)) return;

    event.preventDefault();
    setJobUrlInput(pastedUrl);
    await handleExtractFromJobUrl({ jobUrl: pastedUrl, autoCreate: true });
  };

  const handleAiCheckAndFill = async () => {
    const trimmedInput = aiKeyValueInput.trim();
    if (!trimmedInput) {
      setAiCheckError('Add key:value details first, then run AI check.');
      setAiCheckSuccess(null);
      return;
    }

    setIsAiChecking(true);
    setAiCheckError(null);
    setAiCheckSuccess(null);

    try {
      const currentFormValues = getValues();
      const systemPrompt = [
        'You are an assistant that converts admin notes into job form values.',
        'Return only a valid JSON object with keys from the allowed list.',
        `Allowed keys: ${AI_ALLOWED_JOB_FIELDS.join(', ')}.`,
        'Do not return markdown, explanation, or extra keys.',
        'Use location_type exactly as Remote, Onsite, or Hybrid.',
        'Use package_type exactly as CTC, stipend, or hourly.',
        'Use boolean values for checkbox fields.',
        'If a value is unknown, omit that key.',
      ].join(' ');

      const userPrompt = [
        'Admin key:value input:',
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

      const applyStringField = (field: keyof JobFormData, rawValue: unknown) => {
        if (typeof rawValue !== 'string') return;
        const normalized = rawValue.trim();
        const isOptional = OPTIONAL_STRING_FIELDS.has(field);
        if (!normalized && !isOptional) return;
        if (applyFieldUpdate(field, normalized as JobFormData[typeof field])) {
          updatedCount += 1;
        }
      };

      const applyNumberField = (
        field: 'package_amount' | 'referral_bonus_amount' | 'test_duration_minutes',
        rawValue: unknown
      ) => {
        if (rawValue === null || rawValue === '') return;
        const normalized = normalizePositiveNumber(rawValue);
        if (normalized === null) return;
        if (applyFieldUpdate(field, normalized as JobFormData[typeof field])) {
          updatedCount += 1;
        }
      };

      const applyBooleanField = (
        field: 'is_active' | 'has_coding_test' | 'has_aptitude_test' | 'has_technical_interview' | 'has_hr_interview',
        rawValue: unknown
      ) => {
        const normalized = normalizeBoolean(rawValue);
        if (normalized === null) return;
        if (applyFieldUpdate(field, normalized as JobFormData[typeof field])) {
          updatedCount += 1;
        }
      };

      applyStringField('company_name', parsed.company_name);
      applyStringField('company_logo_url', parsed.company_logo_url);
      applyStringField('role_title', parsed.role_title);
      applyStringField('domain', parsed.domain);
      applyStringField('location_city', parsed.location_city);
      applyStringField('experience_required', parsed.experience_required);
      applyStringField('qualification', parsed.qualification);
      applyStringField('eligible_years', parsed.eligible_years);
      if (typeof parsed.skills === 'string' || Array.isArray(parsed.skills)) {
        const normalizedSkills = parseSkillsInput(parsed.skills as string | string[]);
        if (applyFieldUpdate('skills', normalizedSkills.join(', '))) {
          updatedCount += 1;
        }
      }
      applyStringField('short_description', parsed.short_description);
      applyStringField('full_description', parsed.full_description);
      applyStringField('application_link', parsed.application_link);
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
        if (packageType === 'ctc' && applyFieldUpdate('package_type', 'CTC')) updatedCount += 1;
        if (packageType === 'stipend' && applyFieldUpdate('package_type', 'stipend')) updatedCount += 1;
        if (packageType === 'hourly' && applyFieldUpdate('package_type', 'hourly')) updatedCount += 1;
      }

      if (typeof parsed.location_type === 'string') {
        const locationType = parsed.location_type.trim().toLowerCase();
        if (locationType === 'remote' && applyFieldUpdate('location_type', 'Remote')) updatedCount += 1;
        if (locationType === 'onsite' && applyFieldUpdate('location_type', 'Onsite')) updatedCount += 1;
        if (locationType === 'hybrid' && applyFieldUpdate('location_type', 'Hybrid')) updatedCount += 1;
      }

      applyBooleanField('is_active', parsed.is_active);
      applyBooleanField('has_coding_test', parsed.has_coding_test);
      applyBooleanField('has_aptitude_test', parsed.has_aptitude_test);
      applyBooleanField('has_technical_interview', parsed.has_technical_interview);
      applyBooleanField('has_hr_interview', parsed.has_hr_interview);

      if (updatedCount === 0) {
        setAiCheckError('AI returned no usable updates. Try clearer key:value input.');
        return;
      }

      setAiCheckSuccess(
        `AI updated ${updatedCount} field${updatedCount > 1 ? 's' : ''}. Review and ${isEditMode ? 'update' : 'create'} the job.`
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
      await persistJobListing(data);
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

              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-dark-200 dark:to-dark-300 p-6 rounded-xl border border-cyan-100 dark:border-dark-400">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                  <LinkIcon className="w-5 h-5 mr-2 text-cyan-600 dark:text-neon-cyan-400" />
                  Extract From Job URL
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Paste a Workday, Superset, or Greenhouse job link to auto-create the job instantly. Use the button only when you want to extract into the form without creating yet.
                </p>
                <div className="flex flex-col lg:flex-row gap-3">
                  <input
                    ref={jobUrlInputRef}
                    type="url"
                    value={jobUrlInput}
                    onChange={(event) => setJobUrlInput(event.target.value)}
                    onPaste={handleJobUrlPaste}
                    disabled={isUrlImportBusy}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:disabled:bg-dark-300"
                    placeholder="https://company.myworkdayjobs.com/... or https://boards.greenhouse.io/..."
                  />
                  <button
                    type="button"
                    onClick={() => handleExtractFromJobUrl()}
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
                        <span>Extract Only</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Paste a valid URL to auto-create and stay on this page for the next link. Manual extract still fills the current form only.
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
                  Paste raw key:value job details. AI will suggest values and auto-fill this form. Review manually before {isEditMode ? 'updating' : 'creating'} the job.
                </p>
                <textarea
                  value={aiKeyValueInput}
                  onChange={(event) => setAiKeyValueInput(event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-y dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder={`company_name: Acme Labs\nrole_title: Backend Engineer\ndomain: SDE\nlocation_type: Hybrid\nlocation_city: Bengaluru\nexperience_required: 2-4 years\nqualification: B.Tech CSE\nshort_description: ...\nfull_description: ...\napplication_link: https://company.com/jobs/123`}
                />
                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tip: include salary, description, tests, and referral keys too.
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
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>AI Check & Fill Fields</span>
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
                    placeholder="e.g., 1200000"
                    min="0"
                  />
                  {errors.package_amount && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.package_amount.message}</p>
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

              {/* Application Link */}
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
                  disabled={isSubmitting || !isDirty}
                  className={`font-semibold py-3 px-8 rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                    isSubmitting || !isDirty
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
