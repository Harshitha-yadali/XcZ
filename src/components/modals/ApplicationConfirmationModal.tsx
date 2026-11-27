// src/components/modals/ApplicationConfirmationModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  ExternalLink,
  RefreshCw,
  Clock,
  Zap,
  Calendar,
  Building2
} from 'lucide-react';
import { JobListing, AutoApplyResult } from '../../types/jobs';

interface ApplicationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobListing | null;
  result: AutoApplyResult | null;
}

export const ApplicationConfirmationModal: React.FC<ApplicationConfirmationModalProps> = ({
  isOpen,
  onClose,
  job,
  result
}) => {
  if (!isOpen || !job || !result) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isSuccess = result.success && result.status === 'submitted';
  // Not an error: the resume is tailored, the user submits on the employer's site.
  const isManual = !isSuccess && Boolean(result.manual);
  // Submit was pressed and nothing confirmed it. Neither a success nor a
  // failure: the user must not be nudged into applying a second time.
  const isUncertain = !isSuccess && Boolean(result.uncertain);
  // Handed to the worker, which carries on whether or not this tab stays open.
  // Nothing has gone wrong, so it must not be dressed as a failure.
  const isQueued = !isSuccess && result.error === 'QUEUED';
  // The employer's doing, and nothing the user could finish by hand.
  const isClosed = !isSuccess && result.error === 'JOB_CLOSED';
  const tone = isSuccess ? 'green' : isUncertain || isClosed ? 'amber' : isManual || isQueued ? 'blue' : 'red';
  const tones = {
    green: {
      header: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
      icon: 'bg-gradient-to-r from-green-500 to-emerald-500',
      text: 'text-green-700 dark:text-green-300',
    },
    blue: {
      header: 'bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20',
      icon: 'bg-gradient-to-r from-blue-500 to-sky-500',
      text: 'text-blue-700 dark:text-blue-300',
    },
    amber: {
      header: 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20',
      icon: 'bg-gradient-to-r from-amber-500 to-yellow-500',
      text: 'text-amber-800 dark:text-amber-300',
    },
    red: {
      header: 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20',
      icon: 'bg-gradient-to-r from-red-500 to-orange-500',
      text: 'text-red-700 dark:text-red-300',
    },
  }[tone];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={handleBackdropClick}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto dark:bg-dark-100"
        >
          {/* Header */}
          <div className={`relative p-6 border-b border-gray-200 dark:border-dark-300 ${tones.header}`}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center pr-16">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${tones.icon}`}>
                {isSuccess ? (
                  <CheckCircle className="w-8 h-8 text-white" />
                ) : isQueued ? (
                  <Clock className="w-8 h-8 text-white" />
                ) : isManual ? (
                  <Download className="w-8 h-8 text-white" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-white" />
                )}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {isSuccess
                  ? 'Submitted'
                  : isQueued
                    ? 'Applying now'
                    : isUncertain
                      ? 'Submission uncertain'
                      : isClosed
                        ? 'This job has closed'
                        : 'Needs manual completion'}
              </h1>
              
              <p className={`text-lg ${tones.text}`}>
                {result.message}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Job Information */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 dark:bg-dark-200">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                Application Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Position:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{job.role_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Company:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{job.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Method:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                    <Zap className="w-4 h-4 mr-1 text-purple-600" />
                    Auto Apply
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{isQueued ? 'Started:' : 'Applied on:'}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Application Proof */}
            <div className={`bg-blue-50 rounded-xl p-4 mb-6 dark:bg-blue-900/20 ${result.resumeUrl || result.screenshotUrl ? '' : 'hidden'}`}>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                {isManual ? 'Finish your application' : 'Application Proof'}
              </h3>
              <div className="flex flex-wrap gap-3">
                {isManual && result.fallbackUrl && (
                  <a
                    href={result.fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open application page</span>
                  </a>
                )}
                {result.resumeUrl && (
                  <a
                    href={result.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Resume</span>
                  </a>
                )}

                {result.screenshotUrl && (
                  <a
                    href={result.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Screenshot</span>
                  </a>
                )}
              </div>
            </div>

            {/* Error Details (if failed) */}
            {isUncertain && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 dark:bg-amber-900/20 dark:border-amber-500/50">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">What to do now</h3>
                <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                  <li>Check your email, including spam, for a confirmation from {job.company_name}.</li>
                  <li>If one arrives, your application is in and there is nothing more to do.</li>
                  <li>Do not apply again unless you are sure none arrived: the employer may receive it twice.</li>
                </ul>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  We will not send this application again on our own.
                </p>
              </div>
            )}

            {isQueued && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 dark:bg-blue-900/20 dark:border-blue-500/50">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">What happens now</h3>
                <ul className="list-disc pl-5 text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>The application runs on our side. You can close this page.</li>
                  <li>If the form asks something we cannot answer from your resume, we will ask you on My Auto Applications.</li>
                  <li>The result appears there too, so you never have to guess whether it was sent.</li>
                </ul>
                <Link
                  to="/jobs/auto-applied"
                  onClick={onClose}
                  className="inline-flex items-center space-x-2 mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open My Auto Applications</span>
                </Link>
              </div>
            )}

            {!isSuccess && !isManual && !isUncertain && !isQueued && !isClosed && result.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 dark:bg-red-900/20 dark:border-red-500/50">
                <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">Error Details</h3>
                <p className="text-red-700 dark:text-red-400 text-sm">{result.error}</p>
                
                {result.fallbackUrl && (
                  <div className="mt-3">
                    <p className="text-red-700 dark:text-red-400 text-sm mb-2">
                      You can try applying manually using the link below:
                    </p>
                    <a
                      href={result.fallbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Apply Manually</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Success Actions */}
            {isSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 dark:bg-green-900/20 dark:border-green-500/50">
                <div className="flex items-center mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <h3 className="font-semibold text-green-900 dark:text-green-300">Next Steps</h3>
                </div>
                <ul className="text-green-700 dark:text-green-400 text-sm space-y-1">
                  <li>• Your application has been submitted successfully</li>
                  <li>• Keep an eye on your email for responses</li>
                  <li>• Follow up in 1-2 weeks if no response</li>
                  <li>• Continue applying to similar positions</li>
                </ul>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-center">
              <button
                onClick={onClose}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                {isSuccess ? 'Continue Job Search' : 'Close'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};