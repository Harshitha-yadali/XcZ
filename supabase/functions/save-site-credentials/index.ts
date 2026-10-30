import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { denied, getCaller } from "../_shared/auth.ts";
import { encryptSecret } from "../_shared/vault.ts";
import { isProviderLoginHost, providerName } from "../_shared/providerHosts.ts";

// Stores the login a user gives us for one sign-in address (login.ibm.com,
// www.linkedin.com, a company's Workday site), so auto-apply can sign in
// there for them. The password is encrypted before it is written and is never
// sent back to the browser.

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

    // `site` is the address of the sign-in page that asked for the login, as
    // returned by auto-apply-submit. The login is filed under it and is only
    // ever typed on a sign-in page at exactly that address.
    const { site: given, username, password } = await req.json();
    const site = String(given || '').trim().toLowerCase();
    if (!/^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(site)) {
      return json({ success: false, error: 'That sign-in address is not valid.' }, 400);
    }
    // The engine refuses these sites, so a password saved for one could never
    // be used. It would only sit here, and it is the key to the user's mail and
    // everything else they sign into with it.
    if (isProviderLoginHost(site)) {
      return json({ success: false, error: `We never use your ${providerName(site)} account, so that login was not saved.` }, 400);
    }
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
