import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Check, Copy, FileUp, Linkedin, Loader2, RotateCcw, Sparkles, UserRound, Wand2 } from 'lucide-react';
import { Seo } from '../../seo/Seo';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { paymentService } from '../../services/paymentService';
import { Subscription } from '../../types/payment';
import {
  COMPLETENESS_ITEMS,
  Completeness,
  ExperienceLevel,
  LinkedInProfile,
  LinkedInRewrite,
  ScoreSection,
  applyRewrite,
  detectedCompleteness,
  generateFullRewrite,
  generateHeadlineSample,
  parseLinkedInPdfText,
  profileFromExtension,
  profileFromUserProfile,
  scoreLinkedInProfile,
  unsupportedClaims,
} from '../../services/linkedinProfile';

interface LinkedInOptimizerPageProps {
  onNavigateBack: () => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  userSubscription: Subscription | null;
  onShowSubscriptionPlans: (featureId?: string) => void;
  onShowAlert: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', actionText?: string, onAction?: () => void) => void;
  refreshUserSubscription: () => Promise<void>;
}

const cardClass = 'rounded-2xl border border-white/[0.08] bg-white/[0.03]';
const inputClass = 'w-full rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-base text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40';
const primaryButton = 'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:from-emerald-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300';
const secondaryButton = 'flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

const LEVELS: { id: ExperienceLevel; label: string; hint: string }[] = [
  { id: 'student', label: 'Student', hint: 'Still studying' },
  { id: 'fresher', label: 'Fresher', hint: '0-1 years' },
  { id: 'experienced', label: 'Experienced', hint: '1+ years' },
];
const SECTION_LABELS: Record<ScoreSection, string> = {
  headline: 'Headline', about: 'About', experience: 'Experience & projects', skills: 'Skills', completeness: 'Profile completeness',
};

const band = (score: number) =>
  score >= 80
    ? { label: 'Strong profile', text: 'text-emerald-400', stroke: 'stroke-emerald-400', bar: 'bg-emerald-500' }
    : score >= 60
      ? { label: 'Good start', text: 'text-amber-400', stroke: 'stroke-amber-400', bar: 'bg-amber-500' }
      : { label: 'Needs work', text: 'text-red-400', stroke: 'stroke-red-400', bar: 'bg-red-500' };

// The PrimoBoost Chrome extension (extension/site.js) marks the page when it is installed.
const hasExtension = () => typeof document !== 'undefined' && document.documentElement.dataset.primoboostExtension === '1';

/**
 * One ask to the extension through site.js. Resolves with the message of
 * `finalType` that carries our id; rejects if the extension could not start
 * or nothing came back in time.
 */
function askExtension(message: Record<string, unknown>, finalType: string, timeoutMs: number): Promise<any> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const finish = (done: () => void) => { clearTimeout(timer); window.removeEventListener('message', onMessage); done(); };
    const timer = setTimeout(() => finish(() => reject(new Error("LinkedIn didn't answer in time. Try again, or use the PDF upload instead."))), timeoutMs);
    function onMessage(event: MessageEvent) {
      const d = event.data;
      if (event.source !== window || event.origin !== window.location.origin || d?.source !== 'primoboost-extension' || d.id !== id) return;
      if (d.type === 'linkedin-started' && !d.ok) finish(() => reject(new Error(d.error || 'The PrimoBoost extension could not open LinkedIn.')));
      else if (d.type === finalType) finish(() => resolve(d));
    }
    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'primoboost-site', id, ...message }, window.location.origin);
  });
}

const FillOnLinkedIn: React.FC<{ field: 'headline' | 'about'; text: string }> = ({ field, text }) => {
  const [state, setState] = useState<'idle' | 'opening' | 'opened' | 'failed'>('idle');
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={state === 'opening'}
        onClick={async () => {
          setState('opening');
          try { await askExtension({ type: 'linkedin-fill', field, text }, 'linkedin-started', 15000); setState('opened'); } catch { setState('failed'); }
        }}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 text-sm font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {state === 'opening' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Linkedin className="h-4 w-4" aria-hidden="true" />}
        Fill on LinkedIn
      </button>
      <span role="status" className="mt-1 text-xs text-slate-400">
        {state === 'opened' && 'Opened in a new tab. Review it there and click Save.'}
        {state === 'failed' && 'Could not reach the extension. Use Copy instead.'}
      </span>
    </span>
  );
};

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
      }}
      className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  );
};

