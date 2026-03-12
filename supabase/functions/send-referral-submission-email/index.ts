import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService, logEmailSend } from '../_shared/emailService.ts';
import { REFERRAL_RESUME_BUCKET_ID } from '../_shared/referralResumeStorage.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendReferralSubmissionEmailRequest {
  submissionId: string;
}

function getReferralAdminEmails(): string[] {
  const configuredList = (Deno.env.get('REFERRAL_ADMIN_EMAILS') || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const fallbackPrimary = (
    Deno.env.get('REFERRAL_ADMIN_EMAIL') || 'karthikivrat524@gmail.com'
  ).trim().toLowerCase();

  return Array.from(
    new Set([
      ...configuredList,
      fallbackPrimary,
      'karthikvirat524@gmail.com',
    ].filter(Boolean)),
  );
}

function formatAmount(amountPaise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format((amountPaise || 0) / 100);
}

function buildAdminHtml(params: {
  applicantName: string;
  contactEmail: string;
  companyName: string;
  roleTitle: string;
  amountPaid: number;
  createdAt: string;
  resumeUrl: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Referral Submission</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 28px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
    .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    .details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-top: 20px; }
    .details p { margin: 8px 0; }
    .cta { display: inline-block; margin-top: 22px; padding: 12px 18px; border-radius: 10px; background: #0f766e; color: #ffffff !important; text-decoration: none; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">New Referral Submission</div>
    <h1 style="margin:0 0 12px 0;">A client submitted a paid referral request</h1>
    <p style="margin:0;">Review the candidate details below and use the resume link to access the uploaded PDF.</p>

    <div class="details">
      <p><strong>Candidate:</strong> ${params.applicantName || 'Not provided'}</p>
      <p><strong>Contact Email:</strong> ${params.contactEmail}</p>
      <p><strong>Company:</strong> ${params.companyName}</p>
      <p><strong>Role:</strong> ${params.roleTitle}</p>
      <p><strong>Amount Paid:</strong> ${formatAmount(params.amountPaid)}</p>
      <p><strong>Submitted At:</strong> ${new Date(params.createdAt).toLocaleString('en-IN')}</p>
    </div>

    <a class="cta" href="${params.resumeUrl}" target="_blank" rel="noreferrer">Open Resume PDF</a>
  </div>
</body>
</html>`;
}

function buildClientHtml(params: {
  applicantName: string;
  companyName: string;
  roleTitle: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Referral Request Received</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 28px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
    .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    .tip { background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 10px; padding: 16px 18px; margin-top: 22px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Referral Request Received</div>
    <h1 style="margin:0 0 12px 0;">Your referral request is now in review</h1>
    <p style="margin:0;">Hi ${params.applicantName || 'there'}, we received your payment, email, and resume for <strong>${params.companyName}</strong> - ${params.roleTitle}.</p>
    <div class="tip">
      <p style="margin:0;"><strong>Next step:</strong> Check your email for updates. If you do not receive a referral update within 24 hours, we will notify you as soon as it is processed.</p>
    </div>
  </div>
</body>
</html>`;
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

    const body: SendReferralSubmissionEmailRequest = await req.json();
    if (!body.submissionId) {
      throw new Error('submissionId is required.');
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

    const adminEmails = getReferralAdminEmails();
    const adminRecipientList = adminEmails.join(', ');
    const normalizedUserEmail = (user.email || '').trim().toLowerCase();
    const isAdmin = user.app_metadata?.role === 'admin' || adminEmails.includes(normalizedUserEmail);

    const { data: submission, error: submissionError } = await supabase
      .from('referral_submissions')
      .select(`
        id,
        user_id,
        applicant_name,
        contact_email,
        resume_file_name,
        resume_storage_path,
        amount_paid,
        created_at,
        referral_listings (
          company_name,
          role_title
        )
      `)
      .eq('id', body.submissionId)
      .maybeSingle();

    if (submissionError || !submission) {
      throw new Error('Referral submission not found.');
    }

    if (!isAdmin && submission.user_id !== user.id) {
      throw new Error('You do not have access to this submission.');
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(REFERRAL_RESUME_BUCKET_ID)
      .createSignedUrl(submission.resume_storage_path, 60 * 60 * 24 * 7);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error('Failed to generate resume download link.');
    }

    const companyName = submission.referral_listings?.company_name || 'Referral Listing';
    const roleTitle = submission.referral_listings?.role_title || 'Role';
    const applicantName = submission.applicant_name || user.user_metadata?.name || user.email || 'Candidate';

    const emailService = new EmailService();

    const adminSubject = `New referral submission: ${companyName} - ${roleTitle}`;
    const adminResult = await emailService.sendEmail({
      to: adminRecipientList,
      subject: adminSubject,
      html: buildAdminHtml({
        applicantName,
        contactEmail: submission.contact_email,
        companyName,
        roleTitle,
        amountPaid: Number(submission.amount_paid || 0),
        createdAt: submission.created_at,
        resumeUrl: signedUrlData.signedUrl,
      }),
    });

    await logEmailSend(
      supabase,
      submission.user_id,
      'referral_submission_admin_notification',
      adminRecipientList,
      adminSubject,
      adminResult.success ? 'sent' : 'failed',
      adminResult.error,
    );

    let clientResult = { success: false, error: 'Client email skipped' };
    if (submission.contact_email) {
      const clientSubject = `Referral request received: ${companyName} - ${roleTitle}`;
      clientResult = await emailService.sendEmail({
        to: submission.contact_email,
        subject: clientSubject,
        html: buildClientHtml({
          applicantName,
          companyName,
          roleTitle,
        }),
      });

      await logEmailSend(
        supabase,
        submission.user_id,
        'referral_submission_client_confirmation',
        submission.contact_email,
        clientSubject,
        clientResult.success ? 'sent' : 'failed',
        clientResult.error,
      );
    }

    if (adminResult.success) {
      await supabase
        .from('referral_submissions')
        .update({
          admin_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id);
    }

    return new Response(
      JSON.stringify({
        success: adminResult.success,
        adminEmailSent: adminResult.success,
        clientEmailSent: clientResult.success,
        error: adminResult.error,
      }),
      {
        status: adminResult.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send referral submission emails.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
