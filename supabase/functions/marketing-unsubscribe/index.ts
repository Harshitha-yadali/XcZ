// Unsubscribes a user from the daily job marketing email. No login: the link
// carries the user id and an HMAC token (see _shared/marketingEmail.ts).
// Called by the /unsubscribe page (GET) and by mail apps' one-click
// List-Unsubscribe (POST). Deployed with --no-verify-jwt.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { unsubscribeToken } from '../_shared/marketingEmail.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const u = url.searchParams.get('u') ?? '';
  const t = url.searchParams.get('t') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!/^[0-9a-f-]{36}$/i.test(u) || t !== (await unsubscribeToken(u, serviceKey))) {
    return json({ success: false, error: 'This unsubscribe link is not valid.' }, 400);
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const { error } = await supabase.from('marketing_emails')
    .upsert({ user_id: u, unsubscribed_at: new Date().toISOString() });
  if (error) return json({ success: false, error: 'Could not unsubscribe. Please try again.' }, 500);
  return json({ success: true });
});
