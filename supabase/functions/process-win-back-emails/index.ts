import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { denyUnlessServiceOrAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Tuning: give a scorer a few days before nudging (they may still be mid-search
// on their own), don't re-nudge the same person more than once every 14 days,
// and cap total win-back emails per user so this never turns into indefinite spam.
const MIN_DAYS_SINCE_SCORE = 3;
const RESEND_COOLDOWN_DAYS = 14;
const MAX_WIN_BACK_EMAILS_PER_USER = 3;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const deny = await denyUnlessServiceOrAdmin(req, corsHeaders);
  if (deny) return deny;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting win-back email processor...');

    const cutoff = new Date(Date.now() - MIN_DAYS_SINCE_SCORE * 24 * 60 * 60 * 1000).toISOString();

    // 1. Everyone who has ever run a free score check, with their most recent score.
    const { data: scoreRows, error: scoreError } = await supabase
      .from('premium_score_history')
      .select('user_id, overall_score, job_title, created_at')
      .lte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (scoreError) throw new Error(`Failed to fetch score history: ${scoreError.message}`);
    if (!scoreRows || scoreRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No score history to process', processedUsers: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const latestScoreByUser = new Map<string, { overall_score: number; job_title: string | null }>();
    for (const row of scoreRows) {
      if (!latestScoreByUser.has(row.user_id)) {
        latestScoreByUser.set(row.user_id, { overall_score: row.overall_score, job_title: row.job_title });
      }
    }

    // 2. Exclude anyone who has ever completed a successful payment.
    const { data: paidRows, error: paidError } = await supabase
      .from('payment_transactions')
      .select('user_id')
      .eq('status', 'success');

    if (paidError) throw new Error(`Failed to fetch payment transactions: ${paidError.message}`);
    const paidUserIds = new Set((paidRows || []).map((r) => r.user_id));

    // 3. Exclude anyone emailed within the cooldown window, and count total sends per user.
    // email_type is 'notification' (the DB CHECK constraint doesn't allow a 'win_back'
    // value directly), so the win_back rows are identified via metadata.category and
    // filtered here in JS rather than in the query.
    const cooldownCutoff = new Date(Date.now() - RESEND_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: notificationLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('user_id, created_at, metadata')
      .eq('email_type', 'notification')
      .eq('status', 'sent');

    if (logsError) throw new Error(`Failed to fetch email logs: ${logsError.message}`);

    const winBackLogs = (notificationLogs || []).filter((log) => log.metadata?.category === 'win_back');

    const sendCountByUser = new Map<string, number>();
    const recentlyEmailedUserIds = new Set<string>();
    for (const log of winBackLogs) {
      sendCountByUser.set(log.user_id, (sendCountByUser.get(log.user_id) || 0) + 1);
      if (log.created_at >= cooldownCutoff) {
        recentlyEmailedUserIds.add(log.user_id);
      }
    }

    const eligibleUserIds = [...latestScoreByUser.keys()].filter(
      (userId) =>
        !paidUserIds.has(userId) &&
        !recentlyEmailedUserIds.has(userId) &&
        (sendCountByUser.get(userId) || 0) < MAX_WIN_BACK_EMAILS_PER_USER
    );

    console.log(`Eligible users for win-back email: ${eligibleUserIds.length}`);

    let emailsSent = 0;
    const errors: string[] = [];

    for (const userId of eligibleUserIds) {
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (userError || !userData?.user?.email) {
          errors.push(`User ${userId}: failed to fetch email`);
          continue;
        }

        const userEmail = userData.user.email;
        const userName = userData.user.user_metadata?.full_name || userEmail.split('@')[0];
        const score = latestScoreByUser.get(userId)!;

        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-win-back-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            userId,
            recipientEmail: userEmail,
            recipientName: userName,
            overallScore: score.overall_score,
            jobTitle: score.job_title || undefined,
          }),
        });

        if (!emailResponse.ok) {
          errors.push(`User ${userId}: send failed (${emailResponse.status})`);
          continue;
        }

        emailsSent++;
      } catch (err) {
        errors.push(`User ${userId}: ${err.message}`);
      }
    }

    console.log(`Win-back processing complete: ${emailsSent} sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: { eligible: eligibleUserIds.length, emailsSent, errors: errors.length },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in win-back processor:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to process win-back emails' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
