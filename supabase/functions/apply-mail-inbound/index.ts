import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import PostalMime from 'npm:postal-mime@2.4.4';
import { applicationFor, mailKind } from '../_shared/applyMail.ts';
import { EmailService } from '../_shared/emailService.ts';

// Takes in one message for an applicant's job address, keeps it for them, and
// sends it on to their own address. Mail for *@primoboostjobs.in arrives from
// cloudflare/apply-mail.js (Cloudflare Email Routing catch-all); the SendGrid
// Inbound Parse format is also accepted.
// Deploy without JWT checking: the caller is known by secret.

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sameSecret = async (given: string, expected: string) => {
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  return a.reduce((difference, byte, index) => difference | (byte ^ b[index]), 0) === 0;
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * SendGrid posts a form and cannot add a header, so its secret rides in the URL
 * (?key=). With "POST the raw, full MIME message" ticked, the `email` field is
 * the message itself and `envelope` names every address it was delivered to.
 */
async function fromSendGrid(req: Request): Promise<{ to: string[]; raw: ArrayBuffer }> {
  const form = await req.formData();
  const email = form.get('email');
  const raw = typeof email === 'string'
    ? new TextEncoder().encode(email).buffer
    : await (email as File | null)?.arrayBuffer();
  let to: string[] = [];
  try {
    to = (JSON.parse(String(form.get('envelope') || '{}')).to || []).map((address: string) => String(address).trim().toLowerCase());
  } catch { /* no envelope: nothing to deliver to */ }
  return { to, raw: raw || new ArrayBuffer(0) };
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('APPLY_MAIL_SECRET') || '';
  const viaSendGrid = (req.headers.get('content-type') || '').startsWith('multipart/form-data');
  const given = viaSendGrid ? new URL(req.url).searchParams.get('key') || '' : req.headers.get('x-apply-mail-secret') || '';
  if (secret.length < 32 || !(await sameSecret(given, secret))) return reply(401, { error: 'unauthorized' });

  try {
    const { to, raw } = viaSendGrid
      ? await fromSendGrid(req)
      : { to: [(req.headers.get('x-mail-to') || '').trim().toLowerCase()], raw: await req.arrayBuffer() };
    if (!to.some(Boolean) || raw.byteLength === 0 || raw.byteLength > 30_000_000) return reply(400, { error: 'bad message' });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const message = await PostalMime.parse(raw);
    let keptAny = false;
    for (const address of new Set(to.filter(Boolean))) {
      if (await keep(supabase, address, message)) keptAny = true;
    }
    // SendGrid retries anything but a 2xx for days, so mail for an unknown
    // address is answered 200 and dropped there. The Cloudflare worker turns
    // a 404 into a bounce.
    if (!keptAny && !viaSendGrid) return reply(404, { error: 'no such address' });
    return reply(200, { kept: keptAny });
  } catch (error) {
    console.error('Job mail could not be kept:', error);
    // Not kept, so the sender (or SendGrid) tries again later.
    return reply(500, { error: 'not kept' });
  }
});

/** Keeps one message for the applicant at one address. False when no applicant has that address. */
async function keep(supabase: any, to: string, message: any): Promise<boolean> {
  const { data: agent, error: agentError } = await supabase.from('apply_agents').select('user_id').eq('address', to).maybeSingle();
  if (agentError) throw agentError;
  if (!agent) return false;

  const html = message.html || '';
  const body = (message.text || html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '))
    .replace(/[ \t]+/g, ' ').trim().slice(0, 20_000);
  const mail = {
    from_address: (message.from?.address || 'unknown').slice(0, 300),
    subject: (message.subject || '').slice(0, 500),
    body,
  };
  const kind = mailKind(mail.subject, mail.body);

  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data: rows } = await supabase
    .from('auto_apply_applications')
    .select('id, status, job_listings(company_name)')
    .eq('user_id', agent.user_id).gte('created_at', since).limit(500);
  const application = applicationFor(mail, (rows || []).map((row: any) => ({ id: row.id, status: row.status, company: row.job_listings?.company_name || '' })));

  // The same message delivered twice is kept, and sent on, once.
  const { data: kept, error } = await supabase.from('apply_mail').upsert({
    user_id: agent.user_id,
    application_id: application?.id ?? null,
    message_id: (message.messageId || `${mail.from_address}|${mail.subject}|${message.date || ''}`).slice(0, 500),
    ...mail,
    kind,
  }, { onConflict: 'user_id,message_id', ignoreDuplicates: true }).select('id').maybeSingle();
  if (error) throw error;
  if (!kept) return true;

  // ponytail: a spoofed confirmation could mark an unconfirmed application as
  // sent; it was already never resent, so nothing is lost by believing it.
  if (kind === 'confirmed' && application?.status === 'submission_uncertain') {
    await supabase.from('auto_apply_applications')
      .update({ status: 'submitted', submission_time: new Date().toISOString(), error_message: null })
      .eq('id', application.id).eq('status', 'submission_uncertain');
  }

  const { data: profile } = await supabase.from('user_profiles').select('email_address, job_mail_to').eq('id', agent.user_id).maybeSingle();
  const forwardTo = profile?.job_mail_to || profile?.email_address;
  if (forwardTo) {
    const files = (message.attachments || []).length;
    const note = `From ${mail.from_address}, sent to your PrimoBoost job address. Reply to this email to answer them.${files ? ` It came with ${files} attachment(s), which are not included here.` : ''}`;
    const sent = await new EmailService().sendEmail({
      to: forwardTo,
      subject: mail.subject || 'A message about your application',
      text: `${note}\n\n${mail.body}`,
      html: `<p style="color:#555">${escapeHtml(note)}</p><div style="white-space:pre-wrap">${escapeHtml(mail.body)}</div>`,
      replyTo: mail.from_address,
    });
    if (sent.success) await supabase.from('apply_mail').update({ forwarded: true }).eq('id', kept.id);
  }
  return true;
}
