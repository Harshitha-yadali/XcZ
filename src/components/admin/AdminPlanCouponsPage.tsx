import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TicketPercent } from 'lucide-react';
import { AdminPlanCouponsManager } from './AdminPlanCouponsManager';

export const AdminPlanCouponsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8 dark:from-dark-50 dark:to-dark-200 lg:pl-20">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
              <TicketPercent className="h-7 w-7 text-blue-600 dark:text-blue-300" />
              Pricing Plan Coupons
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage admin-created coupon codes for subscription pricing plans.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/jobs')}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:bg-dark-100 dark:text-slate-200 dark:hover:bg-dark-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </button>
        </div>

        <AdminPlanCouponsManager />
      </div>
    </div>
  );
};
