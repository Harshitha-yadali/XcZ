import React from 'react';
import { GripVertical, Trash2, Plus, Award } from 'lucide-react';
import type { Certification } from '../../types/resume';

interface CertificationsEditorProps {
  items: (string | Certification)[];
  onChange: (items: (string | Certification)[]) => void;
}

const CertificationsEditor: React.FC<CertificationsEditorProps> = ({ items, onChange }) => {
  const getTitle = (item: string | Certification): string => {
    if (typeof item === 'string') return item;
    return (item as Certification).title || '';
  };

  const getDescription = (item: string | Certification): string => {
    if (typeof item === 'string') return '';
    return (item as Certification).description || '';
  };

  const handleUpdateTitle = (idx: number, title: string) => {
    const updated = [...items];
    const current = updated[idx];
    if (typeof current === 'string') {
      updated[idx] = title;
    } else {
      updated[idx] = { ...current, title };
    }
    onChange(updated);
  };

  const handleUpdateDescription = (idx: number, description: string) => {
    const updated = [...items];
    const current = updated[idx];
    if (typeof current === 'string') {
      updated[idx] = { title: current, description };
    } else {
      updated[idx] = { ...current, description };
    }
    onChange(updated);
  };

  const handleRemove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    onChange([...items, { title: '', description: '' }]);
  };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="group flex items-start gap-3 bg-slate-800/30 rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
          <Award className="w-4 h-4 text-slate-500 mt-1.5 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <input
              value={getTitle(item)}
              onChange={(e) => handleUpdateTitle(idx, e.target.value)}
              placeholder="Certification Name"
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none border-b border-transparent focus:border-slate-700 pb-0.5 transition-colors"
            />
            <input
              value={getDescription(item)}
              onChange={(e) => handleUpdateDescription(idx, e.target.value)}
              placeholder="Issuing organization (optional)"
              className="w-full bg-transparent text-xs text-slate-400 placeholder-slate-600 outline-none"
            />
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="cursor-grab p-1 text-slate-700 hover:text-slate-400">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <button onClick={() => handleRemove(idx)} className="p-1 text-slate-700 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-400 border border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 hover:text-emerald-400 transition-colors w-fit"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Certification
      </button>
    </div>
  );
};

export default CertificationsEditor;
