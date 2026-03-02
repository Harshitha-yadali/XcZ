import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Calendar,
  Briefcase,
  Code,
  MapPin,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { resumeParsingService } from '../../services/resumeParsingService';
import { userPreferencesService } from '../../services/userPreferencesService';
import { aiJobMatchingService } from '../../services/aiJobMatchingService';
import { jobsService } from '../../services/jobsService';
import { useAuth } from '../../contexts/AuthContext';
import { TECH_CATEGORIES, ALL_TECH_KEYWORDS } from '../../data/techKeywords';

interface JobPreferencesOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const WORK_MODES = [
  { value: 'remote', label: 'Remote', icon: '🏠' },
  { value: 'hybrid', label: 'Hybrid', icon: '🔄' },
  { value: 'onsite', label: 'Onsite', icon: '🏢' },
];

export const JobPreferencesOnboardingModal: React.FC<JobPreferencesOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [passoutYear, setPassoutYear] = useState<number>(2024);
  const [roleType, setRoleType] = useState<'internship' | 'fulltime' | 'both'>('both');
  const [techInterests, setTechInterests] = useState<string[]>([]);
  const [preferredModes, setPreferredModes] = useState<string[]>(['remote', 'hybrid']);

  const [techSearch, setTechSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const totalSteps = 5;

  const filteredCategories = useMemo(() => {
    if (!techSearch.trim()) return TECH_CATEGORIES;
    const q = techSearch.toLowerCase();
    return TECH_CATEGORIES
      .map(cat => ({
        ...cat,
        keywords: cat.keywords.filter(k => k.toLowerCase().includes(q)),
      }))
      .filter(cat => cat.keywords.length > 0);
  }, [techSearch]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    const validation = resumeParsingService.validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      setLoading(false);
      return;
    }

    try {
      const parsed = await resumeParsingService.parseResume(file);
      if (parsed.hasError) {
        setError(parsed.errorMessage || 'Failed to parse resume');
        setLoading(false);
        return;
      }

      setResumeFile(file);
      setResumeText(parsed.text);

      const extractedSkills = parsed.skills.slice(0, 15);
      const matched = extractedSkills.filter(s =>
        ALL_TECH_KEYWORDS.some(k => k.toLowerCase() === s.toLowerCase())
      );
      const unmatched = extractedSkills.filter(s =>
        !ALL_TECH_KEYWORDS.some(k => k.toLowerCase() === s.toLowerCase())
      );
      setTechInterests([...matched, ...unmatched]);
    } catch (err: any) {
      setError(err.message || 'Failed to process resume');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !resumeFile) {
      setError('Please upload your resume to continue');
      return;
    }
    setError('');
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const toggleTechInterest = (tech: string) => {
    setTechInterests((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const toggleCategory = (catName: string) => {
    setExpandedCategories(prev =>
      prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
    );
  };

  const toggleWorkMode = (mode: string) => {
    setPreferredModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleAddCustomKeyword = () => {
    const trimmed = techSearch.trim();
    if (trimmed && !techInterests.includes(trimmed)) {
      setTechInterests(prev => [...prev, trimmed]);
      setTechSearch('');
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsProcessing(true);
    setLoading(true);
    setError('');

    try {
      let resumeUrl = '';
      if (resumeFile) {
        const url = await userPreferencesService.uploadResume(user.id, resumeFile);
        if (url) resumeUrl = url;
      }

      await userPreferencesService.savePreferences({
        user_id: user.id,
        resume_text: resumeText,
        resume_url: resumeUrl,
        passout_year: passoutYear,
        role_type: roleType,
        tech_interests: techInterests,
        preferred_modes: preferredModes,
        onboarding_completed: true,
      });

      const jobs = await jobsService.getAllJobs();
      await aiJobMatchingService.analyzeAndMatch(
        user.id,
        {
          resumeText,
          passoutYear,
          roleType,
          techInterests,
          preferredModes,
        },
        jobs
      );

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences');
      setIsProcessing(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStep = () => {
    if (isProcessing) {
      return (
        <div className="space-y-6 py-16">
          <div className="text-center">
            <div className="relative w-28 h-28 mx-auto mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
                <Loader2 className="w-14 h-14 text-emerald-400 animate-spin" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-slate-100 mb-4">Finding Jobs...</h3>
            <p className="text-lg text-slate-300 mb-2">
              Analyzing your preferences and matching with opportunities
            </p>
            <p className="text-sm text-slate-500">This may take a few moments</p>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-2">Upload Your Resume</h3>
              <p className="text-slate-400">
                We'll analyze your skills and experience to recommend the best jobs
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors bg-slate-800/30">
              <input
                type="file"
                id="resume-upload"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                disabled={loading}
              />
              <label htmlFor="resume-upload" className="cursor-pointer flex flex-col items-center">
                {resumeFile ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                    <p className="text-lg font-semibold text-slate-100">{resumeFile.name}</p>
                    <p className="text-sm text-slate-400 mt-2">Click to change file</p>
                  </>
                ) : (
                  <>
                    <FileText className="w-12 h-12 text-slate-500 mb-3" />
                    <p className="text-lg font-semibold text-slate-100">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-slate-400 mt-2">PDF, DOCX, or TXT (max 5MB)</p>
                  </>
                )}
              </label>
            </div>

            {loading && (
              <div className="flex items-center justify-center space-x-2 text-emerald-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyzing resume...</span>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-cyan-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
                <Calendar className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-2">When did you graduate?</h3>
              <p className="text-slate-400">We'll match you with jobs for your batch</p>
            </div>

            <div className="max-w-md mx-auto">
              <select
                value={passoutYear}
                onChange={(e) => setPassoutYear(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
              >
                {Array.from({ length: 11 }, (_, i) => 2020 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-green-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                <Briefcase className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-2">
                What role are you looking for?
              </h3>
              <p className="text-slate-400">Choose the type of opportunity you're interested in</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { value: 'internship', label: 'Internship', icon: '🎓' },
                { value: 'fulltime', label: 'Full-time', icon: '💼' },
                { value: 'both', label: 'Both', icon: '🚀' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRoleType(option.value as any)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    roleType === option.value
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-emerald-500/50 bg-slate-800/30'
                  }`}
                >
                  <div className="text-4xl mb-2">{option.icon}</div>
                  <div className="text-lg font-semibold text-slate-100">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div className="text-center">
              <div className="bg-orange-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/30">
                <Code className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-2">
                Which technologies interest you?
              </h3>
              <p className="text-slate-400">
                Select from 200+ technologies or type your own
              </p>
            </div>

            {techInterests.length > 0 && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-xs text-emerald-400 font-medium mb-2">
                  Selected ({techInterests.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {techInterests.map((tech) => (
                    <button
                      key={tech}
                      onClick={() => toggleTechInterest(tech)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                    >
                      {tech}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomKeyword();
                  }
                }}
                placeholder="Search technologies or type custom keyword..."
                className="w-full pl-10 pr-20 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-500"
              />
              {techSearch.trim() && !ALL_TECH_KEYWORDS.some(k => k.toLowerCase() === techSearch.trim().toLowerCase()) && (
                <button
                  onClick={handleAddCustomKeyword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"
                >
                  + Add
                </button>
              )}
            </div>

            <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredCategories.map((cat) => {
                const isExpanded = expandedCategories.includes(cat.name) || techSearch.trim().length > 0;
                const selectedInCat = cat.keywords.filter(k => techInterests.includes(k)).length;
                return (
                  <div key={cat.name} className="border border-slate-700/50 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat.name)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {cat.name}
                        {selectedInCat > 0 && (
                          <span className="ml-2 text-xs text-emerald-400">
                            ({selectedInCat} selected)
                          </span>
                        )}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 py-3 flex flex-wrap gap-2">
                        {cat.keywords.map((tech) => (
                          <button
                            key={tech}
                            onClick={() => toggleTechInterest(tech)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              techInterests.includes(tech)
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                            }`}
                          >
                            {tech}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredCategories.length === 0 && techSearch.trim() && (
                <div className="text-center py-6 text-slate-400">
                  <p className="text-sm">No matching technologies found.</p>
                  <p className="text-xs mt-1">Press Enter to add "{techSearch.trim()}" as a custom keyword.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-teal-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-teal-500/30">
                <MapPin className="w-8 h-8 text-teal-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-2">Preferred work mode?</h3>
              <p className="text-slate-400">Choose your ideal work environment</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {WORK_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => toggleWorkMode(mode.value)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    preferredModes.includes(mode.value)
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-emerald-500/50 bg-slate-800/30'
                  }`}
                >
                  <div className="text-4xl mb-2">{mode.icon}</div>
                  <div className="text-lg font-semibold text-slate-100">{mode.label}</div>
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700/50"
      >
        {!isProcessing && (
          <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-100">Set Up Your Job Preferences</h2>
              <div className="flex items-center space-x-2 mt-2">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                  <div
                    key={step}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      step <= currentStep ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        )}

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={isProcessing ? 'processing' : currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {error && !isProcessing && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {!isProcessing && (
          <div className="p-6 border-t border-slate-700/50 flex items-center justify-between">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={loading}
                className="px-6 py-2 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}

            <div className="flex-1" />

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={loading || (currentStep === 1 && !resumeFile)}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-emerald-500/25"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading || preferredModes.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center space-x-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete Setup</span>
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
