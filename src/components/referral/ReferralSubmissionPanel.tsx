import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  FileText,
  IndianRupee,
  Loader2,
  Mail,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { referralService } from '../../services/referralService';
import { supabase } from '../../lib/supabaseClient';
import { fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../../config/env';
import { RAZORPAY_CONFIG, getRazorpayKey } from '../../utils/razorpayConfig';
import type { ReferralListing, ReferralPricing, ReferralSubmission } from '../../types/referral';

interface ReferralSubmissionPanelProps {
  listing: ReferralListing;
  onShowAuth: (callback?: () => void) => void;
  stage?: 'payment' | 'submission' | 'full';
  onPaymentComplete?: (transactionId: string) => void;
  onReturnToPayment?: () => void;
}

interface RazorpayCheckoutResponse {
  razorpay_order_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error?: {
    description?: string;
  };
}

interface ReferralRazorpayInstance {
  on(event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void): void;
  open(): void;
}

interface ReferralRazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
  method: {
    netbanking: boolean;
    card: boolean;
    upi: boolean;
    wallet: boolean;
    paylater: boolean;
  };
}

type ReferralRazorpayConstructor = new (
  options: ReferralRazorpayOptions
) => ReferralRazorpayInstance;

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function getPaymentStorageKey(listingId: string): string {
  return `referral-payment:${listingId}`;
}