const ScoreRing: React.FC<{ score: number; size?: 'lg' | 'sm' }> = ({ score, size = 'lg' }) => {
  const reduceMotion = useReducedMotion();
  const b = band(score);
  const box = size === 'lg' ? 'h-40 w-40' : 'h-24 w-24';
  return (
    <div className={`relative ${box}`}>
      <svg className={`${box} -rotate-90`} viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="10" />
        <motion.circle
          cx="60" cy="60" r="50" fill="none" strokeWidth="10" strokeLinecap="round" className={b.stroke}
          initial={reduceMotion ? false : { strokeDasharray: '0 314' }}
          animate={{ strokeDasharray: `${(score / 100) * 314} 314` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${size === 'lg' ? 'text-5xl' : 'text-2xl'} font-bold ${b.text}`}>{score}</span>
        {size === 'lg' && <span className="text-sm text-slate-400">out of 100</span>}
      </div>
    </div>
  );
};

export const LinkedInOptimizerPage: React.FC<LinkedInOptimizerPageProps> = ({
  onNavigateBack, isAuthenticated, onShowAuth, userSubscription, onShowSubscriptionPlans, onShowAlert, refreshUserSubscription,
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [source, setSource] = useState<{ kind: 'pdf' | 'profile' | 'linkedin'; name: string } | null>(null);
  const [extension, setExtension] = useState(hasExtension);
  const [importNote, setImportNote] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [completeness, setCompleteness] = useState<Completeness>({});
  const [skillCount, setSkillCount] = useState('');
  const [sample, setSample] = useState('');
  const [sampleLoading, setSampleLoading] = useState(false);
  const [rewrite, setRewrite] = useState<LinkedInRewrite | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = targetRole.trim();
  const ticks = useMemo(() => (profile ? { ...detectedCompleteness(profile), ...completeness } : completeness), [profile, completeness]);
  const options = { targetRole: role, level: level || 'fresher', completeness: ticks, skillCount: Number(skillCount) || undefined };
  const score = profile && showResult ? scoreLinkedInProfile(profile, options) : null;
  const afterScore = profile && rewrite ? scoreLinkedInProfile(applyRewrite(profile, rewrite), options) : null;
  const unsupported = profile && rewrite ? unsupportedClaims(profile, rewrite, role) : [];
  const quickLeft = userSubscription ? userSubscription.quickOptimizationsTotal - userSubscription.quickOptimizationsUsed : null;

  const missing = [!profile && 'your LinkedIn profile', !role && 'the target role', !level && 'your experience level'].filter(Boolean) as string[];

  const requireLogin = () => {
    if (isAuthenticated && user) return true;
    onShowAuth();
    return false;
  };

  // site.js runs after the page's first paint; look again shortly after.
  useEffect(() => {
    if (extension) return;
    const t = setTimeout(() => setExtension(hasExtension()), 1500);
    return () => clearTimeout(t);
  }, [extension]);

  const loaded = (p: LinkedInProfile, kind: 'pdf' | 'profile' | 'linkedin', name: string) => {
    setProfile(p); setSource({ kind, name }); setShowResult(false); setSample(''); setRewrite(null); setCompleteness({}); setError(null); setImportNote('');
  };

  // The extension opens the user's own LinkedIn profile in a new tab, reads
  // what is on it and sends it back here; then it is scored like a PDF.
  const handleLinkedInImport = async () => {
    if (!requireLogin()) return;
    setLoadingSource(true); setError(null);
    try {
      const reply = await askExtension({ type: 'linkedin-import' }, 'linkedin-profile', 120000);
      if (!reply.ok) throw new Error(reply.error || "Couldn't read your profile. Use the PDF upload instead.");
      const { profile: p, skillsTotal, truncated } = profileFromExtension(reply.profile);
      if (!p.headline && !p.about && !p.experience.length) throw new Error("Couldn't read your profile. Use the PDF upload instead.");
      loaded(p, 'linkedin', 'Your LinkedIn profile');
      if (skillsTotal > p.skills.length) setSkillCount(String(skillsTotal));
      if (truncated.length) setImportNote(`LinkedIn showed only part of: ${truncated.join(', ')}. We scored what was visible.`);
    } catch (e: any) {
      setError(e?.message || "Couldn't read your profile. Use the PDF upload instead.");
    } finally {
      setLoadingSource(false);
    }
  };

  const handlePdf = async (file: File) => {
    setLoadingSource(true); setError(null);
    try {
      const { parseFile } = await import('../../utils/fileParser');
      const { text } = await parseFile(file, { keepLines: true });
      const p = parseLinkedInPdfText(text);
      if (!p.about && !p.experience.length && !p.headline) {
        throw new Error('This does not look like a LinkedIn PDF. On LinkedIn open your profile, tap "More" (or "Resources"), then "Save to PDF", and upload that file.');
      }
      loaded(p, 'pdf', file.name);
    } catch (e: any) {
      setError(e?.message || 'Could not read that PDF. Please try again.');
    } finally {
      setLoadingSource(false);
    }
  };

  const handleUseProfile = async () => {
    if (!requireLogin()) return;
    setLoadingSource(true); setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('user_profiles')
        .select('full_name, current_location, linkedin_profile_url, resume_headline, education_details, experience_details, projects_details, skills_details, certifications_details')
        .eq('id', user!.id)
        .maybeSingle();
      if (dbError) throw dbError;
      const p = profileFromUserProfile(data);
      if (!p.experience.length && !p.skills.length) {
        throw new Error('Your PrimoBoost profile has no experience, projects or skills yet. Fill in your profile, or upload your LinkedIn PDF instead.');
      }
      loaded(p, 'profile', 'Your PrimoBoost profile');
    } catch (e: any) {
      setError(e?.message || 'Could not load your profile.');
    } finally {
      setLoadingSource(false);
    }
  };

  const handleScore = () => {
    if (!requireLogin()) return;
    if (missing.length) { setError(`Please add ${missing.join(', ')}.`); return; }
    setError(null); setShowResult(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSample = async () => {
    if (!requireLogin() || !profile || !level) return;
    setSampleLoading(true); setError(null);
    try {
      setSample(await generateHeadlineSample(profile, role, level));
    } catch (e: any) {
      setError(e?.message || 'The free headline could not be written. Please try again.');
    } finally {
      setSampleLoading(false);
    }
  };

  // Same credit steps as the resume optimizer: reserve 1 Quick credit, finalize
  // after the rewrite, refund if anything fails before that.
  const handleFullRewrite = async () => {
    if (!requireLogin() || !profile || !level) return;
    const requestKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `linkedin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let reservationId: string | null = null;
    let finalized = false;
    setRewriting(true); setError(null);
    try {
      const reservation = await paymentService.reserveOptimization(user!.id, 'quick', requestKey);
      if (!reservation.success || !reservation.reservationId) {
        if (reservation.error?.startsWith('Unable to reserve')) throw new Error(reservation.error);
        onShowAlert(
          'No Quick credits left',
          'The full LinkedIn rewrite uses 1 Quick credit. Get a Quick pack and come back; your score stays on this page.',
          'warning',
          'See plans',
          () => onShowSubscriptionPlans(),
        );
        return;
      }
      reservationId = reservation.reservationId;
      const result = await generateFullRewrite(profile, role, level);
      const done = await paymentService.finalizeCreditReservation(reservationId);
      if (!done.success) throw new Error(done.error || 'Unable to finalize the reserved Quick credit.');
      finalized = true;
      setRewrite(result);
      refreshUserSubscription().catch(() => undefined);
    } catch (e: any) {
      let note = '';
      if (reservationId && !finalized) {
        const refund = await paymentService.refundCreditReservation(reservationId);
        if (refund.success) note = ' Your credit was not used.';
        else console.error('Quick credit could not be given back:', refund.error);
      }
      setError(`${e?.message || 'The rewrite failed.'}${note}`);
    } finally {
      setRewriting(false);
    }
  };

  const startOver = () => {
    setProfile(null); setSource(null); setShowResult(false); setSample(''); setRewrite(null); setCompleteness({}); setSkillCount(''); setError(null); setImportNote('');
  };

  const errorBox = error && (
    <div role="alert" className="flex gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  );

  return (
    <>
      <Seo
        title="LinkedIn Profile Optimizer - Free LinkedIn Score & AI Rewrite"
        description="Upload your LinkedIn PDF and get a free LinkedIn profile score with the top fixes, then rewrite your headline, About, experience and skills for your target role."
        canonicalPath="/linkedin-optimizer"
      />
      <div className="min-h-screen overflow-x-hidden bg-surface-deepest text-slate-100 lg:pl-16">
        <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-surface-deepest/90 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
            <button
              onClick={onNavigateBack}
              aria-label="Back to home"
              className="-ml-2 grid h-11 w-11 place-items-center rounded-xl text-slate-300 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-slate-200">LinkedIn Profile Optimizer</span>
            {isAuthenticated && quickLeft !== null && (
              <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {quickLeft} Quick {quickLeft === 1 ? 'credit' : 'credits'}
              </span>
            )}
          </div>
        </div>

        <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:py-10">
          {!score || !profile ? (
            <>
              <header className="mb-2">
                <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Get more recruiter views on LinkedIn</h1>
                <p className="mt-2 text-slate-400">Free LinkedIn score with the fixes that matter, plus a free headline. Full rewrite for 1 Quick credit.</p>
              </header>

              <section className={`${cardClass} space-y-8 p-4 sm:p-6`}>
                <div>
                  <h2 className="mb-3 flex items-center gap-3 text-base font-semibold sm:text-lg">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-sm text-emerald-300">1</span>
                    Your LinkedIn profile
                  </h2>
                  <label
                    onClick={(e) => { if (!isAuthenticated) { e.preventDefault(); onShowAuth(); } }}
                    className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-4 text-center transition-colors hover:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400 ${loadingSource ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    {loadingSource ? <Loader2 className="h-6 w-6 animate-spin text-emerald-300" aria-hidden="true" /> : <FileUp className="h-6 w-6 text-emerald-300" aria-hidden="true" />}
                    <span className="font-medium text-slate-200">{source?.kind === 'pdf' ? `Loaded: ${source.name}` : 'Upload your LinkedIn PDF'}</span>
                    <span className="text-xs text-slate-400">On LinkedIn: open your profile → More (or Resources) → Save to PDF</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handlePdf(f); }}
                    />
                  </label>
                  <button type="button" onClick={handleUseProfile} disabled={loadingSource} className={`${secondaryButton} mt-3 w-full`}>
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    {source?.kind === 'profile' ? 'Loaded: your PrimoBoost profile' : 'Or use my PrimoBoost profile'}
                  </button>
                  {extension && (
                    <>
                      <button type="button" onClick={handleLinkedInImport} disabled={loadingSource} className={`${secondaryButton} mt-3 w-full`}>
                        <Linkedin className="h-4 w-4" aria-hidden="true" />
                        {source?.kind === 'linkedin' ? 'Loaded: your LinkedIn profile' : 'Import from LinkedIn (extension)'}
                      </button>
                      <p className="mt-1 text-center text-xs text-slate-500">Opens your own LinkedIn profile in a new tab and reads what it shows. Nothing is changed there.</p>
                    </>
                  )}
                  {importNote && <p className="mt-2 text-xs text-amber-300">{importNote}</p>}

                  {profile && (
                    <div className="mt-4 space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-4 text-sm">
                      <p className="text-slate-300">
                        Found {profile.name ? <strong className="text-slate-100">{profile.name}</strong> : 'your profile'}: {profile.experience.length} experience/project {profile.experience.length === 1 ? 'entry' : 'entries'}, {profile.skills.length} skills, About {profile.about.length} characters.
                      </p>
                      <div>
                        <label htmlFor="lio-headline" className="mb-1.5 block font-medium text-slate-300">
                          Your current LinkedIn headline {source?.kind === 'profile' && '(paste it)'}
                        </label>
                        <textarea
                          id="lio-headline"
                          rows={2}
                          maxLength={400}
                          value={profile.headline}
                          onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                          placeholder="e.g. Student at ABC College"
                          className={`${inputClass} resize-y`}
                        />
                        <p className="mt-1 text-xs text-slate-500">Check it: fix it here if we read it wrong.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="mb-3 flex items-center gap-3 text-base font-semibold sm:text-lg">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-sm text-emerald-300">2</span>
                    The job you want
                  </h2>
                  <label htmlFor="lio-role" className="mb-1.5 block text-sm font-medium text-slate-300">Target role</label>
                  <input id="lio-role" type="text" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Data Analyst" className={inputClass} />
                  <fieldset className="mt-4">
                    <legend className="mb-1.5 text-sm font-medium text-slate-300">Your experience level</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {LEVELS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={level === option.id}
                          onClick={() => setLevel(option.id)}
                          className={`min-h-[52px] rounded-xl border px-2 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            level === option.id ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200' : 'border-slate-700/60 bg-slate-900/40 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <span className="block text-sm font-medium">{option.label}</span>
                          <span className="block text-xs text-slate-500">{option.hint}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>

                {errorBox}
                <div>
                  <button type="button" onClick={handleScore} className={primaryButton}>
                    <Linkedin className="h-5 w-5" aria-hidden="true" />
                    {isAuthenticated ? 'Get my free LinkedIn score' : 'Sign in to get your free score'}
                  </button>
                  {missing.length > 0 && <p className="mt-2 text-center text-xs text-slate-500">Still needed: {missing.join(', ')}</p>}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className={`${cardClass} flex flex-col items-center p-6 text-center sm:p-8`}>
                <ScoreRing score={score.total} />
                <h1 className="mt-4 text-2xl font-bold">{band(score.total).label}</h1>
                <p className="mt-1 max-w-full truncate text-sm text-slate-400">LinkedIn score for {role}</p>
                <div className="mt-6 w-full space-y-3 text-left">
                  {(Object.keys(SECTION_LABELS) as ScoreSection[]).map((key) => {
                    const s = score.sections[key];
                    const pct = Math.round((s.points / s.max) * 100);
                    return (
                      <div key={key}>
                        <div className="mb-1 flex justify-between text-sm"><span className="text-slate-300">{SECTION_LABELS[key]}</span><span className="text-slate-400">{s.points}/{s.max}</span></div>
                        <div className="h-2 rounded-full bg-slate-800"><div className={`h-2 rounded-full ${band(pct).bar}`} style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {score.topFixes.length > 0 && (
                <section aria-labelledby="lio-fixes">
                  <h2 id="lio-fixes" className="mb-3 px-1 text-base font-semibold">What to fix first</h2>
                  <ol className="space-y-2">
                    {score.topFixes.map((fix) => (
                      <li key={fix.id} className={`${cardClass} p-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-slate-100">{fix.label}</span>
                          <span className="shrink-0 text-xs text-amber-300">+{fix.max - fix.points} pts</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{fix.fix}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className={`${cardClass} p-4 sm:p-6`} aria-labelledby="lio-checklist">
                <h2 id="lio-checklist" className="text-base font-semibold">Tick what your profile already has</h2>
                <p className="mt-1 text-sm text-slate-400">The PDF does not show these. Your score updates as you tick.</p>
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {COMPLETENESS_ITEMS.map((item) => (
                    <li key={item.id}>
                      <label className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!ticks[item.id]}
                          onChange={(e) => setCompleteness({ ...completeness, [item.id]: e.target.checked })}
                          className="h-5 w-5 shrink-0 accent-emerald-500"
                        />
                        <span className="flex-1 text-sm text-slate-200">{item.label}</span>
                        <span className="text-xs text-slate-500">{item.points} pts</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {source?.kind !== 'profile' && (profile.skills.length <= 3 || !!skillCount) && (
                  <div className="mt-3">
                    <label htmlFor="lio-skill-count" className="mb-1.5 block text-sm font-medium text-slate-300">
                      How many skills are on your LinkedIn? <span className="font-normal text-slate-500">(the PDF and profile page show only a few)</span>
                    </label>
                    <input id="lio-skill-count" type="number" inputMode="numeric" min={0} max={100} value={skillCount} onChange={(e) => setSkillCount(e.target.value)} placeholder="e.g. 12" className={inputClass} />
                  </div>
                )}
              </section>

              <section className={`${cardClass} p-4 sm:p-6`} aria-labelledby="lio-sample">
                <h2 id="lio-sample" className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-emerald-300" aria-hidden="true" />Free headline sample</h2>
                {sample ? (
                  <div className="mt-3 space-y-3">
                    <p className="break-words rounded-xl bg-slate-900/60 p-4 text-slate-100">{sample}</p>
                    <CopyButton text={sample} />
                  </div>
                ) : (
                  <button type="button" onClick={handleSample} disabled={sampleLoading} className={`${secondaryButton} mt-3 w-full`}>
                    {sampleLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                    {sampleLoading ? 'Writing…' : 'Write my free headline'}
                  </button>
                )}
              </section>

              {errorBox}

              {!rewrite ? (
                <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 sm:p-6">
                  <h2 className="text-base font-semibold">Rewrite my whole profile</h2>
                  <p className="mt-1 text-sm text-slate-300">3 headlines, a new About, better experience descriptions, the skills to pin and add, a custom URL and banner text. Built only from what is in your profile.</p>
                  <button type="button" onClick={handleFullRewrite} disabled={rewriting} className={`${primaryButton} mt-4`}>
                    {rewriting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-5 w-5" aria-hidden="true" />}
                    {rewriting ? 'Rewriting your profile…' : 'Optimize my full profile (1 Quick credit)'}
                  </button>
                </section>
              ) : (
                <RewriteResults
                  rewrite={rewrite}
                  profile={profile}
                  before={score.total}
                  after={afterScore?.total ?? score.total}
                  unsupported={unsupported}
                  extension={extension}
                />
              )}

              <button type="button" onClick={startOver} className={`${secondaryButton} w-full`}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Start over
              </button>
            </>
          )}
        </main>
      </div>
    </>
  );
};

const ResultBlock: React.FC<{ title: string; text: string; note?: string; fill?: 'headline' | 'about'; children?: React.ReactNode }> = ({ title, text, note, fill, children }) => (
  <section className={`${cardClass} p-4 sm:p-5`}>
    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
      <h3 className="font-semibold text-slate-100">{title}</h3>
      <div className="flex flex-wrap items-start gap-2">
        {fill && <FillOnLinkedIn field={fill} text={text} />}
        <CopyButton text={text} />
      </div>
    </div>
    {children ?? <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-300">{text}</p>}
    {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
  </section>
);

const RewriteResults: React.FC<{ rewrite: LinkedInRewrite; profile: LinkedInProfile; before: number; after: number; unsupported: string[]; extension: boolean }> = ({
  rewrite, profile, before, after, unsupported, extension,
}) => (
  <div className="space-y-4">
    <section className={`${cardClass} flex items-center justify-center gap-4 p-6`}>
      <div className="flex flex-col items-center"><ScoreRing score={before} size="sm" /><span className="mt-1 text-xs text-slate-400">Before</span></div>
      <span className="text-2xl text-slate-500" aria-hidden="true">→</span>
      <div className="flex flex-col items-center"><ScoreRing score={after} size="sm" /><span className="mt-1 text-xs text-slate-400">After</span></div>
    </section>
    <p className="px-1 text-xs text-slate-500">"After" scores the new text with the same checks. Profile items you still have to add (photo, banner, recommendations) are not counted until you tick them.</p>

    {unsupported.length > 0 && (
      <div role="note" className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span>Check before posting: <strong>{unsupported.join(', ')}</strong> {unsupported.length === 1 ? 'is' : 'are'} not in your profile. Keep only what is true.</span>
      </div>
    )}

    {rewrite.headlines.map((h, i) => (
      <ResultBlock key={i} title={`Headline option ${i + 1}`} text={h} note={`${h.length}/220 characters`} fill={extension ? 'headline' : undefined} />
    ))}
    {rewrite.about && <ResultBlock title="About" text={rewrite.about} note={`${rewrite.about.length}/2,600 characters`} fill={extension ? 'about' : undefined} />}
    {rewrite.experience.map((e) => (
      <ResultBlock
        key={e.index}
        title={[profile.experience[e.index]?.title, profile.experience[e.index]?.org].filter(Boolean).join(' · ') || 'Experience'}
        text={e.description}
      />
    ))}
    {rewrite.pinSkills.length > 0 && <ResultBlock title="Skills to pin at the top" text={rewrite.pinSkills.join(', ')} />}
    {rewrite.addSkills.length > 0 && (
      <ResultBlock title="Skills to add (already shown in your profile)" text={rewrite.addSkills.join(', ')} />
    )}
    {rewrite.addIfYouHaveIt.length > 0 && (
      <ResultBlock title="Add only if you really have them" text={rewrite.addIfYouHaveIt.join(', ')} note="Common for this role but not in your profile. Learn them or leave them out." />
    )}
    {rewrite.customUrl && (
      <ResultBlock title="Custom profile URL" text={`linkedin.com/in/${rewrite.customUrl}`} note="LinkedIn: View profile → Edit public profile & URL." />
    )}
    {rewrite.bannerText && <ResultBlock title="Banner text idea" text={rewrite.bannerText} />}
  </div>
);

export default LinkedInOptimizerPage;
