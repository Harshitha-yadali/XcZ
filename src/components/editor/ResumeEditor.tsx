import React, { useState, useRef, useCallback } from 'react';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { ResumeData, Skill, Education, WorkExperience, Project, Certification } from '../../types/resume';
import EditorHeader from './EditorHeader';
import SummaryEditor from './SummaryEditor';
import SkillsEditor from './SkillsEditor';
import WorkExperienceEditor from './WorkExperienceEditor';
import ProjectsEditor from './ProjectsEditor';
import EducationEditor from './EducationEditor';
import CertificationsEditor from './CertificationsEditor';
import SectionLayoutPanel, { SectionConfig } from './SectionLayoutPanel';

interface ResumeEditorProps {
  resumeData: ResumeData;
  onUpdate: (data: ResumeData) => void;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'summary', label: 'CAREER OBJECTIVE', visible: true },
  { id: 'skills', label: 'SKILLS', visible: true },
  { id: 'workExperience', label: 'WORK EXPERIENCE', visible: true },
  { id: 'projects', label: 'PROJECTS', visible: true },
  { id: 'education', label: 'EDUCATION', visible: true },
  { id: 'certifications', label: 'CERTIFICATIONS', visible: true },
];

const ResumeEditor: React.FC<ResumeEditorProps> = ({ resumeData, onUpdate }) => {
  const [sections, setSections] = useState<SectionConfig[]>(() => {
    const initial = [...DEFAULT_SECTIONS];
    if (resumeData.achievements && resumeData.achievements.length > 0) {
      initial.push({ id: 'achievements', label: 'ACHIEVEMENTS', visible: true });
    }
    return initial;
  });

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleUpdate = useCallback((updates: Partial<ResumeData>) => {
    onUpdate({ ...resumeData, ...updates });
  }, [resumeData, onUpdate]);

  const toggleCollapse = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleScrollToSection = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (collapsedSections.has(id)) {
        setCollapsedSections((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, visible: false } : s)));
  };

  const renderSection = (config: SectionConfig) => {
    if (!config.visible) return null;
    const isCollapsed = collapsedSections.has(config.id);

    const sectionContent = () => {
      switch (config.id) {
        case 'summary':
          return (
            <SummaryEditor
              value={resumeData.summary || resumeData.careerObjective || ''}
              onChange={(v) => handleUpdate({ summary: v, careerObjective: v })}
              label={config.label}
            />
          );
        case 'skills':
          return (
            <SkillsEditor
              skills={resumeData.skills || []}
              onChange={(skills: Skill[]) => handleUpdate({ skills })}
            />
          );
        case 'workExperience':
          return (
            <WorkExperienceEditor
              items={resumeData.workExperience || []}
              onChange={(workExperience: WorkExperience[]) => handleUpdate({ workExperience })}
            />
          );
        case 'projects':
          return (
            <ProjectsEditor
              items={resumeData.projects || []}
              onChange={(projects: Project[]) => handleUpdate({ projects })}
            />
          );
        case 'education':
          return (
            <EducationEditor
              items={resumeData.education || []}
              onChange={(education: Education[]) => handleUpdate({ education })}
            />
          );
        case 'certifications':
          return (
            <CertificationsEditor
              items={resumeData.certifications || []}
              onChange={(certifications: (string | Certification)[]) => handleUpdate({ certifications })}
            />
          );
        case 'achievements':
          return (
            <div className="space-y-2">
              {(resumeData.achievements || []).map((a, i) => (
                <div key={i} className="group flex items-start gap-2">
                  <span className="text-slate-500 mt-1 text-sm">&#8226;</span>
                  <input
                    value={a}
                    onChange={(e) => {
                      const updated = [...(resumeData.achievements || [])];
                      updated[i] = e.target.value;
                      handleUpdate({ achievements: updated });
                    }}
                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none border-b border-transparent focus:border-slate-700 py-1 transition-colors"
                    placeholder="Achievement..."
                  />
                  <button
                    onClick={() => handleUpdate({ achievements: (resumeData.achievements || []).filter((_, idx) => idx !== i) })}
                    className="p-1 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => handleUpdate({ achievements: [...(resumeData.achievements || []), ''] })}
                className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
              >
                + Add Achievement
              </button>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div
        key={config.id}
        ref={(el) => { sectionRefs.current[config.id] = el; }}
        className="border-b border-slate-800/50 last:border-b-0"
      >
        <div
          className="flex items-center gap-3 py-4 cursor-pointer select-none group"
          onClick={() => toggleCollapse(config.id)}
        >
          <div className="text-slate-500 transition-transform duration-200">
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase flex-1">
            {config.label}
          </h3>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteSection(config.id); }}
            className="p-1 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            title="Hide section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {!isCollapsed && (
          <div className="pb-5 pl-7 animate-in fade-in duration-200">
            {sectionContent()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-800/50">
          <EditorHeader data={resumeData} onChange={handleUpdate} />
        </div>

        <div className="px-5 sm:px-6">
          {sections.map((section) => renderSection(section))}
        </div>
      </div>

      <SectionLayoutPanel
        sections={sections}
        onSectionsChange={setSections}
        onScrollToSection={handleScrollToSection}
      />
    </div>
  );
};

export default ResumeEditor;
