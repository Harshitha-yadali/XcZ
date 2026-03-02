import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle,
  User,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { referralService } from '../../services/referralService';
import { RAZORPAY_CONFIG } from '../../utils/razorpayConfig';
import type { ReferralSlotDisplayInfo, ReferralSlotType, ReferralPricing } from '../../types/referral';

interface SlotBookingPanelProps {
  listingId: string;
  slotType: ReferralSlotType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  onShowAuth: (callback?: () => void) => void;
  listingQueryPrice?: number | null;
  listingProfilePrice?: number | null;
  listingSlotPrice?: number | null;
}

const getSlotPrice = (
  pricing: ReferralPricing,
  slotType: ReferralSlotType,
  listingPrices?: { query?: number | null; profile?: number | null; slot?: number | null }
): number => {
  switch (slotType) {
    case 'query': return listingPrices?.query ?? pricing.query_price;
    case 'profile': return listingPrices?.profile ?? pricing.profile_price;
    case 'consultation': return listingPrices?.slot ?? pricing.slot_price;
    default: return listingPrices?.slot ?? pricing.slot_price;
  }
};

export const SlotBookingPanel: React.FC<SlotBookingPanelProps> = ({
  listingId,
  slotType,
  title,
  subtitle,
  icon,
  accentColor,
  onShowAuth,
  listingQueryPrice,
  listingProfilePrice,
  listingSlotPrice,
}) => {
  const listingPrices = { query: listingQueryPrice, profile: listingProfilePrice, slot: listingSlotPrice };
  const { isAuthenticated, user } = useAuth();
  const [pricing, setPricing] = useState<ReferralPricing | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<ReferralSlotDisplayInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookingForm, setBookingForm] = useState({ name: '', email: '', phone: '' });
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [razorpayReady, setRazorpayReady] = useState(false);

  useEffect(() => {
    referralService.getPricing().then(setPricing);
  }, []);

  useEffect(() => {
    const loadRazorpay = () => {
      if ((window as any).Razorpay) {
        setRazorpayReady(true);
        return;
      }

      const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => setRazorpayReady(true), { once: true });
        existingScript.addEventListener('error', () => setRazorpayReady(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayReady(true);
      script.onerror = () => {
        setRazorpayReady(false);
        setErrorMessage('Unable to load payment gateway. Please refresh and try again.');
      };
      document.head.appendChild(script);
    };

    loadRazorpay();
  }, []);

  useEffect(() => {
    if (user) {
      setBookingForm({
        name: user.name || '',
        email: user.email || '',
        phone: '',
      });
    }
  }, [user]);

  const loadSlots = async (date: string) => {
    setSlotsLoading(true);
    const slotsData = await referralService.getSlotsForDate(listingId, date, slotType);
    setSlots(slotsData);
    setSlotsLoading(false);
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setErrorMessage('');
    loadSlots(dateStr);
  };

  const openRazorpay = (amountPaise: number): Promise<{ success: boolean; paymentId?: string; error?: string }> => {
    return new Promise((resolve) => {
      if (!(window as any).Razorpay) {
        resolve({ success: false, error: 'Payment gateway is still loading. Please try again.' });
        return;
      }

      const options = {
        key: RAZORPAY_CONFIG.KEY_ID,
        amount: amountPaise,
        currency: RAZORPAY_CONFIG.CURRENCY,
        name: RAZORPAY_CONFIG.COMPANY_NAME,
        description: `${title} - Slot Booking`,
        prefill: {
          name: bookingForm.name,
          email: bookingForm.email,
          contact: bookingForm.phone || undefined,
        },
        theme: { color: RAZORPAY_CONFIG.THEME_COLOR },
        handler: (response: { razorpay_payment_id: string }) => {
          resolve({ success: true, paymentId: response.razorpay_payment_id });
        },
        modal: {
          ondismiss: () => {
            resolve({ success: false, error: 'Payment cancelled.' });
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        resolve({ success: false, error: response.error?.description || 'Payment failed.' });
      });
      rzp.open();
    });
  };

  const handleBookSlot = async () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    if (!user?.id || !selectedDate || !selectedSlot || !pricing) return;
    if (!bookingForm.name || !bookingForm.email) {
      setErrorMessage('Name and email are required.');
      return;
    }

    setBookingStatus('processing');
    setErrorMessage('');

    const amountPaise = getSlotPrice(pricing, slotType, listingPrices);

    let paymentId: string | null = null;

    if (amountPaise > 0) {
      if (!razorpayReady) {
        setBookingStatus('idle');
        setErrorMessage('Payment gateway is not ready yet. Please wait a moment and try again.');
        return;
      }

      const paymentResult = await openRazorpay(amountPaise);
      if (!paymentResult.success) {
        setBookingStatus('idle');
        setErrorMessage(paymentResult.error || 'Payment was not completed.');
        return;
      }
      paymentId = paymentResult.paymentId || null;
    }

    const result = await referralService.bookSlot(
      user.id,
      listingId,
      selectedDate,
      selectedSlot,
      slotType,
      paymentId,
      bookingForm.name,
      bookingForm.email,
      bookingForm.phone
    );

    if (result.success) {
      setBookingStatus('success');
      loadSlots(selectedDate);
    } else {
      setBookingStatus('error');
      setErrorMessage(result.error || 'Booking failed.');
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  };

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const priceDisplay = pricing ? getSlotPrice(pricing, slotType, listingPrices) / 100 : 0;

  if (bookingStatus === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-white font-bold text-xl mb-2">Slot Booked!</h3>
        <p className="text-slate-400 text-sm mb-2">
          Your {title.toLowerCase()} session has been confirmed.
        </p>
        <p className="text-slate-500 text-xs mb-4">
          We will connect you for the call at your scheduled time.
        </p>
        <button
          onClick={() => {
            setBookingStatus('idle');
            setSelectedSlot(null);
          }}
          className="px-6 py-2.5 bg-slate-800/60 border border-slate-700/40 text-white rounded-xl text-sm hover:bg-slate-700/60 transition-colors"
        >
          Book Another Slot
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${accentColor} flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <h3 className="text-white font-bold">{title}</h3>
            <p className="text-slate-400 text-xs">{subtitle}</p>
          </div>
        </div>
        {pricing && priceDisplay > 0 && (
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-sm">{priceDisplay}</span>
            <span className="text-slate-500 text-xs">/slot</span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white font-medium text-sm">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-center text-slate-500 text-xs py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateObj = new Date(year, month, day);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast = dateObj < today;
              const isSelected = selectedDate === dateStr;
              const isToday = dateObj.getTime() === today.getTime();

              return (
                <button
                  key={day}
                  disabled={isPast}
                  onClick={() => handleDateSelect(dateStr)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                    isPast
                      ? 'text-slate-700 cursor-not-allowed'
                      : isSelected
                      ? 'bg-emerald-500 text-white'
                      : isToday
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {!selectedDate ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Select a date to view available slots
            </div>
          ) : slotsLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div>
              <p className="text-slate-400 text-sm mb-3">
                Available slots for{' '}
                <span className="text-white font-medium">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </p>
              <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
                {slots.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">No slots available for this date</p>
                ) : slots.map((slot) => (
                  <button
                    key={slot.time_slot}
                    disabled={slot.status === 'booked' || slot.status === 'blocked'}
                    onClick={() => setSelectedSlot(slot.time_slot)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      slot.status === 'booked'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed'
                        : slot.status === 'blocked'
                        ? 'bg-slate-800/60 text-slate-600 cursor-not-allowed'
                        : selectedSlot === slot.time_slot
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800/40 text-slate-300 border border-slate-700/40 hover:border-emerald-500/30'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {slot.label}
                    </span>
                    <span className="text-xs">
                      {slot.status === 'booked' ? 'Booked' : slot.status === 'blocked' ? 'Unavailable' : 'Available'}
                    </span>
                  </button>
                ))}
              </div>

              {selectedSlot && (
                <div className="space-y-3 border-t border-slate-700/40 pt-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={bookingForm.name}
                      onChange={(e) => setBookingForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      placeholder="Your Email"
                      value={bookingForm.email}
                      onChange={(e) => setBookingForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="tel"
                      placeholder="Phone (optional)"
                      value={bookingForm.phone}
                      onChange={(e) => setBookingForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  {errorMessage && (
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errorMessage}
                    </div>
                  )}

                  <button
                    onClick={handleBookSlot}
                    disabled={bookingStatus === 'processing' || (priceDisplay > 0 && !razorpayReady)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bookingStatus === 'processing' ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : priceDisplay > 0 && !razorpayReady ? (
                      'Loading payment gateway...'
                    ) : (
                      <>
                        <Calendar className="w-4 h-4" />
                        {pricing && priceDisplay > 0
                          ? `Pay \u20B9${priceDisplay} & Confirm`
                          : 'Confirm Slot'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
