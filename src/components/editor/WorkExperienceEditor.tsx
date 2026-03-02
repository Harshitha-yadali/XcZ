import React from 'react';
import { GripVertical, Trash2, Plus, Link2 } from 'lucide-react';
import type { WorkExperience } from '../../types/resume';
import BulletEditor from './BulletEditor';

interface WorkExperienceEditorProps {
  items: WorkExperience[];
  onChange: (items: WorkExperience[]) => void;
}

const WorkExperienceEditor: React.FC<WorkExperienceEditorProps> = ({ items, onChange }) => {
  const handleUpdate = (idx: number, updates: Partial<WorkExperience>) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], ...updates };
    onChange(updated);
  };

  const handleRemove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    onChange([...items, { role: '', company: '', year: '', bullets: [''], location: '' }]);
  };

  return (
    <div className="space-y-5">
      {items.map((exp, idx) => (
        <div key={idx} className="group relative bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="cursor-grab p-1 text-slate-600 hover:text-slate-400">
              <GripVertical className="w-4 h-4" />
            </div>
            <button onClick={() => handleRemove(idx)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              value={exp.role || ''}
              onChange={(e) => handleUpdate(idx, { role: e.target.value })}
              placeholder="Job Title / Role"
              className="bg-transparent text-sm font-semibold text-white placeholder-slate-500 outline-none border-b border-slate-700/50 focus:border-emerald-500/50 pb-1 transition-colors"
            />
            <input
              value={exp.company || ''}
              onChange={(e) => handleUpdate(idx, { company: e.target.value })}
              placeholder="Company Name"
              className="bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none border-b border-slate-700/50 focus:border-emerald-500/50 pb-1 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <input
                value={exp.year?.split('–')[0]?.split('-')[0]?.trim() || ''}
                onChange={(e) => {
                  const end = exp.year?.split(/[–-]/)[1]?.trim() || '';
                  handleUpdate(idx, { year: end ? `${e.target.value} – ${end}` : e.target.value });
                }}
                placeholder="Start Date"
                className="w-full bg-slate-800/40 text-xs text-slate-400 placeholder-slate-600 px-2 py-1.5 rounded border border-slate-700/50 focus:border-emerald-500/50 outline-none transition-colors"
              />
              <span className="text-slate-600 text-xs">to</span>
              <input
                value={exp.year?.split(/[–-]/)[1]?.trim() || ''}
                onChange={(e) => {
                  const start = exp.year?.split(/[–-]/)[0]?.trim() || '';
                  handleUpdate(idx, { year: `${start} – ${e.target.value}` });
                }}
                placeholder="End Date"
                className="w-full bg-slate-800/40 text-xs text-slate-400 placeholder-slate-600 px-2 py-1.5 rounded border border-slate-700/50 focus:border-emerald-500/50 outline-none transition-colors"
              />
            </div>
            <input
              value={exp.location || ''}
              onChange={(e) => handleUpdate(idx, { location: e.target.value })}
              placeholder="Location..."
              className="bg-slate-800/40 text-xs text-slate-400 placeholder-slate-600 px-2 py-1.5 rounded border border-slate-700/50 focus:border-emerald-500/50 outline-none transition-colors"
            />
          </div>

          <BulletEditor
            bullets={exp.bullets || ['']}
            onChange={(bullets) => handleUpdate(idx, { bullets })}
            placeholder="Describe your responsibility or achievement..."
          />
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-400 border border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 hover:text-emerald-400 transition-colors w-fit"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Work Experience
      </button>
    </div>
  );
};

export default WorkExperienceEditor;
