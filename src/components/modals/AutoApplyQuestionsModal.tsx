import React from 'react';
import { X } from 'lucide-react';
import { ApplyQuestion } from '../../services/autoApplyOrchestratorService';

interface AutoApplyQuestionsModalProps {
  questions: ApplyQuestion[] | null;
  companyName?: string;
  onSubmit: (answers: Record<string, string>) => void;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm';

/** Asks for the answers an employer's form requires that the profile does not have. */
export const AutoApplyQuestionsModal: React.FC<AutoApplyQuestionsModalProps> = ({
  questions,
  companyName,
  onSubmit,
  onClose,
}) => {
  if (!questions?.length) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answers: Record<string, string> = {};
    for (const question of questions) {
      // A checkbox group posts one value per ticked box.
      const value = form.getAll(question.key).join(' | ');
      if (value) answers[question.key] = value;
    }
    onSubmit(answers);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">A few more details</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {companyName ? `${companyName}'s` : 'The'} application form asks for these. We save your answers, so you
              only fill them in once.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((question) => (
            <fieldset key={question.key}>
              <legend className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">{question.label}</legend>
              {question.type === 'checks' ? (
                <div className="grid grid-cols-2 gap-1">
                  {question.options.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" name={question.key} value={option} />
                      {option}
                    </label>
                  ))}
                </div>
              ) : question.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" name={question.key} value="yes" required />
                  Yes, I agree
                </label>
              ) : question.options.length ? (
                <select name={question.key} required defaultValue="" aria-label={question.label} className={inputClass}>
                  <option value="" disabled>Select...</option>
                  {question.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : question.type === 'textarea' ? (
                <textarea name={question.key} required rows={3} aria-label={question.label} className={inputClass} />
              ) : (
                <input type="text" name={question.key} required aria-label={question.label} className={inputClass} />
              )}
            </fieldset>
          ))}

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
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Submit application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
