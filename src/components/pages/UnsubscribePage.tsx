import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSupabaseEdgeFunctionUrl } from '../../config/env';

// Landing page for the "Unsubscribe" link in the daily job email. It only
// unsubscribes on a click: mail scanners open links, and must not unsubscribe
// people by doing so. (Mail apps' one-click unsubscribe POSTs straight to the
// function instead.)
export const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const u = params.get('u') ?? '';
  const t = params.get('t') ?? '';
  const linkOk = Boolean(u && t);
  const [state, setState] = useState<'ask' | 'working' | 'done' | 'error'>(linkOk ? 'ask' : 'error');
  const [message, setMessage] = useState(linkOk ? '' : 'This unsubscribe link is incomplete. Please use the link from the email.');

  useEffect(() => {
    document.title = 'Unsubscribe | PrimoBoost AI';
  }, []);

  const unsubscribe = () => {
    setState('working');
    fetch(getSupabaseEdgeFunctionUrl('marketing-unsubscribe', new URLSearchParams({ u, t })))
      .then((r) => r.json())
      .then((d) => {
        setState(d.success ? 'done' : 'error');
        setMessage(d.error ?? '');
      })
      .catch(() => {
        setState('error');
        setMessage('Could not reach the server. Please try again.');
      });
  };

  const heading = {
    ask: 'Stop the daily job emails?',
    working: 'Unsubscribing…',
    done: "You're unsubscribed",
    error: "We couldn't unsubscribe you",
  }[state];

  return (
    <main className="grid min-h-[70vh] place-items-center bg-surface-deepest px-4 text-slate-100">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <h1 className="text-2xl font-semibold text-white">{heading}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {state === 'ask' && "You'll stop getting new-job emails from PrimoBoost AI. Your account and Auto Apply keep working."}
          {state === 'working' && 'One moment.'}
          {state === 'done' && "You won't get the daily job emails any more. Your account and Auto Apply keep working as before."}
          {state === 'error' && message}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {state === 'ask' && (
            <button
              type="button"
              onClick={unsubscribe}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-white"
            >
              Unsubscribe
            </button>
          )}
          <Link to="/jobs" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-400 px-5 text-sm font-bold text-slate-950">
            {state === 'ask' ? 'Keep emails, browse jobs' : 'Browse jobs'}
          </Link>
        </div>
      </div>
    </main>
  );
};
