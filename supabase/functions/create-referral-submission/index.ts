import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildReferralResumeStoragePath,
  sanitizeReferralResumeFileName,
} from '../_shared/referralResumeStorage.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateReferralSubmissionRequest {
  listingId: string;
  paymentTransactionId: string;
  applicantName?: string;
  contactEmail: string;
  resumeFileName: string;
  resumeStoragePath: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header.');
    }

    const body: CreateReferralSubmissionRequest = await req.json();

    if (!body.listingId) {
      throw new Error('listingId is required.');
    }

    if (!body.paymentTransactionId) {
      throw new Error('paymentTransactionId is required.');
    }

    if (!body.contactEmail?.trim()) {
      throw new Error('contactEmail is required.');
    }

    if (!body.resumeFileName?.trim()) {
      throw new Error('resumeFileName is required.');
    }

    if (!body.resumeStoragePath?.trim()) {
      throw new Error('resumeStoragePath is required.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token.');
    }

    const { data: paymentTransaction, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('id, user_id, status, purchase_type, final_amount, amount, metadata')
      .eq('id', body.paymentTransactionId)
      .eq('user_id', user.id)
      .eq('status', 'success')
      .eq('purchase_type', 'referral_booking')
      .maybeSingle();

    if (paymentError || !paymentTransaction) {
      throw new Error('Verified referral payment not found.');
    }

    const paymentListingId = paymentTransaction.metadata?.listingId;
    if (paymentListingId && paymentListingId !== body.listingId) {
      throw new Error('Payment does not match this referral listing.');
    }

    const expectedStoragePath = buildReferralResumeStoragePath(
      user.id,
      body.listingId,
      body.paymentTransactionId,
    );

    if (body.resumeStoragePath !== expectedStoragePath) {
      throw new Error('Resume upload path is invalid.');
    }

    const { data: existingSubmission, error: existingSubmissionError } = await supabase
      .from('referral_submissions')
      .select('*')
      .eq('payment_transaction_id', body.paymentTransactionId)
      .maybeSingle();

    if (existingSubmissionError) {
      throw new Error(existingSubmissionError.message || 'Failed to verify existing referral request.');
    }

    if (existingSubmission) {
      if (existingSubmission.user_id !== user.id) {
        throw new Error('This payment is already linked to another referral request.');
      }

      return new Response(
        JSON.stringify({
          success: true,
          submission: existingSubmission,
          alreadyExists: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const amountPaid = Number(paymentTransaction.final_amount ?? paymentTransaction.amount ?? 0);
    const applicantName =
      body.applicantName?.trim() ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      '';

    const { data: submission, error: insertError } = await supabase
      .from('referral_submissions')
      .insert({
        user_id: user.id,
        referral_listing_id: body.listingId,
        payment_transaction_id: body.paymentTransactionId,
        applicant_name: applicantName,
        contact_email: body.contactEmail.trim(),
        resume_file_name: sanitizeReferralResumeFileName(body.resumeFileName),
        resume_storage_path: body.resumeStoragePath,
        amount_paid: amountPaid,
      })
      .select('*')
      .single();

    if (insertError || !submission) {
      throw new Error(insertError?.message || 'Failed to save referral request.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        submission,
        alreadyExists: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to save referral request.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
