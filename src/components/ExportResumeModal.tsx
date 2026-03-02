import React, { useState, useCallback } from 'react';
import { X, Download, FileText, Minimize2, Check } from 'lucide-react';
import { ResumeData, UserType } from '../types/resume';
import { ExportOptions, defaultExportOptions, LayoutType, PaperSize } from '../types/export';
import { exportToPDF, exportToWord } from '../utils/exportUtils';
import { ResumePreview } from './ResumePreview';

interface ExportResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeData: ResumeData;
  userType: UserType;
}

const COMPACT_ONE_PAGE: ExportOptions = {
  layoutType: 'compact',
  paperSize: 'a4',
  fontFamily: 'Calibri',
  nameSize: 20,
  sectionHeaderSize: 11,
  subHeaderSize: 9.5,
  bodyTextSize: 9.5,
  sectionSpacing: 2,
  entrySpacing: 1,
};

const FONT_FAMILIES = [
  'Helvetica',
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Courier New',
];

const SIZE_OPTIONS = [8, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14, 16, 18, 20, 22, 24, 26];

const ExportResumeModal: React.FC<ExportResumeModalProps> = ({
  isOpen,
  onClose,
  resumeData,
  userType,
}) => {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ type: string; ok: boolean } | null>(null);
  const [fittedOnePage, setFittedOnePage] = useState(false);

  const update = useCallback(
    (patch: Partial<ExportOptions>) => setOptions((prev) => ({ ...prev, ...patch })),
    []
  );

  const handleFitOnePage = useCallback(() => {
    setOptions(COMPACT_ONE_PAGE);
    setFittedOnePage(true);
    setTimeout(() => setFittedOnePage(false), 2000);
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    setExportMsg(null);
    try {
      await exportToPDF(resumeData, userType, options);
      setExportMsg({ type: 'PDF', ok: true });
    } catch {
      setExportMsg({ type: 'PDF', ok: false });
    } finally {
      setIsExportingPDF(false);
      setTimeout(() => setExportMsg(null), 3000);
    }
  }, [resumeData, userType, options, isExportingPDF]);

  const handleExportWord = useCallback(async () => {
    if (isExportingWord) return;
    setIsExportingWord(true);
    setExportMsg(null);
    try {
      await exportToWord(resumeData, userType);
      setExportMsg({ type: 'Word', ok: true });
    } catch {
      setExportMsg({ type: 'Word', ok: false });
    } finally {
      setIsExportingWord(false);
      setTimeout(() => setExportMsg(null), 3000);
    }
  }, [resumeData, userType, isExportingWord]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-700/60 bg-slate-900/90">
        <h2 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" />
          Export Resume
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="hidden md:flex flex-1 overflow-auto bg-slate-800/30 items-start justify-center p-6">
          <div
            className="transform-gpu bg-white shadow-2xl rounded"
            style={{ transform: 'scale(0.75)', transformOrigin: 'top center' }}
          >
            <ResumePreview
              resumeData={resumeData}
              userType={userType}
              exportOptions={options}
              showControls={false}
              defaultZoom={1}
            />
          </div>
        </div>

        <div className="flex-1 md:flex-none md:w-[360px] flex-shrink-0 md:border-l border-slate-700/60 bg-slate-900/80 flex flex-col overflow-y-auto">
          <div className="p-4 md:p-5 space-y-5 md:space-y-6 flex-1">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Paper Size
              </label>
              <select
                value={options.paperSize}
                onChange={(e) => update({ paperSize: e.target.value as PaperSize })}
                className="w-full bg-slate-800 border border-slate-600/50 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="a4">A4 (8.27&quot; x 11.69&quot;)</option>
                <option value="letter">Letter (8.5&quot; x 11&quot;)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Resume Template
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['standard', 'compact'] as LayoutType[]).map((layout) => {
                  const active = options.layoutType === layout;
                  return (
                    <button
                      key={layout}
                      onClick={() => update({ layoutType: layout })}
                      className={`relative rounded-xl border-2 p-3 text-left transition-all duration-200 ${
                        active
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-600/40 bg-slate-800/60 hover:border-slate-500/60'
                      }`}
                    >
                      {layout === 'standard' && (
                        <span className="absolute -top-2 right-2 bg-emerald-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full">
                          Recommended
                        </span>
                      )}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-8 h-10 rounded border ${active ? 'border-emerald-400' : 'border-slate-500'}`}>
                          <div className="m-1 space-y-0.5">
                            <div className={`h-0.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            <div className={`h-0.5 w-3/4 rounded-full ${active ? 'bg-emerald-400/60' : 'bg-slate-600'}`} />
                            <div className={`h-0.5 w-1/2 rounded-full ${active ? 'bg-emerald-400/40' : 'bg-slate-600'}`} />
                          </div>
                        </div>
                        <span className={`text-xs font-medium capitalize ${active ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {layout}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleFitOnePage}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-sm font-medium transition-all duration-200"
            >
              {fittedOnePage ? (
                <>
                  <Check className="w-4 h-4" />
                  Applied!
                </>
              ) : (
                <>
                  <Minimize2 className="w-4 h-4" />
                  Fit Resume to One Page
                </>
              )}
            </button>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Font Family
              </label>
              <select
                value={options.fontFamily}
                onChange={(e) => update({ fontFamily: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600/50 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'nameSize', label: 'Name Size' },
                { key: 'sectionHeaderSize', label: 'Section Headers' },
                { key: 'subHeaderSize', label: 'Sub-Headers' },
                { key: 'bodyTextSize', label: 'Body Text' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
                  <select
                    value={options[key]}
                    onChange={(e) => update({ [key]: parseFloat(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600/50 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}pt
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-400">Section Spacing</label>
                  <span className="text-[11px] text-emerald-400 font-mono">{options.sectionSpacing}mm</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={options.sectionSpacing}
                  onChange={(e) => update({ sectionSpacing: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-400">Entry Spacing</label>
                  <span className="text-[11px] text-emerald-400 font-mono">{options.entrySpacing}mm</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={options.entrySpacing}
                  onChange={(e) => update({ entrySpacing: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 border-t border-slate-700/60 space-y-3">
            {exportMsg && (
              <div
                className={`text-xs text-center py-1.5 rounded-lg ${
                  exportMsg.ok
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {exportMsg.ok
                  ? `${exportMsg.type} downloaded successfully!`
                  : `${exportMsg.type} export failed. Try again.`}
              </div>
            )}
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/10 transition-all duration-200 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExportingPDF ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button
              onClick={handleExportWord}
              disabled={isExportingWord}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-600/50 bg-slate-800/60 hover:bg-slate-700/60 text-white font-medium transition-all duration-200 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExportingWord ? 'Generating Word...' : 'Download Word'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportResumeModal;
