import React, { useEffect, useState } from 'react';
import { fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../../config/env';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Gift,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Shield,
  CheckCircle,
  Tag,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { sessionBookingService } from '../../services/sessionBookingService';
import { supabase } from '../../lib/supabaseClient';
import type { SessionService, BookingResult } from '../../types/session';
import {
  getSessionRegularPrice,
  hasSessionOffer,
  type SessionPromoValidationResult,
} from '../../utils/sessionPricing';

const SESSION_SCORE_CHECK_BONUS = 5;

interface SessionPaymentProps {
  service: SessionService;
  selectedDate: string;
  selectedSlot: string;
  onSuccess: (result: BookingResult) => void;
  onBack: () => void;
  onSlotTaken: () => void;
}

export const SessionPayment: React.FC<SessionPaymentProps> = ({
  service,
  selectedDate,
  selectedSlot,
  onSuccess,
  onBack,
  onSlotTaken,
}) => {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoFeedback, setPromoFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<SessionPromoValidationResult | null>(null);
  const [currentService, setCurrentService] = useState<SessionService>(service);

  const regularPrice = getSessionRegularPrice(currentService);
  const offerPrice = currentService.price;
  const payableAmount = appliedPromo?.finalAmount ?? offerPrice;
  const showOfferPricing = hasSessionOffer(currentService);
  const showPromoInput = offerPrice > 0 && currentService.promo_codes.length > 0;
  const isFreeSession = payableAmount === 0;
  const slotLabel = sessionBookingService.getSlotLabel(selectedSlot);

  const regularPriceInRupees = regularPrice / 100;
  const offerPriceInRupees = offerPrice / 100;
  const payableAmountInRupees = payableAmount / 100;
  const appliedPromoLabel = appliedPromo?.couponApplied
    ? `${appliedPromo.couponApplied} (${appliedPromo.discountPercentage}% off)`
    : null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  useEffect(() => {
    let mounted = true;

    const refreshService = async () => {
      const latest = await sessionBookingService.getActiveService();
      if (mounted && latest && latest.id === service.id) {
        setCurrentService(latest);
      }
    };

    refreshService();
    return () => {
      mounted = false;
    };
  }, [service.id]);

  const enrichBookingResultWithCredits = async (result: BookingResult): Promise<BookingResult> => {
    if (!result.booking_id) {
      return result;
    }

    const creditsResult = await sessionBookingService.grantSessionBookingCredits(result.booking_id);
    if (!creditsResult.success) {
      console.error('Failed to grant session score check credits:', creditsResult.error);
      return result;
    }

    return {
      ...result,
      score_check_credits: creditsResult.scoreCheckCredits,
    };
  };

  const sendClientConfirmationEmail = async (
    result: BookingResult,
    serviceToUse: SessionService
  ) => {
    if (!user) {
      return;
    }

    try {
      const { data, error: emailError } = await supabase.functions.invoke('send-session-booking-email', {
        body: {
          bookingId: result.booking_id || '',
          userId: user.id,
          recipientEmail: user.email,
          recipientName: user.name,
          recipientPhone: user.phone || '',
          serviceTitle: serviceToUse.title,
          bookingDate: formatDate(selectedDate),
          bookingDateIso: selectedDate,
          slotLabel,
          bookingCode: result.booking_code || '',
          bonusCredits: result.bonus_credits || 0,
          scoreCheckCredits: result.score_check_credits || 0,
          meetLink: serviceToUse.meet_link || '',
          sendClientConfirmation: true,
          sendMentorNotification: false,
          queueReminder: true,
        },
      });

      if (emailError || data?.results?.client === false) {
        console.error(
          'Failed to send booking confirmation email:',
          emailError || data?.error || 'Client confirmation email failed.',
        );
      }
    } catch (emailErr) {
      console.error('Failed to send booking confirmation email:', emailErr);
    }
  };

  const finalizeBooking = async (
    serviceToUse: SessionService,
    paymentTransactionId: string | null
  ) => {
    if (!user) {
      return;
    }

    const result = await sessionBookingService.bookSlot(
      user.id,
      serviceToUse.id,
      selectedDate,
      selectedSlot,
      paymentTransactionId,
      user.name,
      user.email,
      user.phone || ''
    );

    setProcessing(false);

    if (result.success) {
      const enrichedResult = await enrichBookingResultWithCredits(result);
      await sendClientConfirmationEmail(enrichedResult, serviceToUse);
      onSuccess(enrichedResult);
      return;
    }

    if (
      result.error?.includes('no longer available') ||
      result.error?.includes('already taken')
    ) {
      onSlotTaken();
      return;
    }

    setError(result.error || 'Booking failed. Please try again.');
  };

  const handleApplyPromo = async () => {
    if (!user) {
      setPromoFeedback({ type: 'error', message: 'Please sign in again to apply a promo code.' });
      return;
    }

    if (!promoCode.trim()) {
      setPromoFeedback({ type: 'error', message: 'Please enter a promo code.' });
      return;
    }

    setApplyingPromo(true);
    setPromoFeedback(null);
    setError(null);

    try {
      const latestService = await sessionBookingService.getActiveService();
      const serviceToUse =
        latestService && latestService.id === currentService.id ? latestService : currentService;

      if (serviceToUse.id !== currentService.id) {
        setPromoFeedback({ type: 'error', message: 'Service details changed. Please refresh the page.' });
        return;
      }

      setCurrentService(serviceToUse);

      const result = await sessionBookingService.applyPromoCode(
        serviceToUse.id,
        promoCode,
        user.id
      );

      if (!result.isValid) {
        setAppliedPromo(null);
        setPromoFeedback({ type: 'error', message: result.message });
        return;
      }

      setAppliedPromo(result);
      setPromoCode(result.couponApplied || promoCode.trim().toUpperCase());
      setPromoFeedback({
        type: 'success',
        message: `Coupon "${result.couponApplied || promoCode.trim().toUpperCase()}" applied. ${result.discountPercentage}% off.`,
      });
    } finally {
      setApplyingPromo(false);
    }
  };

  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoFeedback(null);
    setError(null);
  };

  const handleFreeBooking = async () => {
    if (!user) return;

    setProcessing(true);
    setError(null);

    try {
      await finalizeBooking(currentService, null);
    } catch (err: any) {
      console.error('Free booking error:', err);
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const handlePaidBooking = async () => {
    if (!user) return;

    setProcessing(true);
    setError(null);

    try {
      const latestService = await sessionBookingService.getActiveService();
      if (!latestService || latestService.id !== currentService.id) {
        setProcessing(false);
        setError('Service details changed. Please go back and re-open the booking.');
        return;
      }

      if (
        latestService.price !== currentService.price ||
        latestService.regular_price !== currentService.regular_price ||
        latestService.title !== currentService.title ||
        latestService.meet_link !== currentService.meet_link
      ) {
        setCurrentService(latestService);
      }

      const effectiveService = latestService;
      let promoToUse = appliedPromo;

      if (promoToUse?.couponApplied) {
        const refreshedPromo = await sessionBookingService.applyPromoCode(
          effectiveService.id,
          promoToUse.couponApplied,
          user.id
        );

        if (!refreshedPromo.isValid) {
          setAppliedPromo(null);
          setPromoFeedback({ type: 'error', message: refreshedPromo.message });
          setError('The promo code is no longer valid. Please review the price and try again.');
          setProcessing(false);
          return;
        }

        promoToUse = refreshedPromo;
        setAppliedPromo(refreshedPromo);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setError('Session expired. Please log in again.');
        setProcessing(false);
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
            amount: effectiveService.price,
            couponCode: promoToUse?.couponApplied || undefined,
            metadata: {
              type: 'session_booking',
              serviceId: effectiveService.id,
              serviceTitle: effectiveService.title,
            },
          }),
        }
      );

      const orderResult = await orderResponse.json();

      if (!orderResponse.ok) {
        setError(orderResult.error || 'Failed to create payment order.');
        setProcessing(false);
        return;
      }

      const { orderId, keyId, transactionId, amount: serverAmount, freeCheckout } = orderResult;
      const expectedAmount = promoToUse?.finalAmount ?? effectiveService.price;

      if (
        (promoToUse?.couponApplied && freeCheckout && expectedAmount > 0) ||
        (promoToUse?.couponApplied && !freeCheckout && Number(serverAmount) !== expectedAmount)
      ) {
        if (transactionId) {
          await sessionBookingService.updatePaymentTransaction(
            transactionId,
            '',
            orderId || '',
            'cancelled'
          );
        }

        setError(
          'Promo pricing is not updated on the server yet. Deploy the latest create-order and validate-coupon functions in Supabase, then try again.'
        );
        setProcessing(false);
        return;
      }

      if (freeCheckout) {
        await finalizeBooking(effectiveService, transactionId || null);
        return;
      }

      const options = {
        key: keyId,
        amount: serverAmount,
        currency: 'INR',
        name: 'PrimoBoost AI',
        description: effectiveService.title,
        order_id: orderId,
        handler: async (response: any) => {
          const updated = await sessionBookingService.updatePaymentTransaction(
            transactionId,
            response.razorpay_payment_id,
            response.razorpay_order_id || orderId,
            'success'
          );

          if (!updated) {
            setError('Payment recorded but booking failed. Contact support.');
            setProcessing(false);
            return;
          }

          await finalizeBooking(effectiveService, transactionId);
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            sessionBookingService.updatePaymentTransaction(
              transactionId,
              '',
              '',
              'cancelled'
            );
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('Payment error:', err);
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (offerPrice === 0 && !appliedPromo?.couponApplied) {
      handleFreeBooking();
      return;
    }

    handlePaidBooking();
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <button
        onClick={onBack}
        disabled={processing}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors disabled:opacity-40"
      >
        <ArrowLeft className="w-4 h-4" />
        Change slot
      </button>

      <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">
        {isFreeSession ? 'Confirm Booking' : 'Confirm & Pay'}
      </h2>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 mb-6 space-y-4">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Service</p>
          <p className="text-white font-medium">{currentService.title}</p>
        </div>

        <div className="flex gap-6">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Date</p>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">{formatDate(selectedDate)}</span>
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Time</p>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">{slotLabel}</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-amber-400">
            <Gift className="w-4 h-4" />
            <span className="text-sm font-medium">
              Bonus: +{currentService.bonus_credits} JD Credits + {SESSION_SCORE_CHECK_BONUS} Score Checks
            </span>
          </div>
        </div>
      </div>

      {showPromoInput && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 text-slate-200 font-medium mb-3">
            <Tag className="w-4 h-4 text-emerald-400" />
            <span>Apply Promo Code</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter promo code"
              disabled={processing || applyingPromo || Boolean(appliedPromo?.couponApplied)}
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-60"
            />
            {appliedPromo?.couponApplied ? (
              <button
                onClick={clearPromo}
                disabled={processing}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:border-slate-500 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={handleApplyPromo}
                disabled={processing || applyingPromo || !promoCode.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {applyingPromo ? 'Applying...' : 'Apply'}
              </button>
            )}
          </div>

          {promoFeedback && (
            <p
              className={`mt-3 text-sm ${
                promoFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-300'
              }`}
            >
              {promoFeedback.message}
            </p>
          )}

          {appliedPromo?.couponApplied && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-emerald-300/80">Applied Discount</p>
              <p className="text-sm font-medium text-emerald-300">
                {appliedPromo.discountPercentage}% off on the offer price
              </p>
            </div>
          )}
        </div>
      )}

      <div
        className={`border rounded-xl p-5 mb-6 ${
          isFreeSession
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-emerald-500/5 border-emerald-500/20'
        }`}
      >
        <div className="space-y-3">
          {showOfferPricing && (
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Regular Price</span>
              <span className="line-through">{'\u20B9'}{regularPriceInRupees.toLocaleString('en-IN')}</span>
            </div>
          )}

          {(showOfferPricing || appliedPromo?.couponApplied) && (
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Offer Price</span>
              <span>{'\u20B9'}{offerPriceInRupees.toLocaleString('en-IN')}</span>
            </div>
          )}

          {appliedPromo?.couponApplied && (
            <div className="flex items-center justify-between text-sm text-emerald-300">
              <span>Promo {appliedPromoLabel}</span>
              <span>-{'\u20B9'}{(appliedPromo.discountAmount / 100).toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
            <span className="text-slate-300 font-medium">Total Amount</span>
            {isFreeSession ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-2xl font-bold text-emerald-400">FREE</span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-white">
                {'\u20B9'}{payableAmountInRupees.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <motion.button
        onClick={handleConfirm}
        disabled={processing}
        whileHover={!processing ? { scale: 1.02 } : {}}
        whileTap={!processing ? { scale: 0.98 } : {}}
        className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-lg disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isFreeSession ? 'Booking...' : 'Processing...'}
          </>
        ) : isFreeSession ? (
          'Confirm Free Booking'
        ) : (
          <>
            Pay Now {'\u20B9'}{payableAmountInRupees.toLocaleString('en-IN')}
          </>
        )}
      </motion.button>

      {!isFreeSession && (
        <div className="flex items-center justify-center gap-1.5 mt-4 text-slate-500 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured by Razorpay</span>
        </div>
      )}
    </div>
  );
};
