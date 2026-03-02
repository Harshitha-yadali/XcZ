import React, { useState } from 'react';
import { GripVertical, Pencil, Trash2, Plus, X, ChevronUp, ChevronDown, LayoutList } from 'lucide-react';

export interface SectionConfig {
  id: string;
  label: string;
  visible: boolean;
}

const ALL_SECTIONS: { id: string; label: string }[] = [
  { id: 'summary', label: 'CAREER OBJECTIVE' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'workExperience', label: 'WORK EXPERIENCE' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'education', label: 'EDUCATION' },
  { id: 'certifications', label: 'CERTIFICATIONS' },
  { id: 'achievements', label: 'ACHIEVEMENTS' },
];

interface SectionLayoutPanelProps {
  sections: SectionConfig[];
  onSectionsChange: (sections: SectionConfig[]) => void;
  onScrollToSection: (id: string) => void;
}

const SectionLayoutPanel: React.FC<SectionLayoutPanelProps> = ({ sections, onSectionsChange, onScrollToSection }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleMove = (idx: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= sections.length) return;
    const updated = [...sections];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onSectionsChange(updated);
  };

  const handleToggle = (idx: number) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], visible: !updated[idx].visible };
    onSectionsChange(updated);
  };

  const handleAddSection = () => {
    const existing = new Set(sections.map((s) => s.id));
    const available = ALL_SECTIONS.filter((s) => !existing.has(s.id));
    if (available.length > 0) {
      onSectionsChange([...sections, { ...available[0], visible: true }]);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
        title="Edit Resume Layout"
      >
        <LayoutList className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 max-h-[70vh] bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/40 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <h3 className="text-sm font-semibold text-white">Edit Resume Layout</h3>
            <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(70vh-8rem)] p-2">
            {sections.map((section, idx) => (
              <div
                key={section.id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  section.visible
                    ? 'bg-slate-800/60 hover:bg-slate-800/80'
                    : 'bg-slate-800/20 opacity-50'
                }`}
              >
                <GripVertical className="w-4 h-4 text-slate-600 cursor-grab flex-shrink-0" />
                <span className="flex-1 text-xs font-medium text-slate-300 truncate">
                  {section.label}
                </span>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === sections.length - 1}
                    className="p-1 text-slate-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onScrollToSection(section.id)}
                    className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                    title="Scroll to section"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggle(idx)}
                    className={`p-1 transition-colors ${section.visible ? 'text-slate-500 hover:text-red-400' : 'text-emerald-500 hover:text-emerald-400'}`}
                    title={section.visible ? 'Hide section' : 'Show section'}
                  >
                    {section.visible ? <Trash2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-slate-700/50">
            <button
              onClick={handleAddSection}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 border border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Section
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SectionLayoutPanel;
