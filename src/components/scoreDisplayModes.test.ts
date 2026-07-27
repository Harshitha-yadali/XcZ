import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ScoreDeltaDisplay from './ScoreDeltaDisplay';
import { Parameter16ScoreDisplay } from './Parameter16ScoreDisplay';

const result = {
  beforeScore: {
    overallScore: 56,
    matchBand: 'Fair Match',
    interviewProbability: 'Moderate',
  },
  afterScore: {
    overallScore: 78,
    matchBand: 'Good Match',
    interviewProbability: 'High',
  },
  parameterDeltas: [{
    id: 4,
    name: 'Hard Skills',
    category: 'JD Alignment',
    beforeScore: 4,
    afterScore: 8,
    beforePercentage: 44,
    afterPercentage: 88,
    delta: 44,
    improved: true,
    fixable: true,
  }],
  categoryDeltas: [{
    name: 'JD Alignment',
    beforePercentage: 35,
    afterPercentage: 85,
    delta: 50,
    weight: 30,
  }],
  gapClassification: { userActionCards: [] },
  totalChanges: [],
  iterations: [],
  reachedTarget: false,
  processingTimeMs: 0,
} as any;

describe('Quick, Smart, and Deep score presentation', () => {
  it('shows no numeric score or comparison for Quick', () => {
    const html = renderToStaticMarkup(React.createElement(ScoreDeltaDisplay, {
      result,
      mode: 'quick',
    }));

    expect(html).toContain('Quick Rewrite Complete');
    expect(html).toContain('Optimization Findings');
    expect(html).not.toContain('Before Optimization');
    expect(html).not.toContain('After Optimization');
    expect(html).not.toContain('ATS points');
    expect(html).not.toContain('56');
    expect(html).not.toContain('78');
    expect(html).not.toContain('44%');
    expect(html).not.toContain('88%');
    expect(html).not.toContain('/100');
  });

  it.each(['smart', 'deep'])('shows canonical Before and After scores for %s', () => {
    const html = renderToStaticMarkup(React.createElement(ScoreDeltaDisplay, {
      result,
      mode: 'comparison',
    }));

    expect(html).toContain('Before Optimization');
    expect(html).toContain('After Optimization');
    expect(html).toContain('56');
    expect(html).toContain('78');
    expect(html).toContain('ATS points');
  });

  it('keeps the Quick fallback score-free', () => {
    const html = renderToStaticMarkup(React.createElement(Parameter16ScoreDisplay, {
      mode: 'quick',
      compact: true,
      overallBefore: 56,
      overallAfter: 78,
      beforeScores: [{
        parameter: 'Hard Skills',
        parameterNumber: 4,
        score: 4,
        maxScore: 10,
        percentage: 40,
        suggestions: ['Add relevant supported skills.'],
      }],
    }));

    expect(html).toContain('Quick Rewrite Complete');
    expect(html).toContain('Hard Skills');
    expect(html).not.toContain('56%');
    expect(html).not.toContain('78%');
    expect(html).not.toContain('40%');
    expect(html).not.toContain('Before');
    expect(html).not.toContain('After');
  });
});
