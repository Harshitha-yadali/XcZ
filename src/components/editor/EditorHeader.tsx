import React from 'react';
import { Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react';
import type { ResumeData } from '../../types/resume';

interface EditorHeaderProps {
  data: ResumeData;
  onChange: (updates: Partial<ResumeData>) => void;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ data, onChange }) => {
  return (
    <div className="space-y-4">
      <input
        type="text"
        value={data.name || ''}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Full Name"
        className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-b-2 border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 pb-2 outline-none transition-colors"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 focus-within:border-emerald-500/50 transition-colors">
          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="email"
            value={data.email || ''}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="email@example.com"
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 focus-within:border-emerald-500/50 transition-colors">
          <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="tel"
            value={data.phone || ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+91-9876543210"
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 focus-within:border-emerald-500/50 transition-colors">
          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={data.location || ''}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="City, Country"
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 focus-within:border-emerald-500/50 transition-colors">
          <Linkedin className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="url"
            value={data.linkedin || ''}
            onChange={(e) => onChange({ linkedin: e.target.value })}
            placeholder="linkedin.com/in/your-id"
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 focus-within:border-emerald-500/50 transition-colors">
          <Github className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="url"
            value={data.github || ''}
            onChange={(e) => onChange({ github: e.target.value })}
            placeholder="github.com/your-id"
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 focus-within:border-emerald-500/50 transition-colors">
          <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="url"
            value={(data as any).website || ''}
            onChange={(e) => onChange({ ...data, website: e.target.value } as any)}
            placeholder="www.your-site.com"
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
};

export default EditorHeader;
