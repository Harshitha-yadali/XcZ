import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AutoApplyLoginModalProps {
  /** The job site that needs a sign-in, or null when no login is being asked for. */
  site: string | null;
  message?: string;
  onSubmit: (username: string, password: string) => Promise<void>;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm';

/** Asks for the user's own login on a job site that only takes applications from an account. */
export const AutoApplyLoginModal: React.FC<AutoApplyLoginModalProps> = ({ site, message, onSubmit, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!site) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      await onSubmit(String(form.get('username') || ''), String(form.get('password') || ''));
    } catch (failure: any) {
      setError(failure.message || 'The login could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sign in to {site}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {message || 'This site only takes applications from a signed-in account.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
            Email or username on {site}
            <input type="text" name="username" required autoComplete="off" className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
            Password on {site}
            <input type="password" name="password" required autoComplete="new-password" className={`${inputClass} mt-1`} />
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            No account there yet? Create one on {site} first, then enter the same details here. We store the password
            encrypted and use it only to sign in on this site and send your applications.
          </p>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              {saving ? 'Saving...' : 'Save and apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
