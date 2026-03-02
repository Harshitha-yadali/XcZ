import { ParameterScore } from './jdScoringEngine';

export interface GapItem {
  parameterId: number;
  parameterName: string;
  category: string;
  currentScore: number;
  maxScore: number;
  percentage: number;
  fixType: 'ai' | 'user_input' | 'none';
  suggestions: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface UserActionCard {
  parameterId: number;
  title: string;
  description: string;
  actionRequired: string;
  impact: string;
  priority: 'critical' | 'high' | 'medium';
}

export interface GapClassification {
  fixableGaps: GapItem[];
  nonFixableGaps: GapItem[];
  userActionCards: UserActionCard[];
  totalGaps: number;
  fixableImpact: number;
  projectedScoreAfterFix: number;
}

const THRESHOLD = 80;

function getPriority(percentage: number, category: string): 'critical' | 'high' | 'medium' | 'low' {
  if (category === 'Advanced Diagnostics') return 'low';
  if (percentage < 30) return 'critical';
  if (percentage < 50) return 'high';
  if (percentage < THRESHOLD) return 'medium';
  return 'low';
}

function buildUserActionCard(gap: GapItem): UserActionCard {
  const actionMap: Record<number, { title: string; description: string; actionRequired: string; impact: string }> = {
    17: {
      title: 'Years of Experience Gap',
      description: 'The job requires more years of experience than your resume shows.',
      actionRequired: 'Add any missing internships, freelance work, or relevant project experience to bridge the gap.',
      impact: 'Can significantly improve your Experience Alignment score.',
    },
    18: {
      title: 'Seniority Level Mismatch',
      description: 'Your role titles don\'t reflect the seniority level this job requires.',
      actionRequired: 'Update your most recent role title to better match the target seniority (if accurate). Highlight leadership or ownership responsibilities.',
      impact: 'Improves role-title based ATS matching.',
    },
    19: {
      title: 'Project Domain Gap',
      description: 'Your projects don\'t demonstrate enough skills relevant to this job description.',
      actionRequired: 'Add a project that uses the key technologies from this job, or update existing project descriptions to highlight relevant skills.',
      impact: 'Boosts Project Relevance score substantially.',
    },
    20: {
      title: 'Tech Stack Missing from Projects',
      description: 'Your project tech stacks don\'t include the tools required by this job.',
      actionRequired: 'Add the required technologies to your project tech stack lists where you actually used them.',
      impact: 'Directly improves tech stack relevance scoring.',
    },
    23: {
      title: 'Skills Not Aligned to JD',
      description: 'Your skills list contains too few role-relevant skills for this JD.',
      actionRequired: 'Replace unrelated skills with JD-required skills you truly know, and map them to projects/experience.',
      impact: 'Improves Skills Quality and Keyword Alignment together.',
    },
    28: {
      title: 'Industry Keywords Still Low',
      description: 'Keywords are present but not sufficiently reflected in real project/experience context.',
      actionRequired: 'Add 2-3 JD domain keywords into project bullets and one experience bullet with real outcomes.',
      impact: 'Raises Industry Keyword Coverage and shortlist confidence.',
    },
  };

  const mapped = actionMap[gap.parameterId];
  if (mapped) {
    return {
      parameterId: gap.parameterId,
      ...mapped,
      priority: gap.priority === 'low' ? 'medium' : gap.priority === 'critical' ? 'critical' : gap.priority,
    };
  }

  return {
    parameterId: gap.parameterId,
    title: `${gap.parameterName} Needs Improvement`,
    description: gap.suggestions[0] || 'This parameter needs manual attention.',
    actionRequired: 'Review and manually improve this section of your resume.',
    impact: 'Will improve your overall ATS score.',
    priority: gap.priority === 'low' ? 'medium' : gap.priority === 'critical' ? 'critical' : gap.priority,
  };
}

export function classifyGaps(
  parameters: ParameterScore[],
  _currentOverallScore: number
): GapClassification {
  const gaps = parameters.filter(p => p.percentage < THRESHOLD);

  const fixableGaps: GapItem[] = [];
  const nonFixableGaps: GapItem[] = [];

  gaps.forEach(p => {
    const gap: GapItem = {
      parameterId: p.id,
      parameterName: p.name,
      category: p.category,
      currentScore: p.score,
      maxScore: p.maxScore,
      percentage: p.percentage,
      fixType: p.fixType,
      suggestions: p.suggestions,
      priority: getPriority(p.percentage, p.category),
    };

    if (p.fixable && p.fixType === 'ai') {
      fixableGaps.push(gap);
    } else {
      nonFixableGaps.push(gap);
    }
  });

  fixableGaps.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  nonFixableGaps.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const nonFixableActionCards = nonFixableGaps
    .filter(g => g.priority !== 'low')
    .map(buildUserActionCard);
  const userActionCards = nonFixableActionCards;

  let fixableImpact = 0;
  fixableGaps.forEach(g => {
    const potentialGain = g.maxScore - g.currentScore;
    fixableImpact += potentialGain;
  });

  const totalMaxScore = parameters.reduce((s, p) => s + p.maxScore, 0);
  const currentTotalScore = parameters.reduce((s, p) => s + p.score, 0);
  const projectedTotal = currentTotalScore + fixableImpact * 0.8;
  const projectedScoreAfterFix = Math.min(
    Math.round((projectedTotal / totalMaxScore) * 100),
    98
  );

  return {
    fixableGaps,
    nonFixableGaps,
    userActionCards,
    totalGaps: gaps.length,
    fixableImpact: Math.round((fixableImpact / totalMaxScore) * 100),
    projectedScoreAfterFix,
  };
}
