// First-party funnel tracking. Fire-and-forget: never throws, never blocks UI.
// meta must never hold personal data (no emails, names, resume text) — only
// scores, tiers, outcomes. Read via the admin-only funnel_report RPC.
import { supabase } from '../lib/supabaseClient';

export type FunnelEvent =
  | 'home_view'
  | 'signup'
  | 'score_check_view'
  | 'score_check_start'
  | 'score_check_done'
  | 'fix_resume_click'
  | 'optimizer_view'
  | 'tier_picked'
  | 'boost_done'
  | 'boost_skipped'
  | 'payment_start'
  | 'payment_success'
  | 'payment_failed'
  | 'optimize_done'
  | 'jobs_view'
  | 'auto_apply_click'
  | 'linkedin_view'
  | 'linkedin_score_done'
  | 'linkedin_rewrite_done';

export type FunnelMeta = Record<string, string | number | boolean>;

const ANON_KEY = 'pb_anon_id';
const SESSION_KEY = 'pb_session_id';
const ONCE_KEY = 'pb_funnel_once';

const memory: Record<string, string> = {};

const newId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
};

function persistentId(storage: () => Storage, key: string): string {
  try {
    const s = storage();
    const existing = s.getItem(key);
    if (existing) return existing;
    const id = newId();
    s.setItem(key, id);
    return id;
  } catch {
    return (memory[key] ||= newId());
  }
}

export function track(event: FunnelEvent, meta?: FunnelMeta): void {
  try {
    const anon_id = persistentId(() => window.localStorage, ANON_KEY);
    const session_id = persistentId(() => window.sessionStorage, SESSION_KEY);
    const path = (typeof location !== 'undefined' ? location.pathname : '').slice(0, 256);
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        await supabase.from('funnel_events').insert({
          event,
          anon_id,
          session_id,
          user_id: data?.session?.user?.id ?? null,
          path,
          meta: meta ?? {},
        });
      } catch {
        /* tracking must never break a page */
      }
    })();
  } catch {
    /* tracking must never break a page */
  }
}

const onceMemory = new Set<string>();

/** Like track, but fires at most once per browser session for this event. */
export function trackOnce(event: FunnelEvent, meta?: FunnelMeta): void {
  try {
    let seen: string[] = [];
    try {
      seen = JSON.parse(window.sessionStorage.getItem(ONCE_KEY) || '[]');
    } catch {
      seen = [...onceMemory];
    }
    if (seen.includes(event) || onceMemory.has(event)) return;
    onceMemory.add(event);
    try {
      window.sessionStorage.setItem(ONCE_KEY, JSON.stringify([...seen, event]));
    } catch {
      /* in-memory set still dedupes */
    }
    track(event, meta);
  } catch {
    /* never throw */
  }
}
