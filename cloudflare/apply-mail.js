// Cloudflare Email Worker for *@primoboostjobs.in. It hands each message to
// the apply-mail-inbound function and keeps nothing itself.
//
// Settings on the worker:
//   INBOUND_URL        https://<project>.supabase.co/functions/v1/apply-mail-inbound
//   APPLY_MAIL_SECRET  the same secret the function has (32 characters or more)
export default {
  async email(message, env) {
    if (message.rawSize > 10_000_000) return message.setReject('Message too large');
    const response = await fetch(env.INBOUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'message/rfc822', 'x-apply-mail-secret': env.APPLY_MAIL_SECRET, 'x-mail-to': message.to },
      body: await new Response(message.raw).arrayBuffer(),
    });
    if (response.status === 404) return message.setReject('No such address');
    // Thrown, not rejected: the sender's server keeps the message and tries again.
    if (!response.ok) throw new Error(`inbound answered ${response.status}`);
  },
};
