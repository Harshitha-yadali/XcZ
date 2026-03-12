import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Eye,
  EyeOff,
  IndianRupee,
  Pencil,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { referralService } from '../../services/referralService';
import type {
  ReferralListing,
  ReferralSubmission,
} from '../../types/referral';

const emptyListing: Omit<ReferralListing, 'id' | 'created_at' | 'updated_at'> = {
  company_name: '',
  company_logo_url: null,
  role_title: '',
  experience_range: '',
  package_range: '',
  tech_stack: [],
  job_description: '',
  location: null,
  referrer_name: null,
  referrer_designation: null,
  is_active: true,
  query_price: null,
  profile_price: null,
  slot_price: null,
};

export const AdminReferralsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'listings' | 'submissions'>('listings');
  const [listings, setListings] = useState<ReferralListing[]>([]);
  const [submissions, setSubmissions] = useState<ReferralSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyListing);
  const [techInput, setTechInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [listingsData, submissionsData] = await Promise.all([
      referralService.getAllListings(),
      referralService.getAllSubmissions(),
    ]);

    setListings(listingsData);
    setSubmissions(submissionsData);
    setLoading(false);
  };

  const handleEdit = (listing: ReferralListing) => {
    setEditingId(listing.id);
    setForm({
      company_name: listing.company_name,
      company_logo_url: listing.company_logo_url,
      role_title: listing.role_title,
      experience_range: listing.experience_range,
      package_range: listing.package_range,
      tech_stack: listing.tech_stack,
      job_description: listing.job_description,
      location: listing.location,
      referrer_name: listing.referrer_name,
      referrer_designation: listing.referrer_designation,
      is_active: listing.is_active,
      query_price: listing.query_price,
      profile_price: listing.profile_price,
      slot_price: listing.slot_price,
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ ...emptyListing });
    setTechInput('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.company_name || !form.role_title) return;

    setSaving(true);

    const payload = {
      ...form,
      query_price: null,
      slot_price: null,
    };

    if (editingId) {
      await referralService.updateListing(editingId, payload);
    } else {
      await referralService.createListing(payload);
    }

    setShowForm(false);
    setSaving(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this referral listing?')) return;
    await referralService.deleteListing(id);
    loadData();
  };

  const handleToggleActive = async (listing: ReferralListing) => {
    await referralService.updateListing(listing.id, { is_active: !listing.is_active });
    loadData();
  };

  const handleAddTech = () => {
    const value = techInput.trim();
    if (value && !form.tech_stack.includes(value)) {
      setForm((previous) => ({ ...previous, tech_stack: [...previous.tech_stack, value] }));
      setTechInput('');
    }
  };

  const handleRemoveTech = (tech: string) => {
    setForm((previous) => ({
      ...previous,
      tech_stack: previous.tech_stack.filter((item) => item !== tech),
    }));
  };

  const handleSubmissionStatusChange = async (
    submissionId: string,
    status: ReferralSubmission['status']
  ) => {
    setUpdatingSubmissionId(submissionId);
    await referralService.updateSubmissionStatus(submissionId, status);
    await loadData();
    setUpdatingSubmissionId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pl-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Referral Management</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage referral listings, one price per listing, and the post-payment user submissions.
            </p>
          </div>

          {activeTab === 'listings' && (
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Referral
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            {
              key: 'listings' as const,
              label: 'Listings',
              icon: <Building2 className="w-4 h-4" />,
              count: listings.length,
            },
            {
              key: 'submissions' as const,
              label: 'Submissions',
              icon: <UploadCloud className="w-4 h-4" />,
              count: submissions.length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800/40 text-slate-400 border border-slate-700/40 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-slate-700/60">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {activeTab === 'listings' && (
          <div className="space-y-4">
            {listings.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No referral listings yet.</div>
            ) : (
              listings.map((listing) => {
                const pricePaise = referralService.getResolvedReferralPrice(listing);
                return (
                  <div
                    key={listing.id}
                    className={`bg-slate-800/30 border rounded-xl p-5 flex items-start gap-4 ${
                      listing.is_active ? 'border-slate-700/40' : 'border-red-500/20 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-bold text-lg truncate">{listing.company_name}</h3>
                        {!listing.is_active && (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>

                      <p className="text-slate-300 text-sm">{listing.role_title}</p>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {listing.experience_range && (
                          <span className="text-xs text-slate-500">{listing.experience_range}</span>
                        )}
                        {listing.package_range && (
                          <span className="text-xs text-slate-500">| {listing.package_range}</span>
                        )}
                        {listing.location && (
                          <span className="text-xs text-slate-500">| {listing.location}</span>
                        )}
                      </div>

                      {listing.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {listing.tech_stack.map((tech) => (
                            <span
                              key={tech}
                              className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-md"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3">
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-300 text-xs rounded-md border border-blue-500/20">
                          Referral price:{' '}
                          {pricePaise > 0 ? `\u20B9${pricePaise / 100}` : 'not configured'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(listing)}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                        title={listing.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {listing.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(listing)}
                        className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(listing.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No submissions yet.</div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/40">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Company</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Applicant</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Email</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Amount</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => (
                        <tr key={submission.id} className="border-b border-slate-700/20 align-top">
                          <td className="py-3 px-4 text-white">
                            <div>{submission.referral_listings?.company_name || '-'}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {submission.referral_listings?.role_title || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {submission.applicant_name || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-300 break-all">
                            {submission.contact_email}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {'\u20B9'}{submission.amount_paid / 100}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={submission.status}
                              onChange={(event) =>
                                handleSubmissionStatusChange(
                                  submission.id,
                                  event.target.value as ReferralSubmission['status']
                                )
                              }
                              disabled={updatingSubmissionId === submission.id}
                              className="px-3 py-2 bg-slate-900/70 border border-slate-700/50 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500/40"
                            >
                              <option value="submitted">Submitted</option>
                              <option value="processing">Processing</option>
                              <option value="completed">Completed</option>
                              <option value="rejected">Rejected</option>
                            </select>
                            {submission.admin_notified_at && (
                              <p className="text-[11px] text-emerald-300 mt-2">Admin emailed</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(submission.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(event) => event.stopPropagation()}
                className="bg-[#0d1f2d] border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between p-5 border-b border-slate-700/40">
                  <h2 className="text-white font-bold text-lg">
                    {editingId ? 'Edit Referral' : 'New Referral'}
                  </h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Company Name *</label>
                      <input
                        value={form.company_name}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, company_name: event.target.value }))
                        }
                        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Role Title *</label>
                      <input
                        value={form.role_title}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, role_title: event.target.value }))
                        }
                        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Company Logo URL</label>
                    <input
                      value={form.company_logo_url || ''}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          company_logo_url: event.target.value || null,
                        }))
                      }
                      className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Experience</label>
                      <input
                        value={form.experience_range}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            experience_range: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        placeholder="2-5 years"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Package</label>
                      <input
                        value={form.package_range}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            package_range: event.target.value,
                          }))
                        }
                        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        placeholder="15-25 LPA"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Location</label>
                      <input
                        value={form.location || ''}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            location: event.target.value || null,
                          }))
                        }
                        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        placeholder="Bangalore"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Tech Stack</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        value={techInput}
                        onChange={(event) => setTechInput(event.target.value)}
                        onKeyDown={(event) =>
                          event.key === 'Enter' && (event.preventDefault(), handleAddTech())
                        }
                        className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        placeholder="Add technology..."
                      />
                      <button
                        onClick={handleAddTech}
                        className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm hover:bg-emerald-500/30 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {form.tech_stack.map((tech) => (
                        <span
                          key={tech}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-md"
                        >
                          {tech}
                          <button onClick={() => handleRemoveTech(tech)} className="hover:text-red-400">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Job Description</label>
                    <textarea
                      value={form.job_description}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          job_description: event.target.value,
                        }))
                      }
                      rows={5}
                      className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Referrer Name</label>
                      <input
                        value={form.referrer_name || ''}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            referrer_name: event.target.value || null,
                          }))
                        }
                        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Referrer Designation</label>
                      <input
                        value={form.referrer_designation || ''}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            referrer_designation: event.target.value || null,
                          }))
                        }
                        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                        placeholder="SDE-2 at Amazon"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Referral Price (INR)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="number"
                        value={form.profile_price !== null ? form.profile_price / 100 : ''}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            profile_price: event.target.value ? Number(event.target.value) * 100 : null,
                          }))
                        }
                        placeholder="499"
                        className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-slate-600"
                      />
                    </div>
                    <p className="text-slate-500 text-xs mt-2">
                      Users see this price on the referral detail page before they pay and upload their PDF.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-slate-400 text-sm">Active</label>
                    <button
                      onClick={() => setForm((previous) => ({ ...previous, is_active: !previous.is_active }))}
                      className={`w-10 h-6 rounded-full transition-colors relative ${
                        form.is_active ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          form.is_active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 p-5 border-t border-slate-700/40">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.company_name || !form.role_title}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