export const ReferralSubmissionPanel: React.FC<ReferralSubmissionPanelProps> = ({
  listing,
  onShowAuth,
  stage = 'full',
  onPaymentComplete,
  onReturnToPayment,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [pricing, setPricing] = useState<ReferralPricing | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<ReferralSubmission | null>(null);
  const [checkingSubmission, setCheckingSubmission] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'paid'>('idle');
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');

  const storageKey = getPaymentStorageKey(listing.id);
  const amountPaise = referralService.getResolvedReferralPrice(listing, pricing);
  const amountDisplay = amountPaise > 0 ? amountPaise / 100 : 0;

  const getRazorpayConstructor = (): ReferralRazorpayConstructor | undefined => {
    return (
      window as Window &
        typeof globalThis & {
          Razorpay?: ReferralRazorpayConstructor;
        }
    ).Razorpay;
  };

  useEffect(() => {
    referralService.getPricing().then(setPricing);
  }, []);

  useEffect(() => {
    if (stage === 'submission') {
      return;
    }

    const loadRazorpay = () => {
      if (getRazorpayConstructor()) {
        setPaymentReady(true);
        return;
      }

      const existingScript = document.querySelector(
        'script[src*="checkout.razorpay.com"]'
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => setPaymentReady(true), { once: true });
        existingScript.addEventListener('error', () => setPaymentReady(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setPaymentReady(true);
      script.onerror = () => setPaymentReady(false);
      document.head.appendChild(script);
    };

    loadRazorpay();
  }, [stage]);

  useEffect(() => {
    setContactEmail(user?.email || '');
  }, [user?.email]);

  useEffect(() => {
    const savedTransactionId = window.localStorage.getItem(storageKey);
    if (savedTransactionId) {
      setPaymentTransactionId(savedTransactionId);
      setPaymentState('paid');
    }
  }, [storageKey]);

  useEffect(() => {
    const loadExistingSubmission = async () => {
      if (!isAuthenticated || !user?.id) {
        setExistingSubmission(null);
        return;
      }

      setCheckingSubmission(true);
      const submission = await referralService.getLatestUserSubmission(user.id, listing.id);
      setExistingSubmission(submission);
      if (submission) {
        window.localStorage.removeItem(storageKey);
        setPaymentTransactionId(null);
        setPaymentState('idle');
      }
      setCheckingSubmission(false);
    };

    loadExistingSubmission();
  }, [isAuthenticated, listing.id, storageKey, user?.id]);

  const handleStartPayment = async () => {
    if (!isAuthenticated || !user) {
      onShowAuth();
      return;
    }

    if (!amountPaise || amountPaise <= 0) {
      setError('Referral pricing is not configured for this listing yet.');
      return;
    }

    if (!paymentReady) {
      setError('Payment gateway is still loading. Please wait a moment and try again.');
      return;
    }

    setError('');
    setPaymentState('processing');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setPaymentState('idle');
        setError('Session expired. Please sign in again.');
        return;
      }

      const orderResponse = await fetchWithSupabaseFallback(
        getSupabaseEdgeFunctionUrl('create-order'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            amount: amountPaise,
            metadata: {
              type: 'referral_booking',
              listingId: listing.id,
              listingTitle: `${listing.company_name} - ${listing.role_title}`,
              // Backward compatibility for older deployed create-order functions.
              slotType: 'profile',
            },
          }),
        }
      );

      const orderResult = await orderResponse.json();

      if (!orderResponse.ok) {
        setPaymentState('idle');
        setError(orderResult.error || 'Failed to create the payment order.');
        return;
      }

      const { orderId, keyId, transactionId, amount: serverAmount } = orderResult;

      const RazorpayConstructor = getRazorpayConstructor();
      if (!RazorpayConstructor) {
        setPaymentState('idle');
        setError('Payment gateway is unavailable. Please refresh and try again.');
        return;
      }

      const razorpay = new RazorpayConstructor({
        key: keyId || getRazorpayKey(),
        amount: serverAmount,
        currency: 'INR',
        name: RAZORPAY_CONFIG.COMPANY_NAME,
        description: `${listing.company_name} referral request`,
        order_id: orderId,
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            const verifyResponse = await fetchWithSupabaseFallback(
              getSupabaseEdgeFunctionUrl('verify-payment'),
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || orderId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  transactionId,
                }),
              }
            );

            const verifyResult = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyResult.success) {
              setPaymentState('idle');
              setError(verifyResult.error || 'Payment verified failed. Please contact support.');
              return;
            }

            setPaymentTransactionId(transactionId);
            setPaymentState('paid');
            window.localStorage.setItem(storageKey, transactionId);

            if (stage === 'payment' && onPaymentComplete) {
              onPaymentComplete(transactionId);
            }
          } catch (verifyError: unknown) {
            console.error('Referral payment verification error:', verifyError);
            setPaymentState('idle');
            setError('Payment completed, but verification failed. Please contact support.');
          }
        },
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        theme: {
          color: RAZORPAY_CONFIG.THEME_COLOR,
        },
        modal: {
          ondismiss: () => {
            setPaymentState('idle');
          },
        },
        method: {
          netbanking: true,
          card: true,
          upi: true,
          wallet: true,
          paylater: true,
        },
      });

      razorpay.on('payment.failed', (response: RazorpayFailureResponse) => {
        setPaymentState('idle');
        setError(response?.error?.description || 'Payment failed. Please try again.');
      });

      razorpay.open();
    } catch (paymentError: unknown) {
      console.error('Referral payment error:', paymentError);
      setPaymentState('idle');
      setError('Something went wrong while starting payment. Please try again.');
    }
  };

  const handleSubmitRequest = async () => {
    if (!isAuthenticated || !user?.id) {
      onShowAuth();
      return;
    }

    if (!paymentTransactionId) {
      setError('Complete payment before submitting the referral request.');
      return;
    }

    if (!contactEmail.trim()) {
      setError('Email is required.');
      return;
    }

    if (!resumeFile) {
      setError('Please upload your resume PDF.');
      return;
    }

    const normalizedFileName = resumeFile.name.toLowerCase();
    if (resumeFile.type !== 'application/pdf' && !normalizedFileName.endsWith('.pdf')) {
      setError('Only PDF resumes are allowed.');
      return;
    }

    if (resumeFile.size > MAX_RESUME_BYTES) {
      setError('Resume PDF must be 5 MB or smaller.');
      return;
    }

    setSubmitting(true);
    setError('');
    setEmailNotice('');

    const uploadResult = await referralService.uploadSubmissionResume(
      listing.id,
      paymentTransactionId,
      resumeFile
    );

    if (!uploadResult.success || !uploadResult.storagePath) {
      setSubmitting(false);
      setError(uploadResult.error || 'Failed to upload your resume PDF.');
      return;
    }

    const submissionResult = await referralService.createSubmission({
      user_id: user.id,
      referral_listing_id: listing.id,
      payment_transaction_id: paymentTransactionId,
      applicant_name: user.name || '',
      contact_email: contactEmail.trim(),
      resume_file_name: uploadResult.fileName || resumeFile.name,
      resume_storage_path: uploadResult.storagePath,
    });

    if (!submissionResult.submission) {
      setSubmitting(false);
      setError(submissionResult.error || 'Failed to save your referral request. Please contact support.');
      return;
    }

    const emailResult = await referralService.sendSubmissionEmail(submissionResult.submission.id);

    if (!emailResult.success) {
      setEmailNotice('Your request was saved, but email confirmation is delayed. The admin can still review it.');
    } else {
      setEmailNotice(
        'Check your email for confirmation. If you do not receive an update within 24 hours, we will notify you once it is processed.'
      );
    }

    window.localStorage.removeItem(storageKey);
    setExistingSubmission(submissionResult.submission);
    setPaymentTransactionId(null);
    setPaymentState('idle');
    setResumeFile(null);
    setSubmitting(false);
  };

  const renderPaymentStep = () => (
    <div
      id="referral-submit-flow"
      className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 space-y-5 lg:sticky lg:top-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300 mb-2">
            Step 1 Of 2
          </p>
          <h3 className="text-white font-bold text-xl">Pay to Continue</h3>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Complete the payment here. After payment, the next page will ask for your email ID and resume PDF.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right min-w-[110px]">
          <div className="flex items-center justify-end gap-1 text-emerald-300 text-xs uppercase tracking-wide mb-1">
            <IndianRupee className="w-3.5 h-3.5" />
            Price
          </div>
          <p className="text-white text-2xl font-bold">{amountDisplay || '-'}</p>
        </div>
      </div>

      <div className="grid gap-3">
        {[
          '1. Pay the referral amount for this listing.',
          '2. Open the next page after payment success.',
          '3. Submit your email ID and resume PDF there.',
        ].map((step) => (
          <div
            key={step}
            className="rounded-xl border border-slate-700/40 bg-slate-950/50 px-4 py-3 text-sm text-slate-300"
          >
            {step}
          </div>
        ))}
      </div>

      {paymentState === 'paid' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Payment received. Continue to the next page to enter your email ID and upload your resume PDF.
          </div>

          <button
            onClick={() => paymentTransactionId && onPaymentComplete?.(paymentTransactionId)}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Continue to Upload Page
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleStartPayment}
            disabled={paymentState === 'processing' || !paymentReady || amountPaise <= 0}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paymentState === 'processing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing payment...
              </>
            ) : !paymentReady ? (
              'Loading payment gateway...'
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Pay {'\u20B9'}{amountDisplay} to Refer Me
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  const renderSubmissionStep = () => {
    if (!paymentTransactionId) {
      return (
        <div
          id="referral-submit-flow"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-300 flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Complete payment first</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                This page is only for the second step. First complete the referral payment, then come here to enter your email ID and upload the resume PDF.
              </p>
            </div>
          </div>

          {onReturnToPayment && (
            <button
              onClick={onReturnToPayment}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Go to Payment Page
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        id="referral-submit-flow"
        className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300 mb-2">
              Step 2 Of 2
            </p>
            <h3 className="text-white font-bold text-xl">Email and Resume Upload</h3>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Payment is done. Now enter your email ID and upload your resume PDF so the admin can process your referral.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right min-w-[110px]">
            <div className="flex items-center justify-end gap-1 text-emerald-300 text-xs uppercase tracking-wide mb-1">
              <IndianRupee className="w-3.5 h-3.5" />
              Price
            </div>
            <p className="text-white text-2xl font-bold">{amountDisplay || '-'}</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Payment received. Now enter your email ID and upload your resume PDF to finish the referral request.
        </div>

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="Email ID for referral updates"
            className="w-full rounded-xl border border-slate-700/50 bg-slate-800/60 pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <label className="block rounded-xl border border-dashed border-slate-700/60 bg-slate-950/50 px-4 py-4 cursor-pointer hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-300 flex-shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium">
                {resumeFile ? resumeFile.name : 'Upload PDF resume'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                PDF only, maximum 5 MB.
              </p>
            </div>
          </div>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
          />
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleSubmitRequest}
          disabled={submitting}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting referral request...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Submit My Referral
            </>
          )}
        </button>
      </div>
    );
  };

  if (checkingSubmission) {
    return (
      <div
        id="referral-submit-flow"
        className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6"
      >
        <div className="flex items-center gap-3 text-slate-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking your referral request status...
        </div>
      </div>
    );
  }

  if (existingSubmission) {
    return (
      <div
        id="referral-submit-flow"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Referral request submitted</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              We saved your email and PDF for this referral. Check your email for updates. If you do not receive a referral update within 24 hours, we will notify you once it is processed.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3">
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Contact Email</p>
            <p className="text-white break-all">{existingSubmission.contact_email}</p>
          </div>
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3">
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Submitted</p>
            <p className="text-white">
              {new Date(existingSubmission.created_at).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {emailNotice && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-blue-100 text-sm">
            {emailNotice}
          </div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        id="referral-submit-flow"
        className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold">Refer Me</h3>
            <p className="text-slate-400 text-sm">
              Sign in to pay first, then enter your email ID and upload your resume PDF.
            </p>
          </div>
        </div>
        <button
          onClick={() => onShowAuth()}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Sign in and continue
        </button>
      </div>
    );
  }

  if (stage === 'payment') {
    return renderPaymentStep();
  }

  if (stage === 'submission') {
    return renderSubmissionStep();
  }

  return (
    <div
      id="referral-submit-flow"
      className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 space-y-5 lg:sticky lg:top-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300 mb-2">
            Refer Me Flow
          </p>
          <h3 className="text-white font-bold text-xl">Pay, add email, upload resume</h3>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            After payment, enter your email ID and upload your resume PDF so the admin can process your referral.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right min-w-[110px]">
          <div className="flex items-center justify-end gap-1 text-emerald-300 text-xs uppercase tracking-wide mb-1">
            <IndianRupee className="w-3.5 h-3.5" />
            Price
          </div>
          <p className="text-white text-2xl font-bold">{amountDisplay || '-'}</p>
        </div>
      </div>

      <div className="grid gap-3">
        {[
          '1. Pay the referral amount for this listing.',
          '2. Enter the email ID where you want referral updates.',
          '3. Upload your resume PDF and submit the request.',
        ].map((step) => (
          <div
            key={step}
            className="rounded-xl border border-slate-700/40 bg-slate-950/50 px-4 py-3 text-sm text-slate-300"
          >
            {step}
          </div>
        ))}
      </div>

      {paymentState === 'paid' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Payment received. Now enter your email ID and upload your resume PDF to finish the referral request.
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="Email ID for referral updates"
              className="w-full rounded-xl border border-slate-700/50 bg-slate-800/60 pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <label className="block rounded-xl border border-dashed border-slate-700/60 bg-slate-950/50 px-4 py-4 cursor-pointer hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-300 flex-shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium">
                  {resumeFile ? resumeFile.name : 'Upload PDF resume'}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  PDF only, maximum 5 MB.
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmitRequest}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting referral request...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Submit My Referral
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleStartPayment}
            disabled={paymentState === 'processing' || !paymentReady || amountPaise <= 0}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paymentState === 'processing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing payment...
              </>
            ) : !paymentReady ? (
              'Loading payment gateway...'
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Pay {'\u20B9'}{amountDisplay} to Refer Me
              </>
            )}
          </button>

          <p className="text-slate-500 text-xs leading-relaxed">
            The referral request is submitted only after payment, email confirmation, and PDF upload are completed.
          </p>
        </div>
      )}
    </div>
  );
};
