import { fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../config/env';
import { supabase } from '../lib/supabaseClient';

export interface ExtractedJobFromUrl {
  company_name: string;
  company_logo_url?: string;
  role_title: string;
  domain: string;
  package_amount?: string | number;
  package_type?: string;
  location_type?: string;
  city?: string;
  experience_required?: string;
  qualification?: string;
  eligible_graduation_years?: string;
  required_skills?: string[] | string;
  short_description?: string;
  full_job_description?: string;
  application_link?: string;
  posted_date?: string;
  source_url: string;
  source_platform: string;
  logo_reused_from_database?: boolean;
}

interface ExtractJobFromUrlResponse {
  success: boolean;
  job?: ExtractedJobFromUrl;
  error?: string;
}

const parseExtractionResponse = async (response: Response): Promise<ExtractJobFromUrlResponse> => {
  const rawText = await response.text();
  if (!rawText) {
    return { success: false, error: 'Empty response from extract-job-from-url.' };
  }

  try {
    return JSON.parse(rawText) as ExtractJobFromUrlResponse;
  } catch {
    return {
      success: false,
      error: response.status === 404
        ? 'extract-job-from-url is not deployed in Supabase yet.'
        : 'extract-job-from-url returned an invalid response.',
    };
  }
};

const isExtractorReachabilityError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('networkerror') ||
    message.includes('fetch')
  );
};

class JobExtractionService {
  async extractJobFromUrl(jobUrl: string): Promise<ExtractedJobFromUrl> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error('Failed to verify your session. Please log in again.');
    }

    if (!session) {
      throw new Error('Authentication required. Please log in again.');
    }

    try {
      const response = await fetchWithSupabaseFallback(
        getSupabaseEdgeFunctionUrl('extract-job-from-url'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ jobUrl }),
        }
      );

      const data = await parseExtractionResponse(response);

      if (!response.ok || !data.success || !data.job) {
        if (response.status === 404) {
          throw new Error('extract-job-from-url is not deployed in Supabase yet. Deploy the edge function and try again.');
        }

        throw new Error(data.error || 'Failed to extract job details from the URL.');
      }

      return data.job;
    } catch (error) {
      if (isExtractorReachabilityError(error)) {
        throw new Error('Could not reach extract-job-from-url in Supabase. Deploy the edge function and check the function URL/CORS, then try again.');
      }

      throw error;
    }
  }
}

export const jobExtractionService = new JobExtractionService();
