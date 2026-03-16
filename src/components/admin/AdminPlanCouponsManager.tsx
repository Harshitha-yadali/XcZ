import React, { useEffect, useState } from 'react';
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  TicketPercent,
  Trash2,
  X,
} from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { pricingPlanCouponService } from '../../services/pricingPlanCouponService';
import type { PricingPlanCoupon, PricingPlanCouponInput } from '../../types/pricingCoupon';

type CouponFormState = PricingPlanCouponInput & {
  appliesToAllPlans: boolean;
};

const createEmptyForm = (): CouponFormState => ({
  code: '',
  description: '',
  discountPercentage: 10,
  applicablePlanIds: [],
  isActive: true,
  appliesToAllPlans: true,
});

export const AdminPlanCouponsManager: React.FC = () => {
  const availablePlans = paymentService.getPlans();
  const optimizationPlanIds = availablePlans
    .filter((plan) => Number(plan.optimizations || 0) > 0)
    .map((plan) => plan.id);
  const [coupons, setCoupons] = useState<PricingPlanCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(createEmptyForm());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    void loadCoupons();
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingId(null);
  };

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const rows = await pricingPlanCouponService.listCoupons();
      setCoupons(rows);
      setFeedback(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load coupons.';
      showFeedback('error', message);
    } finally {
      setLoading(false);
    }
  };

  const buildInputFromForm = (): PricingPlanCouponInput => ({
    code: form.code.trim().toUpperCase(),
    description: form.description.trim(),
    discountPercentage: Math.round(Number(form.discountPercentage || 0)),
    applicablePlanIds: form.appliesToAllPlans ? [] : form.applicablePlanIds,
    isActive: form.isActive,
  });

  const handleSubmit = async () => {
    const input = buildInputFromForm();

    if (!input.code) {
      showFeedback('error', 'Coupon code is required.');
      return;
    }

    if (!input.discountPercentage || input.discountPercentage < 1 || input.discountPercentage > 100) {
      showFeedback('error', 'Discount percentage must be between 1 and 100.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const updatedCoupon = await pricingPlanCouponService.updateCoupon(editingId, input);
        setCoupons((currentCoupons) =>
          currentCoupons.map((coupon) => (coupon.id === updatedCoupon.id ? updatedCoupon : coupon)),
        );
        showFeedback('success', `Coupon ${updatedCoupon.code} updated.`);
      } else {
        const createdCoupon = await pricingPlanCouponService.createCoupon(input);
        setCoupons((currentCoupons) => [createdCoupon, ...currentCoupons]);
        showFeedback('success', `Coupon ${createdCoupon.code} created.`);
      }

      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save coupon.';
      showFeedback('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (coupon: PricingPlanCoupon) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description,
      discountPercentage: coupon.discountPercentage,
      applicablePlanIds: coupon.applicablePlanIds,
      isActive: coupon.isActive,
      appliesToAllPlans: coupon.applicablePlanIds.length === 0,
    });
    setFeedback(null);
  };

  const handleDelete = async (coupon: PricingPlanCoupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) {
      return;
    }

    setSubmitting(true);
    try {
      await pricingPlanCouponService.deleteCoupon(coupon.id);
      setCoupons((currentCoupons) => currentCoupons.filter((currentCoupon) => currentCoupon.id !== coupon.id));
      if (editingId === coupon.id) {
        resetForm();
      }
      showFeedback('success', `Coupon ${coupon.code} deleted.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete coupon.';
      showFeedback('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (coupon: PricingPlanCoupon) => {
    setSubmitting(true);
    try {
      const updatedCoupon = await pricingPlanCouponService.updateCoupon(coupon.id, {
        code: coupon.code,
        description: coupon.description,
        discountPercentage: coupon.discountPercentage,
        applicablePlanIds: coupon.applicablePlanIds,
        isActive: !coupon.isActive,
      });

      setCoupons((currentCoupons) =>
        currentCoupons.map((currentCoupon) => (currentCoupon.id === updatedCoupon.id ? updatedCoupon : currentCoupon)),
      );

      if (editingId === coupon.id) {
        setForm((currentForm) => ({
          ...currentForm,
          isActive: updatedCoupon.isActive,
        }));
      }

      showFeedback(
        'success',
        `Coupon ${updatedCoupon.code} ${updatedCoupon.isActive ? 'activated' : 'deactivated'}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update coupon.';
      showFeedback('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePlanSelection = (planId: string) => {
    setForm((currentForm) => {
      const nextPlanIds = currentForm.applicablePlanIds.includes(planId)
        ? currentForm.applicablePlanIds.filter((currentPlanId) => currentPlanId !== planId)
        : [...currentForm.applicablePlanIds, planId];

      return {
        ...currentForm,
        applicablePlanIds: nextPlanIds,
      };
    });
  };

  const selectOptimizationPlans = () => {
    setForm((currentForm) => ({
      ...currentForm,
      appliesToAllPlans: false,
      applicablePlanIds: optimizationPlanIds,
    }));
  };

  const getPlanSummary = (coupon: PricingPlanCoupon) => {
    if (coupon.applicablePlanIds.length === 0) {
      return 'All pricing plans';
    }

    const matchedPlans = availablePlans
      .filter((plan) => coupon.applicablePlanIds.includes(plan.id))
      .map((plan) => plan.name);

    return matchedPlans.length > 0 ? matchedPlans.join(', ') : 'Specific plans';
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/30 dark:bg-blue-500/10">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-300" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Server-enforced usage</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Every pricing-plan coupon is validated on the backend. A coupon can be used only one time per account.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit Pricing Coupon' : 'Create Pricing Coupon'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Assign a code, a discount, and the plans it applies to.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-dark-300 dark:text-slate-200 dark:hover:bg-dark-200"
              >
                <X className="h-4 w-4" />
                Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Coupon Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm uppercase text-slate-900 focus:border-blue-500 focus:outline-none dark:border-dark-300 dark:bg-dark-200 dark:text-slate-100"
                  placeholder="SAVE50"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Discount %</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.discountPercentage}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      discountPercentage: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-dark-300 dark:bg-dark-200 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    description: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-dark-300 dark:bg-dark-200 dark:text-slate-100"
                placeholder="Summer campaign for premium plans"
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-dark-300">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Applicable Plans</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Leave this on to make the coupon valid for every pricing plan.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.appliesToAllPlans}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        appliesToAllPlans: event.target.checked,
                        applicablePlanIds: event.target.checked ? [] : currentForm.applicablePlanIds,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  All pricing plans
                </label>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectOptimizationPlans}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  >
                    Select All Optimization Plans
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Includes Career, JD, and Combo plans with optimization credits.
                  </p>
                </div>

                {!form.appliesToAllPlans && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {availablePlans.map((plan) => (
                    <label
                      key={plan.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm dark:border-dark-300"
                    >
                      <input
                        type="checkbox"
                        checked={form.applicablePlanIds.includes(plan.id)}
                        onChange={() => togglePlanSelection(plan.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="block font-medium text-slate-900 dark:text-slate-100">{plan.name}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          ₹{plan.price} · {plan.category?.replace('_', ' ') || 'pricing plan'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    isActive: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Coupon is active
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? 'Save Coupon' : 'Create Coupon'}
              </button>
              <button
                type="button"
                onClick={loadCoupons}
                disabled={loading || submitting}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-300 dark:text-slate-200 dark:hover:bg-dark-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-dark-300 dark:bg-dark-100">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configured Coupons</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Active and inactive pricing-plan coupons.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-dark-200 dark:text-slate-300">
              <TicketPercent className="h-4 w-4" />
              {coupons.length}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-dark-300 dark:text-slate-400">
              No pricing-plan coupons configured yet.
            </div>
          ) : (
            <div className="space-y-3">
              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-dark-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                          {coupon.code}
                        </span>
                        <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {coupon.discountPercentage}% OFF
                        </span>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            coupon.isActive
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-dark-200 dark:text-slate-400'
                          }`}
                        >
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {coupon.description || 'No description provided.'}
                      </p>
                      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <p>Applies to: {getPlanSummary(coupon)}</p>
                        <p>Usage rule: one successful redemption per account</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(coupon)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-dark-300 dark:text-slate-200 dark:hover:bg-dark-200"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(coupon)}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-300 dark:text-slate-200 dark:hover:bg-dark-200"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {coupon.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(coupon)}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
