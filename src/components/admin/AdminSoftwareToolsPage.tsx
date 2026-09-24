import React, { useEffect, useState } from 'react';
import { Edit2, Eye, EyeOff, Package, Plus, Trash2 } from 'lucide-react';
import {
  softwareToolsService,
  isHttpUrl,
  type SoftwareTool,
  type SoftwareToolInput,
} from '../../services/softwareToolsService';

const emptyForm: SoftwareToolInput = {
  name: '',
  description: '',
  image_url: '',
  duration: '',
  price: 0,
  original_price: null,
  buy_url: '',
  is_active: true,
  sort_order: 0,
};

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:border-dark-300 dark:text-slate-100';

export const AdminSoftwareToolsPage: React.FC = () => {
  const [tools, setTools] = useState<SoftwareTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SoftwareToolInput | null>(null);

  const load = async () => {
    try {
      setTools(await softwareToolsService.getTools());
    } catch (error) {
      console.error('Error loading software tools:', error);
      alert('Failed to load software tools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openForm = (tool?: SoftwareTool) => {
    setEditingId(tool?.id ?? null);
    setForm(
      tool
        ? {
            name: tool.name,
            description: tool.description,
            image_url: tool.image_url ?? '',
            duration: tool.duration,
            price: Number(tool.price),
            original_price: tool.original_price != null ? Number(tool.original_price) : null,
            buy_url: tool.buy_url,
            is_active: tool.is_active,
            sort_order: tool.sort_order,
          }
        : emptyForm
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!isHttpUrl(form.buy_url) || (form.image_url && !isHttpUrl(form.image_url))) {
      alert('Links must start with http:// or https://');
      return;
    }

    const payload = { ...form, image_url: form.image_url?.trim() || null };
    setSaving(true);
    try {
      if (editingId) {
        await softwareToolsService.updateTool(editingId, payload);
      } else {
        await softwareToolsService.createTool(payload);
      }
      setForm(null);
      await load();
    } catch (error) {
      console.error('Error saving software tool:', error);
      alert('Failed to save tool');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (tool: SoftwareTool) => {
    try {
      await softwareToolsService.updateTool(tool.id, { is_active: !tool.is_active });
      await load();
    } catch (error) {
      console.error('Error toggling software tool:', error);
      alert('Failed to update tool');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tool?')) return;
    try {
      await softwareToolsService.deleteTool(id);
      await load();
    } catch (error) {
      console.error('Error deleting software tool:', error);
      alert('Failed to delete tool');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8 dark:from-dark-50 dark:to-dark-200 lg:pl-20">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
              <Package className="h-7 w-7 text-blue-600 dark:text-blue-300" />
              Software Tools
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Add tools like LinkedIn Premium. Active tools show on /software-tools.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Tool
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : tools.length === 0 ? (
          <p className="text-center py-12 text-slate-500">No tools yet.</p>
        ) : (
          <div className="space-y-3">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{tool.name}</h3>
                    <span className="text-sm font-medium text-emerald-600">{`₹${Number(tool.price)}`}</span>
                    {tool.duration && <span className="text-xs text-slate-500">{tool.duration}</span>}
                    {!tool.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Hidden</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{tool.description}</p>
                  <p className="mt-1 text-xs text-blue-600 break-all">{tool.buy_url}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(tool)}
                    title={tool.is_active ? 'Hide' : 'Show'}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-dark-200"
                  >
                    {tool.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openForm(tool)}
                    title="Edit"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:hover:bg-dark-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tool.id)}
                    title="Delete"
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-dark-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 space-y-4 dark:bg-dark-100"
          >
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {editingId ? 'Edit Tool' : 'Add Tool'}
            </h2>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="LinkedIn Premium Career"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Price (₹)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                MRP (₹, optional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.original_price ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, original_price: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Duration
                <input
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className={inputClass}
                  placeholder="3 months"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Buy link (payment link / WhatsApp)
              <input
                required
                type="url"
                value={form.buy_url}
                onChange={(e) => setForm({ ...form, buy_url: e.target.value })}
                className={inputClass}
                placeholder="https://rzp.io/l/..."
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Logo URL (optional)
              <input
                type="url"
                value={form.image_url ?? ''}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                className={inputClass}
              />
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                Sort order
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  className={`${inputClass} w-20`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Visible to users
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-dark-300 dark:hover:bg-dark-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
