/**
 * Enhanced JD-Based Resume Optimizer Service
 * Uses 220+ metrics framework for gap analysis and optimization
 * TARGET: 90%+ ATS Score on all metrics
 * 
 * NOW INTEGRATED WITH GEMINI SERVICE (EdenAI + GPT-4o-mini) for AI-powered optimization
 */

import {
  ResumeData,
  UserType,
} from '../types/resume';

import {
  OptimizationMode,
  OptimizationResult,
  GapAnalysisResult,
  TierComparison,
  Big5Improvement,
  SectionChange,
} from '../types/optimizer';

import { GapAnalyzerService } from './gapAnalyzerService';
import { optimizeResume as geminiOptimizeResume } from './geminiService';
import { validateAndRepairResume, type EvidenceViolation } from './resumeEvidenceValidator';
import { CanonicalJdScoringService, type CanonicalScoreContext } from './canonicalJdScoringService';
import { mapCanonicalToEnhancedScore } from './canonicalScoreMapper';
import { applyCandidateBoost, confirmedDetailsBlock, hasBoost, type CandidateBoost } from './candidateBoost';
import type { JdOptimizationTierId } from '../config/jdOptimizationTiers';

// ============================================================================
// USER ACTION REQUIRED TYPES
// ============================================================================

export interface UserActionRequired {
  category: 'keywords' | 'skills' | 'experience' | 'quantification' | 'grammar' | 'certifications' | 'projects';
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  currentScore: number;
  targetScore: number;
  suggestions: string[];
  canAutoFix: boolean;
}

// ============================================================================
// ENHANCED JD OPTIMIZER SERVICE
// ============================================================================

