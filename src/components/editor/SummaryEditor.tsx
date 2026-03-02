import React, { useRef, useEffect } from 'react';

interface SummaryEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const SummaryEditor: React.FC<SummaryEditorProps> = ({ value, onChange, label = 'Career Objective' }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Write your ${label.toLowerCase()}...`}
        rows={3}
        className="w-full bg-slate-800/40 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 border border-slate-700/50 focus:border-emerald-500/50 outline-none resize-none leading-relaxed transition-colors"
      />
    </div>
  );
};

export default SummaryEditor;
