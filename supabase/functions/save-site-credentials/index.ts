import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { denied, getCaller } from "../_shared/auth.ts";
import { encryptSecret, siteOf } from "../_shared/vault.ts";

// Stores the login a user gives us for one job site, so auto-apply can sign
// in there for them. The password is encrypted before it is written and is
// never sent back to the browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { user } = await getCaller(req);
    if (!user) return denied("Sign in required.", 401, corsHeaders);

    const secret = Deno.env.get('CREDENTIALS_KEY');
    if (!secret) return json({ success: false, error: 'Saving site logins is not set up yet.' }, 503);

    const { jobUrl, username, password } = await req.json();
    const site = siteOf(String(jobUrl || ''));
    if (!site) return json({ success: false, error: 'That job link is not valid.' }, 400);
    if (typeof username !== 'string' || !username.trim() || username.length > 320) {
      return json({ success: false, error: 'Enter the email or username you use on that site.' }, 400);
    }
    if (typeof password !== 'string' || !password || password.length > 1024) {
      return json({ success: false, error: 'Enter the password you use on that site.' }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await supabase.from('user_credentials_vault').upsert(
      {
        user_id: user.id,
        platform: site,
        username: username.trim(),
        password_encrypted: await encryptSecret(password, secret),
        is_verified: false,
      },
      { onConflict: 'user_id,platform' },
    );
    if (error) throw error;

    return json({ success: true, site });
  } catch (error: any) {
    console.error('Error saving site login:', error);
    return json({ success: false, error: 'The login could not be saved. Please try again.' }, 500);
  }
});
