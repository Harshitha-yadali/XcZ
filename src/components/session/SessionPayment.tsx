import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { sessionBookingService } from '../../services/sessionBookingService';
import { supabase } from '../../lib/supabaseClient';
import type { SessionService, BookingResult } from '../../types/session';

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
  const [error, setError] = useState<string | null>(null);
  const [currentService, setCurrentService] = useState<SessionService>(service);

  const priceInRupees = currentService.price / 100;
  const isFreeSession = currentService.price === 0;
  const slotLabel = sessionBookingService.getSlotLabel(selectedSlot);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Always refresh latest service/price when component mounts or when service id changes
  React.useEffect(() => {
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

  const handleFreeBooking = async () => {
    if (!user) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await sessionBookingService.bookSlot(
        user.id,
        currentService.id,
        selectedDate,
        selectedSlot,
        null,
        user.name,
        user.email,
        ''
      );

      setProcessing(false);

      if (result.success) {
        try {
          await supabase.functions.invoke('send-session-booking-email', {
            body: {
              bookingId: result.booking_id || '',
              recipientEmail: user.email,
              recipientName: user.name,
              serviceTitle: currentService.title,
              bookingDate: formatDate(selectedDate),
              slotLabel,
              bookingCode: result.booking_code || '',
              bonusCredits: result.bonus_credits || 0,
              meetLink: currentService.meet_link || '',
            },
          });
        } catch (emailErr) {
          console.error('Failed to send booking confirmation email:', emailErr);
        }
        onSuccess(result);
      } else if (
        result.error?.includes('no longer available') ||
        result.error?.includes('already taken')
      ) {
        onSlotTaken();
      } else {
        setError(result.error || 'Booking failed. Please try again.');
      }
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
      // Guard against stale price — fetch latest service data before creating order
      const latestService = await sessionBookingService.getActiveService();
      if (!latestService || latestService.id !== currentService.id) {
        setProcessing(false);
        setError('Service details changed. Please go back and re-open the booking.');
        return;
      }
      if (latestService.price !== currentService.price) {
        setProcessing(false);
        setError('Price mismatch detected. Please refresh and try again.');
        return;
      }
      // Update local copy so UI reflects latest price/title
      setCurrentService(latestService);

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
            amount: latestService.price,
            metadata: {
              type: 'session_booking',
              serviceId: latestService.id,
              serviceTitle: latestService.title,
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

      const { orderId, keyId, transactionId, amount: serverAmount } = orderResult;

      const options = {
        key: keyId,
        amount: serverAmount,
        currency: 'INR',
        name: 'PrimoBoost AI',
        description: latestService.title,
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

          const result = await sessionBookingService.bookSlot(
            user.id,
            latestService.id,
            selectedDate,
            selectedSlot,
            transactionId,
            user.name,
            user.email,
            ''
          );

          setProcessing(false);

          if (result.success) {
            try {
              await supabase.functions.invoke('send-session-booking-email', {
                body: {
                  bookingId: result.booking_id || '',
                  recipientEmail: user.email,
                  recipientName: user.name,
                  serviceTitle: latestService.title,
                  bookingDate: formatDate(selectedDate),
                  slotLabel,
                  bookingCode: result.booking_code || '',
                  bonusCredits: result.bonus_credits || 0,
                  meetLink: latestService.meet_link || '',
                },
              });
            } catch (emailErr) {
              console.error('Failed to send booking confirmation email:', emailErr);
            }
            onSuccess(result);
          } else if (
            result.error?.includes('no longer available') ||
            result.error?.includes('already taken')
          ) {
            onSlotTaken();
          } else {
            setError(result.error || 'Booking failed. Please try again.');
          }
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
    if (isFreeSession) {
      handleFreeBooking();
    } else {
      handlePaidBooking();
    }
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

      {/* Summary Card */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 mb-6 space-y-4">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Service</p>
          <p className="text-white font-medium">{service.title}</p>
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
              Bonus: +{service.bonus_credits} JD Optimization Credits
            </span>
          </div>
        </div>
      </div>

      {/* Amount */}
      <div className={`border rounded-xl p-5 mb-6 ${
        isFreeSession
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-emerald-500/5 border-emerald-500/20'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-medium">Total Amount</span>
          {isFreeSession ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">FREE</span>
            </div>
          ) : (
            <span className="text-2xl font-bold text-white">
              {'\u20B9'}{priceInRupees.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Confirm / Pay Button */}
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
          'Confirm Booking'
        ) : (
          <>
            Pay Now {'\u20B9'}{priceInRupees.toLocaleString('en-IN')}
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
