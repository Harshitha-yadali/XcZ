import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Star,
  Zap,
  Crown,
  Clock,
  X,
  Tag,
  ArrowRight,
  Info,
  Target,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Wallet,
  TrendingUp,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import type { PlanCategory } from '../../types/payment';

interface SubscriptionPlansProps {
  isOpen: boolean;
  onNavigateBack: () => void;
  onSubscriptionSuccess: () => void;
  onShowAlert: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', actionText?: string, onAction?: () => void) => void;
  initialExpandAddons?: boolean;
}

type AppliedCoupon = {
  code: string;
  discount: number;
  finalAmount: number;
};

const CATEGORY_CONFIG: { key: PlanCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'combined', label: 'Combined Premium', icon: <Crown className="w-3.5 h-3.5" /> },
  { key: 'jd_only', label: 'JD Optimizer', icon: <Target className="w-3.5 h-3.5" /> },
  { key: 'score_only', label: 'Score Checker', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'combo', label: 'JD + Score', icon: <Layers className="w-3.5 h-3.5" /> },
];

const getPlanIcon = (iconType: string) => {
  switch (iconType) {
    case 'crown': return <Crown className="w-6 h-6" />;
    case 'zap': return <Zap className="w-6 h-6" />;
    case 'target': return <Target className="w-6 h-6" />;
    case 'check_circle': return <CheckCircle className="w-6 h-6" />;
    case 'briefcase': return <Briefcase className="w-6 h-6" />;
    default: return <Star className="w-6 h-6" />;
  }
};

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({
  isOpen,
  onNavigateBack,
  onSubscriptionSuccess,
  onShowAlert,
}) => {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<PlanCategory>('combined');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWalletBalance, setUseWalletBalance] = useState<boolean>(false);
  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);
  const [mobileSlide, setMobileSlide] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const categoryPlans = paymentService.getPlansByCategory(activeCategory);

  useEffect(() => {
    if (user && isOpen) fetchWalletBalance();
  }, [user, isOpen]);

  useEffect(() => {
    setSelectedPlan(null);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setMobileSlide(0);
  }, [activeCategory]);

  const fetchWalletBalance = async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('amount, status')
        .eq('user_id', user.id);
      if (error) return;
      const completed = (transactions || []).filter((t: any) => t.status === 'completed');
      const balance = completed.reduce((sum: number, tr: any) => sum + parseFloat(tr.amount), 0) * 100;
      setWalletBalance(Math.max(0, balance));
    } catch {} finally {
      setLoadingWallet(false);
    }
  };

  if (!isOpen) return null;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      onShowAlert('Coupon Error', 'Please enter a coupon code.', 'warning');
      return;
    }
    if (!user) {
      onShowAlert('Authentication Required', 'Please sign in to apply coupon.', 'error', 'Sign In', () => {});
      return;
    }
    const result = await paymentService.applyCoupon(selectedPlan, couponCode.trim(), user.id);
    if (result.isValid) {
      setAppliedCoupon({ code: result.couponApplied!, discount: result.discountAmount, finalAmount: result.finalAmount });
      setCouponError('');
      onShowAlert('Coupon Applied!', result.message, 'success');
    } else {
      setCouponError(result.message);
      setAppliedCoupon(null);
      onShowAlert('Coupon Error', result.message, 'warning');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const selectedPlanData = paymentService.getPlanById(selectedPlan || '');

  let planPrice = (selectedPlanData?.price || 0) * 100;
  if (appliedCoupon) planPrice = appliedCoupon.finalAmount;

  const walletDeduction = useWalletBalance ? Math.min(walletBalance, planPrice) : 0;
  const finalPlanPrice = Math.max(0, planPrice - walletDeduction);
  const grandTotal = finalPlanPrice;

  const handlePayment = async () => {
    if (!user || !selectedPlanData) return;
    setIsProcessing(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.access_token) {
        onShowAlert('Authentication Required', 'Please log in to complete your purchase.', 'error', 'Sign In', () => {});
        setIsProcessing(false);
        return;
      }
      const accessToken = session.access_token;
      if (grandTotal === 0) {
        const result = await paymentService.processFreeSubscription(selectedPlan, user.id, appliedCoupon ? appliedCoupon.code : undefined, 0, {}, selectedPlanData.price * 100, walletDeduction);
        if (result.success) { await fetchWalletBalance(); onSubscriptionSuccess(); onShowAlert('Subscription Activated!', 'Your plan has been activated successfully.', 'success'); }
        else { onShowAlert('Activation Failed', result.error || 'Failed to activate plan.', 'error'); }
      } else {
        const paymentData = { planId: selectedPlan, amount: grandTotal, currency: 'INR' };
        const result = await paymentService.processPayment(paymentData, user.email, user.name, accessToken, appliedCoupon ? appliedCoupon.code : undefined, walletDeduction, 0, {});
        if (result.success) { await fetchWalletBalance(); onSubscriptionSuccess(); onShowAlert('Payment Successful!', 'Your subscription has been activated.', 'success'); }
        else {
          if (result.error?.includes('Payment cancelled by user')) onShowAlert('Payment Cancelled', 'You have cancelled the payment.', 'info');
          else onShowAlert('Payment Failed', result.error || 'Payment processing failed.', 'error');
        }
      }
    } catch (error) {
      onShowAlert('Payment Error', error instanceof Error ? error.message : 'An unexpected error occurred.', 'error');
    } finally { setIsProcessing(false); }
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setTimeout(() => { document.getElementById('pay-now-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
  };

  const handleSwipe = (startX: number, endX: number) => {
    const diff = startX - endX;
    const threshold = 50;
    if (diff > threshold && mobileSlide < categoryPlans.length - 1) setMobileSlide(prev => prev + 1);
    else if (diff < -threshold && mobileSlide > 0) setMobileSlide(prev => prev - 1);
  };

  const renderPlanCard = (plan: typeof categoryPlans[0], index: number) => {
    const isSelected = selectedPlan === plan.id;
    return (
      <div
        key={plan.id}
        onClick={() => handleSelectPlan(plan.id)}
        className={`relative rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden backdrop-blur-md ${
          isSelected
            ? 'border-emerald-400/60 bg-white/[0.08] shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.02]'
            : plan.popular
              ? 'border-emerald-400/30 bg-white/[0.06] hover:border-emerald-400/50 hover:shadow-lg'
              : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.15] hover:bg-white/[0.06]'
        }`}
      >
        {plan.popular && (
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-1 rounded-b-lg text-xs font-bold flex items-center gap-1 shadow-lg">
              <Crown className="w-3 h-3" />
              MOST POPULAR
            </div>
          </div>
        )}
        <div className="p-5 pt-6">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
            plan.popular
              ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-white/[0.08] text-slate-300 border border-white/[0.1]'
          }`}>
            {getPlanIcon(plan.icon)}
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-500 line-through text-sm">&#8377;{plan.mrp}</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-bold">
                {plan.discountPercentage}% OFF
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">&#8377;{plan.price}</span>
              <span className="text-slate-500 text-sm">one-time</span>
            </div>
          </div>
          <div className="space-y-2 mb-5">
            {plan.features.map((feature, fi) => (
              <div key={fi} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan.id); }}
            className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
              isSelected
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : plan.popular
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400'
                  : 'bg-white/[0.08] text-slate-200 hover:bg-white/[0.12] border border-white/[0.1]'
            }`}
          >
            {isSelected ? 'Selected' : 'Select Plan'}
          </button>
        </div>
        {isSelected && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 lg:left-16 bg-gradient-to-b from-slate-900 via-slate-950 to-[#070b14] flex items-start justify-center z-50 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={onNavigateBack}
          className="fixed top-4 right-4 lg:right-8 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors rounded-full bg-white/[0.06] hover:bg-white/[0.1] backdrop-blur-xl z-50 border border-white/[0.1]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Success Plan</span>
          </h1>
          <p className="text-slate-400 text-sm">Select a category, then pick the plan that fits your needs</p>
        </div>

        {/* Category Selector - Horizontal scroll on mobile, grid on desktop */}
        <div className="lg:hidden mb-6">
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_CONFIG.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all duration-300 text-[13px] font-medium ${
                  activeCategory === cat.key
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'border-slate-500/30 bg-slate-700/40 text-slate-300'
                }`}
                style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-4 gap-3 mb-8">
          {CATEGORY_CONFIG.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`relative p-4 rounded-xl border backdrop-blur-xl transition-all duration-300 text-left ${
                activeCategory === cat.key
                  ? 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.15] hover:bg-white/[0.06]'
              }`}
            >
              <div className={`flex items-center gap-2 mb-1 ${activeCategory === cat.key ? 'text-emerald-400' : 'text-slate-400'}`}>
                {cat.icon}
                <span className="text-sm font-semibold">{cat.label}</span>
              </div>
              {activeCategory === cat.key && (
                <motion.div layoutId="catInd" className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Plans - Desktop Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {/* Desktop grid */}
            <div className={`hidden sm:grid gap-4 mb-8 ${
              categoryPlans.length <= 2
                ? 'grid-cols-2 max-w-2xl mx-auto'
                : categoryPlans.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-2 lg:grid-cols-4'
            }`}>
              {categoryPlans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  {renderPlanCard(plan, index)}
                </motion.div>
              ))}
            </div>

            {/* Mobile carousel */}
            <div className="sm:hidden relative mb-8">
              <div
                className="overflow-hidden touch-pan-y"
                onTouchStart={(e) => { setDragStart(e.touches[0].clientX); setIsDragging(true); }}
                onTouchEnd={(e) => {
                  if (!isDragging || dragStart === null) return;
                  handleSwipe(dragStart, e.changedTouches[0].clientX);
                  setDragStart(null); setIsDragging(false);
                }}
              >
                <motion.div
                  className="flex"
                  animate={{ x: `-${mobileSlide * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  {categoryPlans.map((plan, index) => (
                    <div key={plan.id} className="w-full flex-shrink-0 px-1">
                      {renderPlanCard(plan, index)}
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Carousel nav arrows */}
              {categoryPlans.length > 1 && (
                <>
                  <button
                    onClick={() => setMobileSlide(prev => Math.max(0, prev - 1))}
                    disabled={mobileSlide === 0}
                    className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all z-10 ${
                      mobileSlide === 0
                        ? 'bg-white/[0.04] border-white/[0.06] text-slate-600 cursor-not-allowed'
                        : 'bg-white/[0.08] border-white/[0.12] text-white hover:bg-white/[0.15]'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setMobileSlide(prev => Math.min(categoryPlans.length - 1, prev + 1))}
                    disabled={mobileSlide === categoryPlans.length - 1}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all z-10 ${
                      mobileSlide === categoryPlans.length - 1
                        ? 'bg-white/[0.04] border-white/[0.06] text-slate-600 cursor-not-allowed'
                        : 'bg-white/[0.08] border-white/[0.12] text-white hover:bg-white/[0.15]'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Dots */}
              {categoryPlans.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  {categoryPlans.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setMobileSlide(i)}
                      className={`transition-all duration-300 rounded-full ${
                        mobileSlide === i
                          ? 'w-8 h-2 bg-gradient-to-r from-emerald-400 to-cyan-400'
                          : 'w-2 h-2 bg-white/[0.15] hover:bg-white/[0.25]'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-xs text-slate-500">{mobileSlide + 1}/{categoryPlans.length}</span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Checkout Section */}
        {selectedPlan && selectedPlanData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 max-w-2xl mx-auto">
            <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4 flex items-center justify-between backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-slate-200 text-sm">
                  Selected: <span className="font-semibold text-emerald-400">{selectedPlanData.name}</span> - &#8377;{selectedPlanData.price}
                </span>
              </div>
              <button onClick={() => setSelectedPlan(null)} className="text-slate-400 hover:text-slate-200 text-sm">Change</button>
            </div>

            <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-5 backdrop-blur-xl">
              <h2 className="text-base font-bold text-white mb-3 flex items-center">
                <Tag className="w-4 h-4 mr-2 text-amber-400" />Apply Coupon Code
              </h2>
              <div className="flex gap-3">
                <input type="text" placeholder="Enter coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/50 text-sm backdrop-blur-sm"
                  disabled={!!appliedCoupon} />
                {!appliedCoupon ? (
                  <button onClick={handleApplyCoupon} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium text-sm disabled:opacity-50" disabled={!couponCode.trim()}>Apply</button>
                ) : (
                  <button onClick={handleRemoveCoupon} className="px-5 py-2.5 bg-white/[0.08] text-slate-200 rounded-lg font-medium text-sm hover:bg-white/[0.12]">Remove</button>
                )}
              </div>
              {couponError && <p className="text-red-400 text-sm mt-2 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{couponError}</p>}
              {appliedCoupon && (
                <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-lg p-3 mt-3">
                  <p className="text-emerald-300 font-semibold flex items-center text-sm"><CheckCircle className="w-4 h-4 mr-2" />Coupon "{appliedCoupon.code.toUpperCase()}" applied!</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-slate-400 text-sm">You saved:</span>
                    <span className="text-lg font-bold text-emerald-400">&#8377;{(appliedCoupon.discount / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-5 backdrop-blur-xl">
              <h2 className="text-base font-bold text-white mb-3 flex items-center">
                <Wallet className="w-4 h-4 mr-2 text-emerald-400" />Wallet Balance
              </h2>
              {loadingWallet ? <div className="text-slate-400 text-sm">Loading wallet...</div> : (
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-white">&#8377;{(walletBalance / 100).toFixed(2)}</span>
                  {walletBalance > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={useWalletBalance} onChange={(e) => setUseWalletBalance(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-emerald-500 rounded bg-slate-800 border-slate-600 focus:ring-emerald-500" />
                      <span className="text-slate-300 text-sm">Use wallet balance</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-5 backdrop-blur-xl">
              <h2 className="text-base font-bold text-white mb-3 flex items-center">
                <Info className="w-4 h-4 mr-2 text-blue-400" />Order Summary
              </h2>
              <div className="space-y-2.5 text-slate-300 text-sm">
                <div className="flex justify-between"><span>Plan Price:</span><span>&#8377;{selectedPlanData.price.toFixed(2)}</span></div>
                {appliedCoupon && <div className="flex justify-between text-emerald-400"><span>Coupon Discount:</span><span>- &#8377;{(appliedCoupon.discount / 100).toFixed(2)}</span></div>}
                {useWalletBalance && walletDeduction > 0 && <div className="flex justify-between text-amber-400"><span>Wallet Deduction:</span><span>- &#8377;{(walletDeduction / 100).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-lg text-white border-t border-white/[0.08] pt-3 mt-3">
                  <span>Grand Total:</span><span className="text-emerald-400">&#8377;{(grandTotal / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button id="pay-now-btn" onClick={handlePayment} disabled={isProcessing}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-base font-semibold rounded-xl hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/25 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50">
              {isProcessing ? <><Clock className="w-5 h-5 animate-spin" /> Processing...</> : <>Proceed to Checkout <ArrowRight className="w-5 h-5" /></>}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
