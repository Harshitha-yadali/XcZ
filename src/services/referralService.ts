import { supabase } from '../lib/supabaseClient';
import { fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../config/env';
import type {
  ReferralListing,
  ReferralPricing,
  ReferralSubmission,
} from '../types/referral';

class ReferralService {
  private async postToEdgeFunction<T>(
    functionName: string,
    body: Record<string, unknown>
  ): Promise<{ data?: T; error?: string }> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      return { error: 'Session expired. Please sign in again.' };
    }

    try {
      const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl(functionName), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      let parsedData: T | { error?: string } | null = null;

      if (responseText) {
        try {
          parsedData = JSON.parse(responseText) as T | { error?: string };
        } catch {
          parsedData = null;
        }
      }

      if (!response.ok) {
        const parsedError =
          parsedData &&
          typeof parsedData === 'object' &&
          'error' in parsedData &&
          typeof parsedData.error === 'string'
            ? parsedData.error
            : `Request failed with status ${response.status}.`;

        return { error: parsedError };
      }

      return { data: (parsedData as T) || undefined };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to connect to the referral service.',
      };
    }
  }

  getResolvedReferralPrice(listing: ReferralListing, pricing?: ReferralPricing | null): number {
    return Number(
      listing.profile_price ??
      listing.query_price ??
      listing.slot_price ??
      pricing?.profile_price ??
      pricing?.query_price ??
      pricing?.slot_price ??
      0
    );
  }

  async getActiveListings(): Promise<ReferralListing[]> {
    const { data, error } = await supabase
      .from('referral_listings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching listings:', error.message);
      return [];
    }
    return (data || []) as ReferralListing[];
  }

  async getAllListings(): Promise<ReferralListing[]> {
    const { data, error } = await supabase
      .from('referral_listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching all listings:', error.message);
      return [];
    }
    return (data || []) as ReferralListing[];
  }

  async getListingById(id: string): Promise<ReferralListing | null> {
    const { data, error } = await supabase
      .from('referral_listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('ReferralService: Error fetching listing:', error.message);
      return null;
    }
    return data as ReferralListing | null;
  }

  async createListing(listing: Omit<ReferralListing, 'id' | 'created_at' | 'updated_at'>): Promise<ReferralListing | null> {
    const { data, error } = await supabase
      .from('referral_listings')
      .insert(listing)
      .select()
      .single();

    if (error) {
      console.error('ReferralService: Error creating listing:', error.message);
      return null;
    }
    return data as ReferralListing;
  }

  async updateListing(id: string, updates: Partial<ReferralListing>): Promise<boolean> {
    const { error } = await supabase
      .from('referral_listings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('ReferralService: Error updating listing:', error.message);
      return false;
    }
    return true;
  }

  async deleteListing(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('referral_listings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('ReferralService: Error deleting listing:', error.message);
      return false;
    }
    return true;
  }

  async getPricing(): Promise<ReferralPricing | null> {
    const { data, error } = await supabase
      .from('referral_pricing')
      .select('*')
      .eq('id', '1')
      .maybeSingle();

    if (error) {
      console.error('ReferralService: Error fetching pricing:', error.message);
      return null;
    }
    return data as ReferralPricing | null;
  }

  async updatePricing(updates: Partial<ReferralPricing>): Promise<boolean> {
    const { error } = await supabase
      .from('referral_pricing')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', '1');

    if (error) {
      console.error('ReferralService: Error updating pricing:', error.message);
      return false;
    }
    return true;
  }

  async getLatestUserSubmission(userId: string, listingId: string): Promise<ReferralSubmission | null> {
    const { data, error } = await supabase
      .from('referral_submissions')
      .select('*, referral_listings(*)')
      .eq('user_id', userId)
      .eq('referral_listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('ReferralService: Error fetching latest submission:', error.message);
      return null;
    }

    return data as ReferralSubmission | null;
  }

  async getAllSubmissions(): Promise<ReferralSubmission[]> {
    const { data, error } = await supabase
      .from('referral_submissions')
      .select('*, referral_listings(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ReferralService: Error fetching submissions:', error.message);
      return [];
    }

    return (data || []) as ReferralSubmission[];
  }

  async createSubmission(
    submission: Omit<
      ReferralSubmission,
      'id' | 'admin_notified_at' | 'status' | 'created_at' | 'updated_at' | 'referral_listings' | 'amount_paid'
    >
  ): Promise<{ submission?: ReferralSubmission; error?: string; alreadyExists?: boolean }> {
    const { data, error } = await this.postToEdgeFunction<{
      success?: boolean;
      submission?: ReferralSubmission;
      alreadyExists?: boolean;
      error?: string;
    }>('create-referral-submission', {
      listingId: submission.referral_listing_id,
      paymentTransactionId: submission.payment_transaction_id,
      applicantName: submission.applicant_name,
      contactEmail: submission.contact_email,
      resumeFileName: submission.resume_file_name,
      resumeStoragePath: submission.resume_storage_path,
    });

    if (error || !data?.success || !data.submission) {
      console.error(
        'ReferralService: Error creating submission:',
        error || data?.error || 'Unknown error',
      );
      return {
        error: data?.error || error || 'Failed to save referral request.',
      };
    }

    return {
      submission: data.submission,
      alreadyExists: data.alreadyExists,
    };
  }

  async updateSubmissionStatus(
    submissionId: string,
    status: ReferralSubmission['status']
  ): Promise<boolean> {
    const { error } = await supabase
      .from('referral_submissions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) {
      console.error('ReferralService: Error updating submission status:', error.message);
      return false;
    }

    return true;
  }

  async uploadSubmissionResume(
    listingId: string,
    paymentTransactionId: string,
    file: File
  ): Promise<{ success: boolean; fileName?: string; storagePath?: string; error?: string }> {
    const { data, error } = await this.postToEdgeFunction<{
      success?: boolean;
      bucketId?: string;
      storagePath?: string;
      token?: string;
      fileName?: string;
      error?: string;
    }>('create-referral-resume-upload', {
      listingId,
      paymentTransactionId,
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      fileSize: file.size,
    });

    if (error || !data?.success || !data.storagePath || !data.token || !data.bucketId) {
      console.error(
        'ReferralService: Error preparing referral resume upload:',
        error || data?.error || 'Unknown error',
      );
      return {
        success: false,
        error: data?.error || error || 'Failed to prepare PDF upload. Please try again.',
      };
    }

    const uploadResult = await supabase.storage
      .from(data.bucketId)
      .uploadToSignedUrl(data.storagePath, data.token, file, {
        upsert: true,
        contentType: file.type || 'application/pdf',
        cacheControl: '86400',
      });

    if (uploadResult.error) {
      console.error('ReferralService: Error uploading referral PDF:', uploadResult.error.message);
      return { success: false, error: 'Failed to upload PDF. Please try again.' };
    }

    return {
      success: true,
      fileName: data.fileName || file.name,
      storagePath: data.storagePath,
    };
  }

  async sendSubmissionEmail(
    submissionId: string
  ): Promise<{ success: boolean; adminEmailSent?: boolean; clientEmailSent?: boolean; error?: string }> {
    const { data, error } = await this.postToEdgeFunction<{
      success?: boolean;
      adminEmailSent?: boolean;
      clientEmailSent?: boolean;
      error?: string;
    }>('send-referral-submission-email', {
      submissionId,
    });

    if (error || !data) {
      console.error(
        'ReferralService: Error sending referral submission email:',
        error || 'Unknown error',
      );
      return {
        success: false,
        error: error || 'Failed to notify the admin by email.',
      };
    }

    return {
      success: Boolean(data.success),
      adminEmailSent: data.adminEmailSent,
      clientEmailSent: data.clientEmailSent,
      error: data.error,
    };
  }
}

export const referralService = new ReferralService();
