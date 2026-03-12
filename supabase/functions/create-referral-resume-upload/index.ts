import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  REFERRAL_RESUME_BUCKET_ID,
  REFERRAL_RESUME_MAX_BYTES,
  buildReferralResumeStoragePath,
  ensureReferralResumeBucket,
  sanitizeReferralResumeFileName,
} from '../_shared/referralResumeStorage.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateReferralResumeUploadRequest {
  listingId: string;
  paymentTransactionId: string;
  fileName: string;
  contentType?: string;
  fileSize?: number;
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

    const body: CreateReferralResumeUploadRequest = await req.json();

    if (!body.listingId) {
      throw new Error('listingId is required.');
    }

    if (!body.paymentTransactionId) {
      throw new Error('paymentTransactionId is required.');
    }

    if (body.contentType && body.contentType !== 'application/pdf') {
      throw new Error('Only PDF files are allowed.');
    }

    if (Number(body.fileSize || 0) > REFERRAL_RESUME_MAX_BYTES) {
      throw new Error('Resume PDF must be 5 MB or smaller.');
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
      .select('id, user_id, status, purchase_type, metadata')
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

    const { data: existingSubmission } = await supabase
      .from('referral_submissions')
      .select('id')
      .eq('payment_transaction_id', body.paymentTransactionId)
      .maybeSingle();

    if (existingSubmission) {
      throw new Error('This referral request has already been submitted.');
    }

    await ensureReferralResumeBucket(supabase);

    const storagePath = buildReferralResumeStoragePath(
      user.id,
      body.listingId,
      body.paymentTransactionId,
    );
    const displayFileName = sanitizeReferralResumeFileName(body.fileName);

    const { data: signedUpload, error: signedUploadError } = await supabase.storage
      .from(REFERRAL_RESUME_BUCKET_ID)
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (signedUploadError || !signedUpload?.token) {
      throw new Error(signedUploadError?.message || 'Failed to prepare referral PDF upload.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        bucketId: REFERRAL_RESUME_BUCKET_ID,
        storagePath,
        token: signedUpload.token,
        fileName: displayFileName,
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
        error: error.message || 'Failed to prepare referral PDF upload.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
