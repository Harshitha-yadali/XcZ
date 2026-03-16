import { EmailService, logEmailSend } from './emailService.ts';

interface GenericPlanConfig {
  id: string;
  name: string;
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number;
  guidedBuilds: number;
}

interface AddOnMeta {
  name: string;
  ctaPath: string;
  ctaLabel: string;
  suggestionMessage: string;
}

interface PurchasedAddOn {
  name: string;
  typeKey: string;
  quantity: number;
}

interface TransactionRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  purchase_type: string | null;
  amount: number | null;
  final_amount: number | null;
  discount_amount: number | null;
  wallet_deduction_amount: number | null;
  coupon_code: string | null;
  created_at: string;
}

export interface PurchaseNotificationResult {
  emailSent: boolean;
  skipped: boolean;
  suggestionMessage?: string;
  error?: string;
}

const genericPlans: GenericPlanConfig[] = [
  { id: 'career_boost', name: 'Career Boost Plan', optimizations: 50, scoreChecks: 25, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'career_pro', name: 'Career Pro Plan', optimizations: 100, scoreChecks: 50, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'jd_starter', name: 'JD Starter', optimizations: 5, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'jd_basic', name: 'JD Basic', optimizations: 10, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'jd_advanced', name: 'JD Advanced', optimizations: 50, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'jd_pro', name: 'JD Pro', optimizations: 100, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'score_starter', name: 'Score Starter', optimizations: 0, scoreChecks: 5, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'score_basic', name: 'Score Basic', optimizations: 0, scoreChecks: 10, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'score_advanced', name: 'Score Advanced', optimizations: 0, scoreChecks: 50, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'combo_starter', name: 'Combo Starter', optimizations: 50, scoreChecks: 50, linkedinMessages: 0, guidedBuilds: 0 },
  { id: 'combo_pro', name: 'Combo Pro', optimizations: 100, scoreChecks: 100, linkedinMessages: 0, guidedBuilds: 0 },
];

const addOnMetaByType: Record<string, AddOnMeta> = {
  optimization: {
    name: 'JD-Based Optimization Credit',
    ctaPath: '/optimizer',
    ctaLabel: 'Open Resume Optimizer',
    suggestionMessage: 'Suggested next step: open Resume Optimizer and run your first JD-based optimization.',
  },
  score_check: {
    name: 'Resume Score Check Credit',
    ctaPath: '/score-checker',
    ctaLabel: 'Open Score Checker',
    suggestionMessage: 'Suggested next step: open Score Checker and run your first resume analysis.',
  },
  guided_build: {
    name: 'Guided Resume Build Credit',
    ctaPath: '/guided-builder',
    ctaLabel: 'Open Guided Builder',
    suggestionMessage: 'Suggested next step: open Guided Builder and start your guided resume build.',
  },
  linkedin_messages: {
    name: 'LinkedIn Message Credit',
    ctaPath: '/linkedin-generator',
    ctaLabel: 'Open LinkedIn Generator',
    suggestionMessage: 'Suggested next step: open LinkedIn Generator and create your first outreach message.',
  },
};

function getPlanById(planId: string | null): GenericPlanConfig | undefined {
  return genericPlans.find((plan) => plan.id === planId);
}

