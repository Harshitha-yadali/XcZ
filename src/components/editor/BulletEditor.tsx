import React, { useRef, useEffect } from 'react';
import { GripVertical, Trash2, Plus } from 'lucide-react';

interface BulletEditorProps {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  placeholder?: string;
}

const BulletEditor: React.FC<BulletEditorProps> = ({ bullets, onChange, placeholder = 'Describe your contribution...' }) => {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    refs.current.forEach(autoResize);
  }, [bullets]);

  const handleChange = (idx: number, value: string) => {
    const updated = [...bullets];
    updated[idx] = value;
    onChange(updated);
  };

  const handleRemove = (idx: number) => {
    onChange(bullets.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    onChange([...bullets, '']);
    setTimeout(() => {
      const last = refs.current[bullets.length];
      if (last) last.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Backspace' && bullets[idx] === '' && bullets.length > 1) {
      e.preventDefault();
      handleRemove(idx);
      const prevIdx = Math.max(0, idx - 1);
      setTimeout(() => refs.current[prevIdx]?.focus(), 50);
    }
  };

  return (
    <div className="space-y-1.5">
      {bullets.map((bullet, idx) => (
        <div key={idx} className="group flex items-start gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-slate-700 mt-2.5 cursor-grab flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="text-slate-500 mt-2 text-sm flex-shrink-0 select-none">&#8226;</span>
          <textarea
            ref={(el) => { refs.current[idx] = el; }}
            value={bullet}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed py-1.5 border-b border-transparent focus:border-slate-700 transition-colors"
          />
          <button
            onClick={() => handleRemove(idx)}
            className="p-1 mt-1.5 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={handleAdd}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors ml-5"
      >
        <Plus className="w-3 h-3" />
        Add Bullet Point
      </button>
    </div>
  );
};

export default BulletEditor;