export class EnhancedJdOptimizerService {
  /**
   * Main optimization method - optimizes resume based on JD
   */
  static async optimizeResume(
    resumeData: ResumeData,
    resumeText: string,
    jobDescription: string,
    _targetRole: string,
    mode: OptimizationMode = 'standard',
    modelOverride?: string,
    runId?: string,
    candidateTypeOverride?: UserType,
    boost?: CandidateBoost | null,
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    const userType: UserType = candidateTypeOverride || this.detectUserType(resumeData);
    const optimizationTier: JdOptimizationTierId = mode === 'light' ? 'quick' : mode === 'standard' ? 'smart' : 'deep';

    // Step 1: Analyze gaps using the canonical PrimoBoost JD score.
    const gapAnalysis = await GapAnalyzerService.analyzeGaps(resumeData, resumeText, jobDescription, {
      candidateType: userType,
      optimizationTier,
      runId,
    });
    const beforeScore = gapAnalysis.beforeScore;

    // Step 2: Create optimized resume copy
    let optimizedResume = JSON.parse(JSON.stringify(resumeData)) as ResumeData;
    const changes: SectionChange[] = [];
    
    // Store 16-parameter scores for the result
    let parameter16Scores: {
      beforeScores?: any[];
      afterScores?: any[];
      overallBefore?: number;
      overallAfter?: number;
      improvement?: number;
    } | undefined;
    let evidenceViolations: EvidenceViolation[] = [];

    // ========================================================================
    // STEP 1: Use Gemini Service (EdenAI + GPT-4o-mini) for AI-powered optimization
    // ========================================================================
    
    try {
      // Detect user type based on experience
      // Convert resume to text for AI processing
      // Details the candidate confirmed in the Boost step are resume content the writer may use.
      const resumeTextForAI = hasBoost(boost)
        ? `${this.resumeDataToText(resumeData)}

${confirmedDetailsBlock(boost)}`
        : this.resumeDataToText(resumeData);
      
      // Every paid tier rewrites the full resume. Quick uses one basic Gemini
      // Flash pass; Smart and Deep add their additional refinement stages.
      optimizedResume = await geminiOptimizeResume(
        resumeTextForAI,
        jobDescription,
        userType,
        resumeData.name,
        undefined, // _logStart
        resumeData.email,
        resumeData.phone,
        resumeData.linkedin,
        resumeData.github,
        resumeData.linkedin,
        resumeData.github,
        _targetRole || resumeData.targetRole,
        undefined,
        undefined,
        modelOverride,
        mode,
      );
      
      // CRITICAL: Preserve original skills if AI didn't return any
      if ((!optimizedResume.skills || optimizedResume.skills.length === 0) && 
          resumeData.skills && resumeData.skills.length > 0) {
        optimizedResume.skills = resumeData.skills;
      }
      
      // CRITICAL: Preserve original projects if AI didn't return any
      if ((!optimizedResume.projects || optimizedResume.projects.length === 0) && 
          resumeData.projects && resumeData.projects.length > 0) {
        optimizedResume.projects = resumeData.projects;
      }
      
      // CRITICAL: Preserve original work experience if AI didn't return any
      if ((!optimizedResume.workExperience || optimizedResume.workExperience.length === 0) && 
          resumeData.workExperience && resumeData.workExperience.length > 0) {
        optimizedResume.workExperience = resumeData.workExperience;
      }
      
      // Also preserve other sections if AI missed them
      if ((!optimizedResume.education || optimizedResume.education.length === 0) && 
          resumeData.education && resumeData.education.length > 0) {
        optimizedResume.education = resumeData.education;
      }
      
      if ((!optimizedResume.certifications || optimizedResume.certifications.length === 0) && 
          resumeData.certifications && resumeData.certifications.length > 0) {
        optimizedResume.certifications = resumeData.certifications;
      }
      
      changes.push({
        section: 'full_resume',
        changeType: 'rewritten',
        description: mode === 'light'
          ? '[Quick Optimization] Full resume rewritten with one basic job-specific pass.'
          : '[AI Optimization] Full resume rewritten for the job description.',
      });
    } catch (rewriteError) {
      console.error(`JD optimization failed (${modelOverride || 'default model'}):`, rewriteError);
      throw new Error('The selected AI model could not complete this optimization. No credits were charged. Please try again.');
    }

    // The before score stays on the resume as uploaded; confirmed details are
    // allowed evidence for the rewrite and are always written into it.
    const evidenceValidation = validateAndRepairResume(applyCandidateBoost(resumeData, boost), optimizedResume);
    optimizedResume = applyCandidateBoost(evidenceValidation.resume, boost);
    evidenceViolations = evidenceValidation.violations;

    // Step 4: Calculate after score
    const afterContext: CanonicalScoreContext = optimizationTier === 'quick'
      ? 'quick_scan'
      : `${optimizationTier}_after` as CanonicalScoreContext;
    const afterCanonical = await CanonicalJdScoringService.score({
      resumeData: optimizedResume,
      jobDescription,
      candidateType: userType,
      context: afterContext,
      runId,
    });
    const afterScore = mapCanonicalToEnhancedScore(afterCanonical.scoreResult, optimizedResume);

    // Step 5: Identify user actions required
    const scoreBasedActions = this.identifyUserActionsRequired(afterScore, gapAnalysis, jobDescription, optimizedResume);
    const evidenceActions: UserActionRequired[] = evidenceViolations.length > 0 ? [{
      category: 'experience',
      priority: 'high',
      title: 'Candidate evidence required',
      description: 'Some proposed improvements were excluded because the original resume did not support them.',
      currentScore: 0,
      targetScore: 100,
      suggestions: [...new Set(evidenceViolations.map((violation) => violation.message))].slice(0, 5),
      canAutoFix: false,
    }] : [];
    const userActionsRequired = [...evidenceActions, ...scoreBasedActions];

    // Step 6: Build comparisons
    const tierComparison = this.buildTierComparison(beforeScore.tier_scores, afterScore.tier_scores);
    const big5Improvements = this.buildBig5Improvements(beforeScore.critical_metrics, afterScore.critical_metrics, changes);

    // Step 7: Identify fixed red flags
    const redFlagsFixed = beforeScore.red_flags
      .filter(rf => !afterScore.red_flags.some(arf => arf.id === rf.id))
      .map(rf => rf.name);
    const redFlagsRemaining = afterScore.red_flags.map(rf => rf.name);

    // Step 8: Calculate keyword improvements
    const keywordsAdded = changes
      .filter(c => c.changeType === 'added' && c.section === 'skills')
      .map(c => c.description.replace('Added keyword: ', '').replace(' (JD requirement)', ''));

    const processingTime = Date.now() - startTime;

    return {
      optimizedResume,
      beforeScore,
      afterScore,
      scoreImprovement: afterScore.overall - beforeScore.overall,
      tierComparison,
      big5Improvements,
      changesBySection: changes,
      totalChanges: changes.length,
      keywordsAdded,
      keywordMatchBefore: beforeScore.missing_keywords_enhanced.length > 0 
        ? 100 - (beforeScore.missing_keywords_enhanced.length * 5) 
        : 100,
      keywordMatchAfter: afterScore.missing_keywords_enhanced.length > 0
        ? 100 - (afterScore.missing_keywords_enhanced.length * 5)
        : 100,
      redFlagsFixed,
      redFlagsRemaining,
      optimizationMode: mode,
      processingTime,
      userActionsRequired,
      // NEW: Include 16-parameter scores
      parameter16Scores,
    };
  }