function formatCurrency(paise: number | null | undefined): string {
  const amount = Number(paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCapabilities(plan: GenericPlanConfig | undefined, addOns: PurchasedAddOn[]): Set<string> {
  const capabilities = new Set<string>();

  if (plan?.optimizations) capabilities.add('optimization');
  if (plan?.scoreChecks) capabilities.add('score_check');
  if (plan?.guidedBuilds) capabilities.add('guided_build');
  if (plan?.linkedinMessages) capabilities.add('linkedin_messages');

  for (const addOn of addOns) {
    if (addOn.typeKey) capabilities.add(addOn.typeKey);
  }

  return capabilities;
}

function resolveSuggestion(plan: GenericPlanConfig | undefined, addOns: PurchasedAddOn[]) {
  const capabilities = buildCapabilities(plan, addOns);

  if (capabilities.has('optimization') && capabilities.has('score_check')) {
    return {
      ctaLabel: 'Start Optimization',
      ctaPath: '/optimizer',
      suggestionMessage:
        'Suggested next step: open Resume Optimizer, tailor your resume to a target JD, then validate the updated version in Score Checker.',
    };
  }

  if (plan?.optimizations || capabilities.has('optimization')) {
    return addOnMetaByType.optimization;
  }

  if (plan?.scoreChecks || capabilities.has('score_check')) {
    return addOnMetaByType.score_check;
  }

  if (plan?.guidedBuilds || capabilities.has('guided_build')) {
    return addOnMetaByType.guided_build;
  }

  if (plan?.linkedinMessages || capabilities.has('linkedin_messages')) {
    return addOnMetaByType.linkedin_messages;
  }

  return {
    ctaLabel: 'Open Dashboard',
    ctaPath: '/',
    suggestionMessage: 'Suggested next step: open your dashboard and start using your new access right away.',
  };
}

function buildPurchasedItems(plan: GenericPlanConfig | undefined, addOns: PurchasedAddOn[]): string[] {
  const items: string[] = [];

  if (plan) {
    items.push(plan.name);
  }

  for (const addOn of addOns) {
    items.push(`${addOn.quantity} x ${addOn.name}`);
  }

  return items;
}

function buildEntitlements(plan: GenericPlanConfig | undefined, addOns: PurchasedAddOn[]): string[] {
  const entitlements: string[] = [];

  if (plan?.optimizations) {
    entitlements.push(`${plan.optimizations} JD-Based Resume Optimizations`);
  }
  if (plan?.scoreChecks) {
    entitlements.push(`${plan.scoreChecks} Resume Score Checks`);
  }
  if (plan?.guidedBuilds) {
    entitlements.push(`${plan.guidedBuilds} Guided Resume Builds`);
  }
  if (plan?.linkedinMessages) {
    entitlements.push(`${plan.linkedinMessages} LinkedIn Message Credits`);
  }

  for (const addOn of addOns) {
    entitlements.push(`${addOn.quantity} ${addOn.name}${addOn.quantity > 1 ? 's' : ''}`);
  }

  return entitlements;
}

async function loadPurchasedAddOns(supabase: any, transactionId: string): Promise<PurchasedAddOn[]> {
  const { data: creditRows, error: creditError } = await supabase
    .from('user_addon_credits')
    .select('addon_type_id, quantity_purchased')
    .eq('payment_transaction_id', transactionId);

  if (creditError || !creditRows?.length) {
    return [];
  }

  const addonTypeIds = [...new Set(creditRows.map((row: any) => row.addon_type_id).filter(Boolean))];
  if (!addonTypeIds.length) {
    return [];
  }

  const { data: addonTypes, error: typeError } = await supabase
    .from('addon_types')
    .select('id, name, type_key')
    .in('id', addonTypeIds);

  if (typeError || !addonTypes?.length) {
    return [];
  }

  const addonTypeMap = new Map<string, { name: string; type_key: string }>();
  for (const addonType of addonTypes) {
    addonTypeMap.set(addonType.id, addonType);
  }

  const grouped = new Map<string, PurchasedAddOn>();
  for (const row of creditRows) {
    const addonType = addonTypeMap.get(row.addon_type_id);
    if (!addonType) continue;

    const key = addonType.type_key;
    const current = grouped.get(key);
    const quantity = Number(row.quantity_purchased || 0);
    const displayName = addonType.name || addOnMetaByType[key]?.name || 'Add-on Credit';

    if (current) {
      current.quantity += quantity;
      continue;
    }

    grouped.set(key, {
      name: displayName,
      typeKey: key,
      quantity,
    });
  }

  return Array.from(grouped.values());
}

async function resolveRecipientDetails(
  supabase: any,
  userId: string,
  providedEmail?: string,
  providedName?: string,
): Promise<{ email: string | null; name: string }> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, email_address')
    .eq('id', userId)
    .maybeSingle();

  let authUser: any = null;
  if (!providedEmail || !providedName) {
    const authResult = await supabase.auth.admin.getUserById(userId);
    authUser = authResult.data?.user || null;
  }

  const email =
    providedEmail ||
    profile?.email_address ||
    authUser?.email ||
    null;

  const name =
    providedName ||
    profile?.full_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    authUser?.user_metadata?.display_name ||
    'User';

  return { email, name };
}

function buildEmailHtml(params: {
  recipientName: string;
  purchasedItems: string[];
  entitlements: string[];
  suggestionMessage: string;
  ctaLabel: string;
  ctaUrl: string;
  transaction: TransactionRow;
}) {
  const purchasedItemsHtml = params.purchasedItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  const entitlementsHtml = params.entitlements
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  const couponHtml = params.transaction.coupon_code
    ? `<p><strong>Coupon:</strong> ${escapeHtml(params.transaction.coupon_code)}</p>`
    : '';

  const walletHtml = Number(params.transaction.wallet_deduction_amount || 0) > 0
    ? `<p><strong>Wallet used:</strong> ${formatCurrency(params.transaction.wallet_deduction_amount)}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Confirmation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc; }
    .card { background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
    .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 12px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px 0; font-size: 28px; color: #0f172a; }
    .summary { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .summary p { margin: 6px 0; }
    .box { background: #f8fafc; border-left: 4px solid #10b981; border-radius: 10px; padding: 18px 20px; margin: 22px 0; }
    .box h2 { margin: 0 0 8px 0; font-size: 18px; color: #0f172a; }
    ul { margin: 12px 0 0 0; padding-left: 20px; }
    li { margin: 8px 0; }
    .cta { display: inline-block; margin-top: 18px; background: #0f766e; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-weight: 700; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Payment Successful</div>
    <h1>Purchase confirmed</h1>
    <p>Hi ${escapeHtml(params.recipientName)}, your purchase has been completed successfully.</p>

    <div class="summary">
      <p><strong>Amount paid:</strong> ${formatCurrency(params.transaction.final_amount)}</p>
      <p><strong>Transaction ID:</strong> ${escapeHtml(params.transaction.id)}</p>
      <p><strong>Date:</strong> ${escapeHtml(new Date(params.transaction.created_at).toLocaleString('en-IN'))}</p>
      ${couponHtml}
      ${walletHtml}
    </div>

    <div class="box">
      <h2>Purchased</h2>
      <ul>${purchasedItemsHtml}</ul>
    </div>

    <div class="box">
      <h2>Now available in your account</h2>
      <ul>${entitlementsHtml}</ul>
    </div>

    <div class="box">
      <h2>Suggested next step</h2>
      <p>${escapeHtml(params.suggestionMessage)}</p>
      <a href="${params.ctaUrl}" class="cta">${escapeHtml(params.ctaLabel)}</a>
    </div>

    <div class="footer">
      <p>If anything looks wrong, reply to this email or contact PrimoBoost AI support.</p>
      <p>PrimoBoost AI Team</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendPurchaseConfirmationEmail(params: {
  supabase: any;
  userId: string;
  transactionId: string;
  userEmail?: string;
  userName?: string;
}): Promise<PurchaseNotificationResult> {
  const { supabase, userId, transactionId, userEmail, userName } = params;

  const { data: transaction, error: transactionError } = await supabase
    .from('payment_transactions')
    .select('id, user_id, plan_id, purchase_type, amount, final_amount, discount_amount, wallet_deduction_amount, coupon_code, created_at')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .single();

  if (transactionError || !transaction) {
    return {
      emailSent: false,
      skipped: true,
      error: 'Transaction not found for purchase notification.',
    };
  }

  if (transaction.purchase_type === 'webinar' || transaction.purchase_type === 'session_booking') {
    return {
      emailSent: false,
      skipped: true,
      error: 'Purchase handled by a dedicated confirmation flow.',
    };
  }

  const [recipient, purchasedAddOns] = await Promise.all([
    resolveRecipientDetails(supabase, userId, userEmail, userName),
    loadPurchasedAddOns(supabase, transactionId),
  ]);

  if (!recipient.email) {
    return {
      emailSent: false,
      skipped: true,
      error: 'Recipient email not available.',
    };
  }

  const plan = getPlanById(transaction.plan_id);
  const purchasedItems = buildPurchasedItems(plan, purchasedAddOns);
  const entitlements = buildEntitlements(plan, purchasedAddOns);
  const suggestion = resolveSuggestion(plan, purchasedAddOns);
  const siteUrl = Deno.env.get('SITE_URL') || 'https://primoboost.ai';
  const ctaUrl = `${siteUrl}${suggestion.ctaPath}`;
  const headline = purchasedItems[0] || 'Your PrimoBoost purchase';
  const subject = `Purchase confirmed: ${headline}`;
  const emailHtml = buildEmailHtml({
    recipientName: recipient.name,
    purchasedItems,
    entitlements: entitlements.length ? entitlements : ['Access has been updated in your account.'],
    suggestionMessage: suggestion.suggestionMessage,
    ctaLabel: suggestion.ctaLabel,
    ctaUrl,
    transaction,
  });

  const emailService = new EmailService();
  const result = await emailService.sendEmail({
    to: recipient.email,
    subject,
    html: emailHtml,
  });

  await logEmailSend(
    supabase,
    userId,
    'purchase_confirmation',
    recipient.email,
    subject,
    result.success ? 'sent' : 'failed',
    result.error,
  );

  return {
    emailSent: result.success,
    skipped: false,
    suggestionMessage: suggestion.suggestionMessage,
    error: result.error,
  };
}
