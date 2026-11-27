import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  ExternalLink,
  TrendingUp,
  Loader2,
  ArrowLeft,
  FileText,
  Bot,
  Mail,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { APPLY_MAIL, ApplyAgent, ApplyMail, ApplyQuestion, autoApplyOrchestratorService } from '../../services/autoApplyOrchestratorService';
import { AutoApplyQuestionsModal } from '../modals/AutoApplyQuestionsModal';
import { AutoApplyLoginModal } from '../modals/AutoApplyLoginModal';
import { ApplyAgentModal } from '../modals/ApplyAgentModal';
// The same list the worker refuses on, so the two can never disagree.
import { isProviderLoginHost } from '../../../supabase/functions/_shared/providerHosts';
import { AnimatedCard, GradientButton, FloatingParticles, ChristmasSnow } from '../ui';

/** Statuses a worker is moving through, so the row will change without the user. */
const IN_FLIGHT = ['queued', 'optimizing_resume', 'logging_in', 'filling_form', 'submitting'];
const POLL_MS = 4000;

const STEPS = [
  ['queued', 'Waiting'], ['optimizing_resume', 'Opening the job'], ['logging_in', 'Signing in'],
  ['filling_form', 'Filling the form'], ['submitting', 'Sending'],
] as const;

const MAIL_KINDS: Record<string, [string, string]> = {
  confirmed: ['Received', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'],
  interview: ['Interview', 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'],
  rejected: ['Not selected', 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300'],
  other: ['Message', 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'],
};

/** What the agent is doing on one application, as it does it. */
const LiveSteps: React.FC<{ status: string }> = ({ status }) => {
  const now = STEPS.findIndex(([name]) => name === status);
  return (
    <ol aria-label="What your agent is doing" aria-live="polite" className="mb-4 flex flex-wrap gap-2">
      {STEPS.map(([name, label], index) => (
        <li
          key={name}
          aria-current={index === now ? 'step' : undefined}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            index === now
              ? 'bg-blue-600 text-white'
              : index < now
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-dark-200 dark:text-gray-400'
          }`}
        >
          {label}
        </li>
      ))}
    </ol>
  );
};

interface Application {
  id: string;
  user_id: string;
  resume_version_id?: string | null;
  given_answers?: Record<string, string> | null;
  status: string;
  submission_time: string;
  created_at: string;
  platform: string;
  application_url: string;
  time_taken_seconds: number;
  error_message?: string;
  /** With status 'needs_input': what the form asked that the profile could not answer. */
  pending_questions?: ApplyQuestion[];
  /** With status 'needs_login': the sign-in address the login would be saved for. */
  login_site?: string | null;
  job_listings: {
    id: string;
    company_name: string;
    role_title: string;
    company_logo_url?: string;
  };
  optimized_resumes: {
    match_score: number;
    pdf_url: string;
  };
}

/**
 * Stopped at a Google, Microsoft or similar sign-in, which only the user can get
 * past. Applications saved before the engine refused these say so by their
 * sign-in address; newer ones are handed to the user with that message.
 */
const behindProvider = (application: Application) =>
  (application.status === 'needs_login' && isProviderLoginHost(application.login_site || ''))
  || (application.status === 'needs_manual_action' && /never use your|^Smart Apply/i.test(application.error_message || ''));

/** A job on a site the runner does not finish: the user applies with the tailored resume. */
const smartApply = (application: Application) => /^Smart Apply/i.test(application.error_message || '');

/** Set by our browser extension, on this site only. */
const hasExtension = () => document.documentElement.dataset.primoboostExtension === '1';

export const AutoAppliedJobsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isChristmasMode, colors } = useTheme();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'failed'>('all');
  // The application whose question or sign-in is being answered right now.
  const [answering, setAnswering] = useState<Application | null>(null);
  const [signingIn, setSigningIn] = useState<Application | null>(null);
  const [agent, setAgent] = useState<ApplyAgent | null>(null);
  const [mail, setMail] = useState<ApplyMail[]>([]);
  const [agreeing, setAgreeing] = useState(false);
  // Why the last answer could not be taken.
  const [problem, setProblem] = useState('');

  // Applications held until the user supplies something. They keep their place
  // in the queue, so answering one sends it straight back to a worker.
  const waiting = applications.filter(
    (application) => application.status === 'needs_input' || application.status === 'needs_login' || behindProvider(application),
  );
  const running = applications.some((application) => IN_FLIGHT.includes(application.status));

  useEffect(() => {
    if (!user) return;
    loadApplications();
    loadAgent();
  }, [user]);

  // A run carries on without this page, so follow it rather than showing
  // whatever was true when the page loaded. What the page shows is also what it
  // offers: a stale list asks for answers to applications that have moved on.
  // ponytail: polls only while a run is live, so a run started on another
  // device shows on refresh. Realtime is the upgrade, once the table is added
  // to the supabase_realtime publication.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(loadApplications, POLL_MS);
    return () => clearInterval(timer);
  }, [running]);

  const loadApplications = async () => {
    try {
      const data = await autoApplyOrchestratorService.getUserApplications(user!.id);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgent = async () => {
    try {
      const [row, messages] = await Promise.all([autoApplyOrchestratorService.getAgent(), autoApplyOrchestratorService.getMail()]);
      setAgent(row);
      setMail(messages);
    } catch (error) {
      console.error('Error loading the apply agent:', error);
    }
  };

  const turnOff = async () => {
    setProblem('');
    try {
      await autoApplyOrchestratorService.setAgent(false);
    } catch (error: any) {
      setProblem(error.message);
    }
    await loadAgent();
  };

  const removeMail = async (id: string) => {
    setProblem('');
    try {
      await autoApplyOrchestratorService.deleteMail(id);
      setMail((current) => current.filter((message) => message.id !== id));
    } catch (error: any) {
      setProblem(error.message);
    }
  };

  const sendBack = async (application: Application, answers: Record<string, string>) => {
    setProblem('');
    try {
      await autoApplyOrchestratorService.resumeWithAnswers(
        application.id, answers, application.pending_questions || [],
      );
    } catch (error: any) {
      setProblem(error.message);
    }
    await loadApplications();
  };

  const appliedMyself = async (application: Application) => {
    setProblem('');
    try {
      await autoApplyOrchestratorService.markApplied(application.id);
    } catch (error: any) {
      setProblem(error.message);
    }
    await loadApplications();
  };

  const filteredApplications = applications.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>Submitted</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            <span>Failed</span>
          </div>
        );
      case 'queued':
      case 'optimizing_resume':
      case 'logging_in':
      case 'filling_form':
      case 'submitting':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4 animate-spin" />
            <span>{status === 'queued' ? 'Waiting to start' : 'In progress'}</span>
          </div>
        );
      // Waiting on the user. The application is held, not lost.
      case 'needs_login':
      case 'needs_input':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>Needs you</span>
          </div>
        );
      case 'needs_manual_action':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium">
            <ExternalLink className="w-4 h-4" />
            <span>Finish on the site</span>
          </div>
        );
      // Submit was pressed and no confirmation came back. The employer may
      // have it, so this is never sent again on its own.
      case 'submission_uncertain':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>Not confirmed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>{status}</span>
          </div>
        );
    }
  };

  const stats = {
    total: applications.length,
    submitted: applications.filter((a) => a.status === 'submitted').length,
    failed: applications.filter((a) => a.status === 'failed').length,
    avgMatchScore:
      applications.length > 0
        ? Math.round(
            applications.reduce((sum, a) => sum + (a.optimized_resumes?.match_score || 0), 0) /
              applications.length
          )
        : 0,
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Please log in to view your applications</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 lg:pl-16 py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/jobs')}
            className="lg:hidden flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Jobs</span>
          </button>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            My Auto Applications
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track all your AI-powered job applications
          </p>
        </div>

        {problem && (
          <div role="alert" className="mb-6 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            {problem}
          </div>
        )}

        <section aria-label="Your apply agent" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-dark-300 bg-white dark:bg-dark-100 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <Bot className={`mt-0.5 w-6 h-6 flex-shrink-0 ${agent?.active ? 'text-emerald-500' : 'text-gray-400'}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{agent?.active ? 'Your agent is on' : 'Your agent is off'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                {agent?.active ? (APPLY_MAIL ? <>Companies are given <strong>{agent.address}</strong>. Their replies come to you too.</> : 'Companies reply to your own email, so watch your inbox.') : 'Turn it on to apply from any job with one press.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {agent?.active && (
              <button
                onClick={() => setAgreeing(true)}
                className="min-h-[44px] rounded-lg border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
              >
                Edit my answers
              </button>
            )}
            <button
              onClick={() => (agent?.active ? turnOff() : setAgreeing(true))}
              className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${agent?.active ? 'border border-gray-300 dark:border-dark-300 text-gray-700 dark:text-gray-300' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
            >
              {agent?.active ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        </section>

        {mail.length > 0 && (
          <section aria-label="Replies from companies" className="mb-8 rounded-xl border border-gray-200 dark:border-dark-300 bg-white dark:bg-dark-100 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <Mail className="w-5 h-5 text-blue-500" aria-hidden="true" /> Replies from companies
            </h2>
            <ul className="max-h-96 divide-y divide-gray-200 dark:divide-dark-300 overflow-y-auto">
              {mail.map((message) => (
                <li key={message.id} className="flex items-start gap-3 py-3">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-sm text-gray-900 dark:text-gray-100 break-words">
                      <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${MAIL_KINDS[message.kind][1]}`}>{MAIL_KINDS[message.kind][0]}</span>
                      {message.subject || 'No subject'}
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{message.from_address} · {new Date(message.received_at).toLocaleString()}</span>
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">{message.body}</p>
                  </details>
                  <button onClick={() => removeMail(message.id)} aria-label={`Delete message: ${message.subject || 'No subject'}`} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Applications held until the user supplies something. These keep their
            place: answering one sends it straight back to a worker. */}
        {waiting.length > 0 && (
          <div className="mb-8 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
            <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-1">
              {waiting.length === 1 ? 'One application needs you' : `${waiting.length} applications need you`}
            </h2>
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">
              Each one carries on by itself as soon as you answer.
            </p>
            <div className="space-y-3">
              {waiting.map((application) => (
                <div
                  key={application.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white dark:bg-dark-100 px-4 py-3 border border-amber-200 dark:border-amber-900"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {application.job_listings?.role_title}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {application.job_listings?.company_name}
                      {application.status === 'needs_login' && application.login_site
                        ? ` · sign in at ${application.login_site}`
                        : application.pending_questions?.length
                          ? ` · ${application.pending_questions.length} question${application.pending_questions.length === 1 ? '' : 's'}`
                          : ''}
                    </p>
                  </div>
                  {behindProvider(application) ? (
                    // An application saved before the engine learned to refuse
                    // these still asks for a login here. Offering the button
                    // would invite the user to hand over the account holding
                    // their mail and everything else, to reach one job. Their
                    // own browser is already signed in, so the form opens there.
                    <div className="max-w-sm text-right">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {smartApply(application)
                          ? 'Your tailored resume is ready. Open the job, apply with it, then press "I\'ve applied".'
                          : hasExtension()
                            ? 'This job needs your own sign-in. Open the form and our extension will fill it for you.'
                            : 'This job needs your own sign-in, and we never use that account for you. Open the form and apply in your own browser.'}
                      </p>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        {application.optimized_resumes?.pdf_url && (
                          <a
                            href={application.optimized_resumes.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-lg border border-amber-600 text-amber-800 dark:text-amber-300 text-sm font-semibold transition-colors"
                          >
                            Download Resume
                          </a>
                        )}
                        <a
                          href={application.application_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => { autoApplyOrchestratorService.prepareInBrowser(application).catch(() => {}); }}
                          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                        >
                          Open the form
                        </a>
                        <button
                          onClick={() => appliedMyself(application)}
                          className="px-4 py-2 rounded-lg border border-amber-600 text-amber-800 dark:text-amber-300 text-sm font-semibold transition-colors"
                        >
                          I've applied
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        application.status === 'needs_login'
                          ? setSigningIn(application)
                          : application.pending_questions?.length
                            ? setAnswering(application)
                            // Paused before questions were saved with the row, so
                            // the only way to learn what it wants is to run it again.
                            : sendBack(application, {})
                      }
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                    >
                      {application.status === 'needs_login'
                        ? 'Add login'
                        : application.pending_questions?.length
                          ? 'Answer questions'
                          : 'Try again'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total applications</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.total}
                </p>
              </div>
              <Briefcase className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Submitted</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.submitted}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Failed</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Match Score</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.avgMatchScore}%
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-300'
            }`}
          >
            All ({applications.length})
          </button>
          <button
            onClick={() => setFilter('submitted')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'submitted'
                ? 'bg-green-600 text-white'
                : 'bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-300'
            }`}
          >
            Submitted ({stats.submitted})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-300'
            }`}
          >
            Failed ({stats.failed})
          </button>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white dark:bg-dark-100 rounded-xl p-12 text-center border border-gray-200 dark:border-dark-300">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Applications Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start applying to jobs using Auto Apply to see them here
            </p>
            <button
              onClick={() => navigate('/jobs')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    {app.job_listings.company_logo_url ? (
                      <img
                        src={app.job_listings.company_logo_url}
                        alt={app.job_listings.company_name}
                        className="w-16 h-16 rounded-lg object-contain bg-gray-50 dark:bg-dark-200 p-2"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                        {app.job_listings.company_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {app.job_listings.role_title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        {app.job_listings.company_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(app.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{app.time_taken_seconds}s</span>
                        </div>
                        {app.optimized_resumes?.match_score && (
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="w-4 h-4" />
                            <span>{app.optimized_resumes.match_score}% match</span>
                          </div>
                        )}
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
                          {app.platform}
                        </span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(app.status)}
                </div>

                {IN_FLIGHT.includes(app.status) && <LiveSteps status={app.status} />}

                {app.error_message && !behindProvider(app) && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-800 dark:text-red-300">{app.error_message}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {app.optimized_resumes?.pdf_url && (
                    <a
                      href={app.optimized_resumes.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Resume</span>
                    </a>
                  )}
                  <a
                    href={app.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Application</span>
                  </a>
                  <button
                    onClick={() => navigate(`/jobs/${app.job_listings.id}`)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-dark-200 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Job Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Answering here sends the application straight back to a worker, so the
          user never has to start it again from the job page. */}
      <AutoApplyQuestionsModal
        questions={answering?.pending_questions ?? null}
        companyName={answering?.job_listings?.company_name}
        onSubmit={async (answers) => {
          const application = answering;
          setAnswering(null);
          if (application) await sendBack(application, answers);
        }}
        onClose={() => setAnswering(null)}
      />

      <ApplyAgentModal
        isOpen={agreeing}
        editOnly={!!agent?.active}
        onClose={() => setAgreeing(false)}
        onAgreed={() => { setAgreeing(false); loadAgent(); }}
      />

      <AutoApplyLoginModal
        site={signingIn?.login_site ?? null}
        message={signingIn?.error_message}
        onSubmit={async (username, password) => {
          const application = signingIn;
          if (!application?.login_site) return;
          // Throws when saving fails, so the window can show why and stay open.
          await autoApplyOrchestratorService.resumeAfterLogin(
            application.id, application.login_site, username, password,
          );
          setSigningIn(null);
          await loadApplications();
        }}
        onClose={() => setSigningIn(null)}
      />
    </div>
  );
};