  // ============================================================================
  // User Actions Required
  // ============================================================================

  private static identifyUserActionsRequired(
    afterScore: any,
    _gapAnalysis: GapAnalysisResult,
    jobDescription: string,
    resume: ResumeData
  ): UserActionRequired[] {
    const actions: UserActionRequired[] = [];
    const criticalMetrics = afterScore.critical_metrics;

    // Only show suggestions if scores are still low after optimization
    if (criticalMetrics.quantified_results_presence.percentage < 60) {
      actions.push({
        category: 'quantification',
        priority: 'medium',
        title: 'Add More Metrics',
        description: 'Consider adding more specific numbers to your experience.',
        currentScore: criticalMetrics.quantified_results_presence.percentage,
        targetScore: 90,
        suggestions: ['Add specific percentages', 'Include team sizes', 'Mention cost savings'],
        canAutoFix: false,
      });
    }

    if (criticalMetrics.experience_relevance.percentage < 70) {
      actions.push({
        category: 'experience',
        priority: 'high',
        title: 'Improve Experience Relevance',
        description: 'Your experience needs more alignment with job requirements.',
        currentScore: criticalMetrics.experience_relevance.percentage,
        targetScore: 90,
        suggestions: ['Add job-specific achievements', 'Include relevant metrics'],
        canAutoFix: false,
      });
    }

    return actions.sort((a, b) => {
      const priority = { critical: 0, high: 1, medium: 2 };
      return priority[a.priority] - priority[b.priority];
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Detect user type based on resume content
   */
  private static detectUserType(resume: ResumeData): UserType {
    const workExpCount = resume.workExperience?.length || 0;
    const hasInternships = resume.workExperience?.some(exp => 
      exp.role?.toLowerCase().includes('intern') || 
      exp.company?.toLowerCase().includes('intern')
    );
    
    // Check for years of experience
    let totalYears = 0;
    resume.workExperience?.forEach(exp => {
      if (exp.year) {
        const yearMatch = exp.year.match(/(\d{4})/g);
        if (yearMatch && yearMatch.length >= 2) {
          totalYears += parseInt(yearMatch[1]) - parseInt(yearMatch[0]);
        }
      }
    });
    
    // Determine user type
    if (totalYears >= 3 || workExpCount >= 2) {
      return 'experienced';
    } else if (hasInternships || workExpCount === 1) {
      return 'fresher';
    } else {
      return 'student';
    }
  }

  private static resumeDataToText(resume: ResumeData): string {
    const parts: string[] = [];
    
    parts.push(`${resume.name}\n${resume.email} | ${resume.phone}`);
    
    if (resume.summary) {
      parts.push(`\nSUMMARY\n${resume.summary}`);
    }
    
    if (resume.skills) {
      parts.push('\nSKILLS');
      resume.skills.forEach(s => {
        parts.push(`${s.category}: ${s.list.join(', ')}`);
      });
    }
    
    if (resume.workExperience) {
      parts.push('\nEXPERIENCE');
      resume.workExperience.forEach(exp => {
        parts.push(`${exp.role} at ${exp.company} (${exp.year})`);
        exp.bullets?.forEach(b => parts.push(`• ${b}`));
      });
    }
    
    if (resume.projects) {
      parts.push('\nPROJECTS');
      resume.projects.forEach(proj => {
        parts.push(proj.title);
        proj.bullets?.forEach(b => parts.push(`• ${b}`));
      });
    }
    
    if (resume.education) {
      parts.push('\nEDUCATION');
      resume.education.forEach(edu => {
        parts.push(`${edu.degree} - ${edu.school} (${edu.year})`);
      });
    }
    
    if (resume.certifications && resume.certifications.length > 0) {
      parts.push('\nCERTIFICATIONS');
      resume.certifications.forEach(cert => {
        const certText = typeof cert === 'string' ? cert : ((cert as any).title || '');
        if (certText) parts.push(`• ${certText}`);
      });
    }
    
    return parts.join('\n');
  }

  private static buildTierComparison(beforeTiers: any, afterTiers: any): TierComparison[] {
    const comparisons: TierComparison[] = [];
    
    const tierKeys = [
      'basic_structure', 'content_structure', 'experience',
      'education', 'certifications', 'skills_keywords', 'projects',
      'red_flags', 'competitive', 'culture_fit', 'qualitative'
    ];

    tierKeys.forEach((key, index) => {
      const before = beforeTiers[key];
      const after = afterTiers[key];
      
      if (before && after) {
        comparisons.push({
          tierNumber: index + 1,
          tierName: before.tier_name || key,
          beforeScore: before.percentage || 0,
          afterScore: after.percentage || 0,
          improvement: (after.percentage || 0) - (before.percentage || 0),
          metricsImproved: (after.metrics_passed || 0) - (before.metrics_passed || 0),
        });
      }
    });

    return comparisons;
  }

  private static buildBig5Improvements(
    beforeMetrics: any,
    afterMetrics: any,
    changes: SectionChange[]
  ): Big5Improvement[] {
    const metrics = [
      { key: 'jd_keywords_match', name: 'JD Keywords Match' },
      { key: 'technical_skills_alignment', name: 'Technical Skills Alignment' },
      { key: 'quantified_results_presence', name: 'Quantified Results' },
      { key: 'job_title_relevance', name: 'Job Title Relevance' },
      { key: 'experience_relevance', name: 'Experience Relevance' },
    ];

    return metrics.map(m => {
      const before = beforeMetrics?.[m.key] || { score: 0 };
      const after = afterMetrics?.[m.key] || { score: 0 };
      
      return {
        metric: m.key,
        metricName: m.name,
        beforeScore: before.score || 0,
        afterScore: after.score || 0,
        improvement: (after.score || 0) - (before.score || 0),
        changesApplied: changes
          .filter(c => this.changeAffectsMetric(c, m.key))
          .map(c => c.description),
      };
    });
  }

  private static changeAffectsMetric(change: SectionChange, metric: string): boolean {
    const metricSectionMap: Record<string, string[]> = {
      jd_keywords_match: ['skills', 'experience'],
      technical_skills_alignment: ['skills'],
      quantified_results_presence: ['experience'],
      job_title_relevance: ['experience', 'summary'],
      experience_relevance: ['experience'],
    };
    
    return metricSectionMap[metric]?.includes(change.section) || false;
  }
}

export default EnhancedJdOptimizerService;
