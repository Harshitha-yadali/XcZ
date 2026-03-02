import React from 'react';
import { GripVertical, Trash2, Plus, Link2 } from 'lucide-react';
import type { Project } from '../../types/resume';
import BulletEditor from './BulletEditor';

interface ProjectsEditorProps {
  items: Project[];
  onChange: (items: Project[]) => void;
}

const ProjectsEditor: React.FC<ProjectsEditorProps> = ({ items, onChange }) => {
  const handleUpdate = (idx: number, updates: Partial<Project>) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], ...updates };
    onChange(updated);
  };

  const handleRemove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    onChange([...items, { title: '', bullets: [''], githubUrl: '', techStack: [] }]);
  };

  const handleAddTech = (idx: number, tech: string) => {
    const trimmed = tech.trim();
    if (!trimmed) return;
    const updated = [...items];
    const current = updated[idx].techStack || [];
    if (!current.includes(trimmed)) {
      updated[idx] = { ...updated[idx], techStack: [...current, trimmed] };
      onChange(updated);
    }
  };

  const handleRemoveTech = (idx: number, techIdx: number) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      techStack: (updated[idx].techStack || []).filter((_, i) => i !== techIdx),
    };
    onChange(updated);
  };

  return (
    <div className="space-y-5">
      {items.map((proj, idx) => (
        <div key={idx} className="group relative bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="cursor-grab p-1 text-slate-600 hover:text-slate-400">
              <GripVertical className="w-4 h-4" />
            </div>
            <button onClick={() => handleRemove(idx)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <input
            value={proj.title || ''}
            onChange={(e) => handleUpdate(idx, { title: e.target.value })}
            placeholder="Project Title"
            className="w-full bg-transparent text-sm font-semibold text-white placeholder-slate-500 outline-none border-b border-slate-700/50 focus:border-emerald-500/50 pb-1 mb-3 transition-colors"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="flex items-center gap-2 bg-slate-800/40 rounded px-2 py-1.5 border border-slate-700/50 focus-within:border-emerald-500/50 transition-colors">
              <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <input
                value={proj.githubUrl || ''}
                onChange={(e) => handleUpdate(idx, { githubUrl: e.target.value })}
                placeholder="GitHub / Demo URL"
                className="w-full bg-transparent text-xs text-slate-400 placeholder-slate-600 outline-none"
              />
            </div>
            <input
              value={proj.description || ''}
              onChange={(e) => handleUpdate(idx, { description: e.target.value })}
              placeholder="One-line description (optional)"
              className="bg-slate-800/40 text-xs text-slate-400 placeholder-slate-600 px-2 py-1.5 rounded border border-slate-700/50 focus:border-emerald-500/50 outline-none transition-colors"
            />
          </div>

          {(proj.techStack && proj.techStack.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {proj.techStack.map((tech, tIdx) => (
                <span key={tIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {tech}
                  <button onClick={() => handleRemoveTech(idx, tIdx)} className="text-emerald-500/60 hover:text-red-400">
                    <span className="text-xs">&times;</span>
                  </button>
                </span>
              ))}
              <TechAdder onAdd={(t) => handleAddTech(idx, t)} />
            </div>
          )}
          {(!proj.techStack || proj.techStack.length === 0) && (
            <div className="mb-3">
              <TechAdder onAdd={(t) => handleAddTech(idx, t)} showLabel />
            </div>
          )}

          <BulletEditor
            bullets={proj.bullets || ['']}
            onChange={(bullets) => handleUpdate(idx, { bullets })}
            placeholder="Describe what you built or achieved..."
          />
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-400 border border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 hover:text-emerald-400 transition-colors w-fit"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Project
      </button>
    </div>
  );
};

const TechAdder: React.FC<{ onAdd: (tech: string) => void; showLabel?: boolean }> = ({ onAdd, showLabel }) => {
  const [value, setValue] = React.useState('');
  return (
    <div className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) { onAdd(value); setValue(''); }
        }}
        placeholder={showLabel ? 'Add tech stack...' : 'Add...'}
        className="px-2 py-0.5 text-[10px] bg-transparent text-slate-400 placeholder-slate-600 border border-dashed border-slate-700 rounded outline-none focus:border-emerald-500/50 w-20"
      />
    </div>
  );
};

export default ProjectsEditor;
