import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService } from '../_shared/emailService.ts';
import { denyUnlessServiceOrAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WinBackRequest {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  overallScore: number;
  jobTitle?: string;
}

function getFirstName(fullName: string): string {
  return (fullName || '').split(' ')[0] || 'there';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const deny = await denyUnlessServiceOrAdmin(req, corsHeaders);
  if (deny) return deny;

  try {
    const emailData: WinBackRequest = await req.json();
    const siteUrl = Deno.env.get('SITE_URL') || 'https://primoboost.ai';
    const logoUrl = 'https://res.cloudinary.com/dlkovvlud/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg';
    const firstName = getFirstName(emailData.recipientName);
    const score = emailData.overallScore;
    const roleLine = emailData.jobTitle ? ` for ${emailData.jobTitle}` : '';

    const emailSubject = `Your resume scored ${score}/100 — here's what's fixable`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your resume score</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC;">
    <tr>
      <td style="padding:20px 10px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;background:#FFFFFF;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding:24px 24px 16px;background:#FFFFFF;border-bottom:1px solid #E5E7EB;text-align:center;">
              <img src="${logoUrl}" alt="PrimoBoost AI" width="140" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px;background:#FFFFFF;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#0F172A;">Hi ${firstName},</p>
              <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
                A little while back you checked your resume${roleLine} and scored <strong style="color:#0F172A;">${score}/100</strong>.
                That score is still the version recruiters and ATS software see today — nothing has changed on its own.
              </p>
              <div style="background:#EFF6FF;border-left:4px solid #2563EB;padding:16px;border-radius:8px;margin-bottom:20px;">
                <div style="font-size:13px;font-weight:600;color:#2563EB;margin:0 0 4px;">What the AI Optimizer fixes</div>
                <div style="font-size:13px;color:#475569;line-height:1.6;">
                  Missing keywords, weak bullet phrasing, and formatting issues — rewritten against the job description in minutes, not hours.
                </div>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <a href="${siteUrl}/optimizer" target="_blank" style="display:inline-block;padding:14px 28px;background:#2563EB;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Fix My Resume Now</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;text-align:center;">
                <a href="${siteUrl}/pricing" style="color:#2563EB;text-decoration:none;">See plans</a> — Career Boost and Career Pro include unlimited resource for an active job search, not just one fix.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;background:#F1F5F9;border-top:1px solid #E5E7EB;text-align:center;border-radius:0 0 12px 12px;">
              <p style="margin:0;font-size:12px;color:#64748B;">You're receiving this because you checked a resume score on PrimoBoost AI.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const plainText = `
Hi ${firstName},

A little while back you checked your resume${roleLine} and scored ${score}/100. That score is still the version recruiters and ATS software see today.

The AI Optimizer fixes missing keywords, weak bullet phrasing, and formatting issues — rewritten against the job description in minutes.

Fix your resume now: ${siteUrl}/optimizer
See plans: ${siteUrl}/pricing

---
You're receiving this because you checked a resume score on PrimoBoost AI.
    `.trim();

    const emailService = new EmailService();
    const result = await emailService.sendEmail({
      to: emailData.recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      text: plainText,
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // email_logs.email_type has a DB CHECK constraint allowing only
    // 'welcome' | 'job_digest' | 'notification' | 'other' — 'win_back' is not a
    // valid value, so the sub-type is tracked in metadata.category instead and
    // filtered on in JS by process-win-back-emails (see there for why).
    await supabase.from('email_logs').insert({
      user_id: emailData.userId,
      recipient_email: emailData.recipientEmail,
      email_type: 'notification',
      subject: emailSubject,
      status: result.success ? 'sent' : 'failed',
      metadata: { category: 'win_back', overall_score: score, job_title: emailData.jobTitle || null },
      error_message: result.error || null,
      sent_at: result.success ? new Date().toISOString() : null,
    });

    return new Response(
      JSON.stringify({ success: result.success, messageId: result.messageId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending win-back email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
