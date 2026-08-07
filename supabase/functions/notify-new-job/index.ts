import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService } from '../_shared/emailService.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotifyNewJobRequest {
  jobId: string;
}

function formatSalaryToLPA(amount?: number | null): string {
  if (!amount) return '';
  const lpa = amount / 100000;
  return lpa >= 10 ? `₹${Math.round(lpa)} LPA` : `₹${lpa.toFixed(1)} LPA`;
}

function getFirstName(fullName: string): string {
  return (fullName || '').split(' ')[0] || 'there';
}

/**
 * Fires immediately when an admin manually posts a single job (see
 * persistJobListing in JobUploadForm.tsx) — NOT for bulk imports or the Apify
 * sync, which could insert many jobs at once and would spam this per-job.
 * Targets every job_notification_subscriptions row with is_subscribed = true
 * and a matching domain, regardless of notification_frequency — by explicit
 * choice, daily/weekly subscribers get this instant email in addition to
 * their regular batched digest for the same job (double notification for
 * that group is a known, accepted tradeoff here, not a bug).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { jobId }: NotifyNewJobRequest = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ success: false, error: 'jobId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://primoboost.ai';

    const { data: job, error: jobError } = await supabase
      .from('job_listings')
      .select('id, company_name, company_logo_url, role_title, domain, application_link, location_type, package_amount, is_active')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) throw new Error(`Failed to fetch job: ${jobError.message}`);
    if (!job || !job.is_active) {
      return new Response(JSON.stringify({ success: true, message: 'Job not found or inactive, nothing to notify' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Matches the same domain rule as get_jobs_for_daily_digest (domain = ANY(preferred_domains)),
    // but intentionally covers every subscribed frequency, not just 'immediate'.
    const { data: subs, error: subsError } = await supabase
      .from('job_notification_subscriptions')
      .select('user_id')
      .eq('is_subscribed', true)
      .contains('preferred_domains', [job.domain]);

    if (subsError) throw new Error(`Failed to fetch subscriptions: ${subsError.message}`);
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No subscribers for this domain', notified: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const logoHtml = job.company_logo_url
      ? `<img src="${job.company_logo_url}" alt="${job.company_name}" width="48" height="48" style="border-radius:8px;display:block;border:1px solid #E5E7EB;" />`
      : `<div style="width:48px;height:48px;border-radius:8px;background:#EFF6FF;color:#2563EB;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:18px;border:1px solid #E5E7EB;">${(job.company_name || '?').charAt(0).toUpperCase()}</div>`;
    const salaryText = formatSalaryToLPA(job.package_amount);
    const metaLine = [job.domain, job.location_type].filter(Boolean).join(' &bull; ');
    const emailSubject = `New: ${job.role_title} at ${job.company_name}`;

    let notified = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      try {
        // Skip if this exact job was already logged for this user (e.g. a retry).
        const { data: existingLog } = await supabase
          .from('job_notification_logs')
          .select('id')
          .eq('user_id', sub.user_id)
          .eq('job_id', job.id)
          .maybeSingle();
        if (existingLog) continue;

        const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
        if (!userData?.user?.email) {
          errors.push(`User ${sub.user_id}: no email`);
          continue;
        }
        const recipientEmail = userData.user.email;
        const firstName = getFirstName(userData.user.user_metadata?.full_name || recipientEmail);

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>New job posted</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC;">
    <tr><td style="padding:20px 10px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;background:#FFFFFF;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
        <tr><td style="padding:24px;background:#FFFFFF;">
          <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0F172A;">Hi ${firstName}, a new ${job.domain} job just went live:</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;">
            <tr><td style="padding:16px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="width:48px;padding-right:12px;vertical-align:top;">${logoHtml}</td>
                  <td style="vertical-align:top;">
                    <div style="font-size:16px;font-weight:600;color:#0F172A;margin:0 0 4px 0;">${job.role_title}</div>
                    <div style="font-size:14px;color:#475569;margin:0 0 8px 0;">${job.company_name}</div>
                    <div style="font-size:13px;color:#64748B;margin:0 0 12px 0;">${metaLine}${salaryText ? ` &bull; <span style="color:#166534;font-weight:600;">${salaryText}</span>` : ''}</div>
                    <a href="${job.application_link}" target="_blank" style="display:inline-block;padding:10px 16px;background:#2563EB;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin-right:8px;">Apply</a>
                    <a href="${siteUrl}/jobs/${job.id}" target="_blank" style="display:inline-block;padding:10px 16px;background:#FFFFFF;color:#2563EB;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #2563EB;">View Details</a>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 24px;background:#F1F5F9;border-top:1px solid #E5E7EB;text-align:center;border-radius:0 0 12px 12px;">
          <p style="margin:0;font-size:12px;color:#64748B;">You're receiving this because you subscribed to ${job.domain} job alerts on PrimoBoost AI. <a href="${siteUrl}/profile" style="color:#2563EB;">Manage preferences</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

        const plainText = `New ${job.domain} job: ${job.role_title} at ${job.company_name}\n${metaLine}${salaryText ? ' | ' + salaryText : ''}\nApply: ${job.application_link}\nDetails: ${siteUrl}/jobs/${job.id}`;

        const emailService = new EmailService();
        const result = await emailService.sendEmail({ to: recipientEmail, subject: emailSubject, html: emailHtml, text: plainText });

        await supabase.from('email_logs').insert({
          user_id: sub.user_id,
          recipient_email: recipientEmail,
          email_type: 'notification',
          subject: emailSubject,
          status: result.success ? 'sent' : 'failed',
          metadata: { category: 'new_job_immediate', job_id: job.id },
          error_message: result.error || null,
          sent_at: result.success ? new Date().toISOString() : null,
        });

        await supabase.rpc('log_notification_send', {
          p_user_id: sub.user_id,
          p_job_id: job.id,
          p_email_status: result.success ? 'sent' : 'failed',
          p_notification_type: 'immediate',
        });

        if (result.success) notified++;
      } catch (err) {
        errors.push(`User ${sub.user_id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified, eligible: subs.length, errors: errors.length ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-new-job:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to notify' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
