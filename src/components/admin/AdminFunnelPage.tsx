import React, { useEffect, useState } from 'react';
import { Loader2, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Row { step_order: number; event: string; people: number; events: number }

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '—');

export const AdminFunnelPage: React.FC = () => {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    supabase.rpc('funnel_report', { p_days: days }).then(({ data, error: rpcError }) => {
      if (!alive) return;
      if (rpcError) setError(rpcError.message);
      else setRows(((data as Row[]) || []).map((r) => ({ ...r, people: Number(r.people), events: Number(r.events) })));
      setLoading(false);
    }, (e: unknown) => {
      if (!alive) return;
      setError(e instanceof Error ? e.message : 'Could not load the funnel.');
      setLoading(false);
    });
    return () => { alive = false; };
  }, [days]);

  const steps = rows.filter((r) => r.step_order < 100);
  const extras = rows.filter((r) => r.step_order >= 100);
  const first = steps[0]?.people ?? 0;
  // Biggest drop = most people lost between two consecutive steps.
  let worst = -1;
  let worstLoss = 0;
  steps.forEach((r, i) => {
    const loss = i > 0 ? steps[i - 1].people - r.people : 0;
    if (loss > worstLoss) { worstLoss = loss; worst = i; }
  });

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Funnel</h1>
          <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1" role="group" aria-label="Date range">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`min-h-[40px] rounded-md px-4 text-sm font-medium ${days === d ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400">People = distinct signed-in users or anonymous browsers who hit each step in the last {days} days.</p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>
        ) : error ? (
          <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Step</th>
                    <th className="px-3 py-3 text-right">People</th>
                    <th className="px-3 py-3 text-right">% of prev</th>
                    <th className="px-3 py-3 text-right">% of first</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((r, i) => (
                    <tr key={r.event} className={`border-t border-slate-800 ${i === worst ? 'bg-red-500/10' : ''}`}>
                      <td className="px-3 py-3 font-mono">
                        <span className="text-slate-500">{r.step_order}.</span> {r.event}
                        {i === worst && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 font-sans text-xs text-red-300">
                            <TrendingDown className="h-3 w-3" aria-hidden="true" /> biggest drop
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.people.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-300">{i === 0 ? '—' : pct(r.people, steps[i - 1].people)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-300">{pct(r.people, first)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-8 text-lg font-semibold">Other events</h2>
            {extras.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">None in this range.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[360px] text-sm">
                  <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-3">Event</th>
                      <th className="px-3 py-3 text-right">People</th>
                      <th className="px-3 py-3 text-right">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extras.map((r) => (
                      <tr key={r.event} className="border-t border-slate-800">
                        <td className="px-3 py-3 font-mono">{r.event}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.people.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-300">{r.events.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
