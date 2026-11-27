import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSupabaseEdgeFunctionUrl } from '../../config/env';

// Landing page for the "Unsubscribe" link in the daily job email.
export const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const q = new URLSearchParams({ u: params.get('u') ?? '', t: params.get('t') ?? '' });
    fetch(getSupabaseEdgeFunctionUrl('marketing-unsubscribe', q))
      .then((r) => r.json())
      .then((d) => {
        setState(d.success ? 'done' : 'error');
        setMessage(d.error ?? '');
      })
      .catch(() => {
        setState('error');
        setMessage('Could not reach the server. Please try again.');
      });
  }, [params]);

  return (
    <main className="grid min-h-[70vh] place-items-center bg-surface-deepest px-4 text-slate-100">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <h1 className="text-2xl font-semibold text-white">
          {state === 'working' ? 'Unsubscribing…' : state === 'done' ? "You're unsubscribed" : 'Something went wrong'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {state === 'done'
            ? "You won't get the daily job emails any more. Your account and Auto Apply keep working as before."
            : state === 'error'
              ? message
              : 'One moment.'}
        </p>
        <Link to="/jobs" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-400 px-5 text-sm font-bold text-slate-950">
          Browse jobs
        </Link>
      </div>
    </main>
  );
};
