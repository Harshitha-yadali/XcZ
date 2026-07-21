import type {
  CriticalMetricScore,
  EnhancedComprehensiveScore,
  MatchBand,
  ResumeData,
  TierScore,
  TierScores,
} from '../types/resume';
import type { CategoryScore, JDScoringResult, ParameterScore } from './jdScoringEngine';

const percentageFor = (result: JDScoringResult, names: string[]): number => {
  const categories = names
    .map((name) => result.categories.find((category) => category.name === name))
    .filter(Boolean) as CategoryScore[];
  if (!categories.length) return result.overallScore;
  const weight = categories.reduce((sum, category) => sum + Math.max(1, category.weight), 0);
  return Math.round(categories.reduce((sum, category) => sum + category.percentage * Math.max(1, category.weight), 0) / weight);
};

const tier = (
  tierNumber: number,
  tierName: string,
  percentage: number,
  weight: number,
  parameters: ParameterScore[],
): TierScore => ({
  tier_number: tierNumber,
  tier_name: tierName,
  score: Math.round(percentage),
  max_score: 100,
  percentage: Math.round(percentage),
  weight,
  weighted_contribution: Math.round((percentage * weight) / 100),
  metrics_passed: parameters.filter((parameter) => parameter.percentage >= 80).length,
  metrics_total: parameters.length,
  top_issues: parameters
    .filter((parameter) => parameter.percentage < 80)
    .flatMap((parameter) => parameter.suggestions.length ? parameter.suggestions : [`Improve ${parameter.name}`])
    .slice(0, 5),
});

const criticalMetric = (parameters: ParameterScore[], ids: number[], maxScore: number): CriticalMetricScore => {
  const selected = ids.map((id) => parameters.find((parameter) => parameter.id === id)).filter(Boolean) as ParameterScore[];
  const percentage = selected.length
    ? Math.round(selected.reduce((sum, parameter) => sum + parameter.percentage, 0) / selected.length)
    : 0;
  return {
    score: Math.round((percentage / 100) * maxScore),
    max_score: maxScore,
    percentage,
    status: percentage >= 85 ? 'excellent' : percentage >= 70 ? 'good' : percentage >= 50 ? 'fair' : 'poor',
    details: selected.flatMap((parameter) => parameter.suggestions).slice(0, 2).join(' ') || 'Measured by the canonical JD rules engine.',
  };
};

/** Maps canonical diagnostics into legacy UI shapes without recalculating the official score. */
export function mapCanonicalToEnhancedScore(
  result: JDScoringResult,
  resume: ResumeData,
): EnhancedComprehensiveScore {
  const paramsFor = (categories: string[]) => result.parameters.filter((parameter) => categories.includes(parameter.category));
  const basicPct = percentageFor(result, ['ATS Compatibility', 'Profile Completeness']);
  const experiencePct = percentageFor(result, ['Impact & Metrics', 'Experience Alignment']);
  const skillsPct = percentageFor(result, ['Keyword Alignment', 'Skills Quality']);
  const projectsPct = percentageFor(result, ['Project Relevance', 'Project Quality']);
  const educationPct = resume.education?.length ? 100 : 0;
  const certificationPct = resume.certifications?.length ? 100 : 40;

  const tierScores: TierScores = {
    basic_structure: tier(1, 'Basic Structure', basicPct, 8, paramsFor(['ATS Compatibility'])),
    content_structure: tier(2, 'Content Structure', basicPct, 10, paramsFor(['ATS Compatibility', 'Profile Completeness'])),
    experience: tier(3, 'Experience', experiencePct, 25, paramsFor(['Impact & Metrics', 'Experience Alignment'])),
    education: tier(4, 'Education', educationPct, 6, []),
    certifications: tier(5, 'Certifications', certificationPct, 4, []),
    skills_keywords: tier(6, 'Skills & Keywords', skillsPct, 25, paramsFor(['Keyword Alignment', 'Skills Quality'])),
    projects: tier(7, 'Projects', projectsPct, 8, paramsFor(['Project Relevance', 'Project Quality'])),
    red_flags: tier(7, 'Red Flags', basicPct, 0, paramsFor(['ATS Compatibility'])),
    competitive: tier(8, 'Competitive', result.overallScore, 6, result.parameters),
    culture_fit: tier(9, 'Culture Fit', result.overallScore, 4, []),
    qualitative: tier(10, 'Qualitative', experiencePct, 4, paramsFor(['Impact & Metrics'])),
  };

  const jdKeywords = criticalMetric(result.parameters, [6, 7, 8, 10, 28], 5);
  const technicalSkills = criticalMetric(result.parameters, [6, 7, 20, 22, 23], 5);
  const quantified = criticalMetric(result.parameters, [11, 26], 3);
  const title = criticalMetric(result.parameters, [9, 18], 3);
  const experience = criticalMetric(result.parameters, [17, 18], 3);

  return {
    overall: result.overallScore,
    match_band: result.matchBand as MatchBand,
    interview_probability_range: result.interviewProbability,
    confidence: 'High',
    rubric_version: 'pb-jd-v2.0.0',
    weighting_mode: 'JD',
    extraction_mode: 'TEXT',
    trimmed: false,
    breakdown: result.parameters.map((parameter) => ({
      key: `canonical_p${parameter.id}`,
      name: parameter.name,
      weight_pct: 0,
      score: parameter.score,
      max_score: parameter.maxScore,
      contribution: parameter.percentage,
      details: parameter.suggestions.join(' '),
    })),
    missing_keywords: [],
    actions: result.parameters.filter((parameter) => parameter.percentage < 80).flatMap((parameter) => parameter.suggestions).slice(0, 10),
    example_rewrites: {},
    notes: [
      'Official score calculated by the PrimoBoost canonical JD rules engine.',
      `Career-level scoring profile: ${result.scoringProfile}.`,
    ],
    analysis: `Canonical JD Match Score: ${result.overallScore}/100 using ${result.scoringProfile}.`,
    keyStrengths: result.parameters.filter((parameter) => parameter.percentage >= 80).map((parameter) => parameter.name).slice(0, 5),
    improvementAreas: result.parameters.filter((parameter) => parameter.percentage < 80).map((parameter) => parameter.name).slice(0, 5),
    recommendations: result.parameters.filter((parameter) => parameter.percentage < 80).flatMap((parameter) => parameter.suggestions).slice(0, 10),
    tier_scores: tierScores,
    critical_metrics: {
      jd_keywords_match: jdKeywords,
      technical_skills_alignment: technicalSkills,
      quantified_results_presence: quantified,
      job_title_relevance: title,
      experience_relevance: experience,
      total_critical_score: jdKeywords.score + technicalSkills.score + quantified.score + title.score + experience.score,
    },
    red_flags: [],
    red_flag_penalty: 0,
    auto_reject_risk: false,
    missing_keywords_enhanced: [],
    section_order_issues: [],
    format_issues: [],
  };
}
