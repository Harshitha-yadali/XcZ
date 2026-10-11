import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { ApplyQuestion } from '../../services/autoApplyOrchestratorService';

export interface ApplicationReview {
  /** What will be typed into the employer's form, by field label. */
  filled: Record<string, string>;
  /** Boxes on the form that are the user's choice to tick. */
  consents: ApplyQuestion[];
  /** Facts in the tailored resume that the user's original resume does not state. */
  flags: string[];
  pdfUrl?: string;
}

interface AutoApplyReviewModalProps {
  review: ApplicationReview | null;
  jobTitle?: string;
  companyName?: string;
  /** Called with the keys of the consent boxes the user ticked. */
  onApprove: (consentKeys: string[]) => void;
  onClose: () => void;
}

/**
 * The last stop before anything is sent: the tailored resume, every answer,
 * and the employer's consent boxes, with a single Approve & Submit action.
 */
export const AutoApplyReviewModal: React.FC<AutoApplyReviewModalProps> = ({
  review,
  jobTitle,
  companyName,
  onApprove,
  onClose,
}) => {
  const [confirmedFacts, setConfirmedFacts] = useState(false);
  if (!review) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onApprove(review.consents.filter((consent) => form.get(consent.key)).map((consent) => consent.key));
  };
  const answers = Object.entries(review.filled);
  const blocked = review.flags.length > 0 && !confirmedFacts;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Ready for review</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {jobTitle}{companyName ? ` at ${companyName}` : ''}. Nothing has been sent yet. Check what follows, then
              approve.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Tailored resume</h3>
            {review.pdfUrl ? (
              <a
                href={review.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open the resume that will be sent
              </a>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">The resume file could not be linked.</p>
            )}

            {review.flags.length > 0 && (
              <div role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4">
                <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4" />
                  Not found in your original resume
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  Tailoring added or changed these. If any is not true, close this window and correct your resume
                  before applying.
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-amber-900 dark:text-amber-200">
                  {review.flags.map((flag) => <li key={flag}>{flag}</li>)}
                </ul>
                <label className="mt-3 flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmedFacts}
                    onChange={(event) => setConfirmedFacts(event.target.checked)}
                  />
                  I have checked each of these and they are true of me.
                </label>
              </div>
            )}
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Answers on the form</h3>
            {answers.length ? (
              <dl className="divide-y divide-gray-200 dark:divide-dark-300 text-sm">
                {answers.map(([label, value]) => (
                  <div key={label} className="py-2 grid grid-cols-5 gap-3">
                    <dt className="col-span-3 text-gray-600 dark:text-gray-400">{label}</dt>
                    <dd className="col-span-2 font-medium text-gray-900 dark:text-gray-100 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">This page of the form has no answers to fill.</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              If the form has further pages, you will be asked for any answer they need before it is sent.
            </p>
          </section>

          {review.consents.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">The employer asks you to agree to</h3>
              <div className="space-y-2">
                {review.consents.map((consent) => (
                  <label key={consent.key} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" name={consent.key} value="yes" className="mt-1" />
                    <span>{consent.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Only the boxes you tick here are ticked on the form. Some employers will not accept an application
                without them.
              </p>
            </section>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-dark-300 text-gray-800 dark:text-gray-100 font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={blocked}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Approve &amp; Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
