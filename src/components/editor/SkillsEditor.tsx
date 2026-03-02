import React, { useState } from 'react';
import { X, Plus, GripVertical, Trash2 } from 'lucide-react';
import type { Skill } from '../../types/resume';

interface SkillsEditorProps {
  skills: Skill[];
  onChange: (skills: Skill[]) => void;
}

const SkillsEditor: React.FC<SkillsEditorProps> = ({ skills, onChange }) => {
  const [addingSkillIdx, setAddingSkillIdx] = useState<number | null>(null);
  const [newSkillText, setNewSkillText] = useState('');
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);

  const handleAddSkill = (catIdx: number) => {
    const trimmed = newSkillText.trim();
    if (!trimmed) return;
    const updated = [...skills];
    updated[catIdx] = {
      ...updated[catIdx],
      list: [...updated[catIdx].list, trimmed],
      count: updated[catIdx].list.length + 1,
    };
    onChange(updated);
    setNewSkillText('');
    setAddingSkillIdx(null);
  };

  const handleRemoveSkill = (catIdx: number, skillIdx: number) => {
    const updated = [...skills];
    updated[catIdx] = {
      ...updated[catIdx],
      list: updated[catIdx].list.filter((_, i) => i !== skillIdx),
      count: updated[catIdx].list.length - 1,
    };
    onChange(updated);
  };

  const handleRemoveCategory = (catIdx: number) => {
    onChange(skills.filter((_, i) => i !== catIdx));
  };

  const handleAddCategory = () => {
    onChange([...skills, { category: 'New Category', list: [], count: 0 }]);
    setEditingCategoryIdx(skills.length);
  };

  const handleCategoryRename = (catIdx: number, newName: string) => {
    const updated = [...skills];
    updated[catIdx] = { ...updated[catIdx], category: newName };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {skills.map((skill, catIdx) => (
        <div key={catIdx} className="group">
          <div className="flex items-center gap-2 mb-2">
            <GripVertical className="w-4 h-4 text-slate-600 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            {editingCategoryIdx === catIdx ? (
              <input
                autoFocus
                value={skill.category}
                onChange={(e) => handleCategoryRename(catIdx, e.target.value)}
                onBlur={() => setEditingCategoryIdx(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingCategoryIdx(null)}
                className="text-sm font-semibold bg-slate-800/60 text-white rounded px-2 py-1 border border-emerald-500/50 outline-none"
              />
            ) : (
              <h4
                className="text-sm font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                onClick={() => setEditingCategoryIdx(catIdx)}
              >
                {skill.category}
              </h4>
            )}
            <button
              onClick={() => handleRemoveCategory(catIdx)}
              className="ml-auto p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 ml-6">
            {skill.list.map((s, sIdx) => (
              <span
                key={sIdx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-200 border border-slate-700/50 hover:border-slate-600 transition-colors"
              >
                {s}
                <button
                  onClick={() => handleRemoveSkill(catIdx, sIdx)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {addingSkillIdx === catIdx ? (
              <div className="inline-flex items-center gap-1">
                <input
                  autoFocus
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSkill(catIdx);
                    if (e.key === 'Escape') { setAddingSkillIdx(null); setNewSkillText(''); }
                  }}
                  placeholder="Add skill..."
                  className="px-2 py-1 text-xs bg-slate-800/60 text-slate-200 border border-emerald-500/50 rounded-full outline-none w-28"
                />
                <button
                  onClick={() => handleAddSkill(catIdx)}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAddingSkillIdx(catIdx); setNewSkillText(''); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-slate-500 border border-dashed border-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={handleAddCategory}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 border border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 hover:text-emerald-400 transition-colors w-fit"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Skill Category
      </button>
    </div>
  );
};

export default SkillsEditor;
