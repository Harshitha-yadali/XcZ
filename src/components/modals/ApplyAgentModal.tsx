import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot } from 'lucide-react';
import { APPLY_MAIL, autoApplyOrchestratorService } from '../../services/autoApplyOrchestratorService';
import { TOPICS } from '../../../supabase/functions/_shared/applyTopics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called once the user's agreement (or, with editOnly, their answers) is saved. */
  onAgreed: () => void;
  /** The agent is already on: show only the questions, to change the answers. */
  editOnly?: boolean;
}

const fieldClass = 'mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 px-3 text-sm text-gray-900 dark:text-gray-100';

/**
 * The user's agreement that the agent may apply in their name, asked once and
 * never assumed, together with the questions nearly every form asks. Answered
 * here, a form does not stop for them; left blank, the form asks when it comes up.
 */
export const ApplyAgentModal: React.FC<Props> = ({ isOpen, onClose, onAgreed, editOnly = false }) => {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setProblem('');
    autoApplyOrchestratorService.getApplyAnswers()
      .then((saved) => setAnswers(Object.fromEntries(TOPICS.map((topic) => [topic.key, saved[topic.key] || '']))))
      .catch(() => setAnswers({}));
  }, [isOpen]);

  if (!isOpen) return null;

  const save = async () => {
    setSaving(true);
    setProblem('');
    try {
      await autoApplyOrchestratorService.saveApplyTopics(answers);
      if (!editOnly) await autoApplyOrchestratorService.setAgent(true);
      onAgreed();
    } catch (error: any) {
      setProblem(error.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="apply-agent-title" className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-dark-100 p-6 shadow-xl">
        <h2 id="apply-agent-title" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
          <Bot className="w-6 h-6 text-emerald-500" aria-hidden="true" />
          {editOnly ? 'Your answers for job forms' : 'Let your agent apply for you'}
        </h2>
        {!editOnly && (
          <>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">When you press Auto Apply on a job, your agent will:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
              <li>fill the company's form with your profile and tailored resume, and <strong>submit it without asking you again</strong></li>
              <li>ask you only when a detail is missing, or when the site wants something only you can do</li>
              <li>sign in with a login you saved for that site, or open an account there in your name and accept its terms when applying needs one</li>
              <li>
                {APPLY_MAIL
                  ? 'give companies a PrimoBoost email address, read the codes and replies sent to it, and forward them to you'
                  : 'give companies your own email, so their replies come straight to you; if a site emails you a code, you finish that application yourself'}
              </li>
            </ul>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              It never uses your Gmail or its password, never applies to a job you did not choose, and you can turn it off at any time.
            </p>
          </>
        )}

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">Questions most job forms ask</legend>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Answer these once so forms do not stop to ask. These answers go to companies exactly as you write them. Leave any blank and we will ask when a form needs it.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {TOPICS.map((topic) => (
              <label key={topic.key} className="block text-sm text-gray-700 dark:text-gray-300">
                {topic.label}
                {topic.options ? (
                  <select
                    value={answers[topic.key] || ''}
                    onChange={(event) => setAnswers({ ...answers, [topic.key]: event.target.value })}
                    className={fieldClass}
                  >
                    <option value="">Ask me each time</option>
                    {topic.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input
                    value={answers[topic.key] || ''}
                    onChange={(event) => setAnswers({ ...answers, [topic.key]: event.target.value })}
                    placeholder={topic.hint}
                    maxLength={200}
                    className={fieldClass}
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>

        {problem && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{problem}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="min-h-[44px] rounded-lg border border-gray-300 dark:border-dark-300 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {editOnly ? 'Cancel' : 'Not now'}
          </button>
          <button onClick={save} disabled={saving} className="min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving…' : editOnly ? 'Save answers' : 'I agree, apply for me'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
