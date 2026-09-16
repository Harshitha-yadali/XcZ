import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JD_OPTIMIZATION_TIERS, getJdOptimizationTier } from './jdOptimizationTiers';
import { OPTIMIZATION_MODES } from '../types/optimizer';

const repoFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

/**
 * jdOptimizationTiers.test.ts asserts the tier config matches its own expected
 * values. That is not the same as asserting the runtime honours those values.
 *
 * A user pays 19 / 49 / 99 rupees for Quick / Smart / Deep. These tests pin the
 * levers that actually change what the AI does, so a refactor cannot silently
 * collapse two paid tiers onto identical behaviour the way commit cd6c63f did.
 */
describe('JD optimization tiers — runtime differentiators', () => {
  it('gives each tier a distinct model, and never more passes than the tier above', () => {
    const quick = getJdOptimizationTier('quick');
    const smart = getJdOptimizationTier('smart');
    const deep = getJdOptimizationTier('deep');

    expect(new Set([quick.modelId, smart.modelId, deep.modelId]).size).toBe(3);
    expect(quick.aiPasses).toBeLessThanOrEqual(smart.aiPasses);
    expect(smart.aiPasses).toBeLessThan(deep.aiPasses);
  });

  /**
   * Quick and Smart now run the same number of passes, so pass count alone no
   * longer separates them. These are the differentiators that remain, and the
   * price gap rests on them: a cheaper model, the 'light' mode that skips the
   * 16-parameter rewrite, and no project analysis.
   */
  it('keeps Quick below Smart on model, mode, and project analysis', () => {
    const quick = getJdOptimizationTier('quick');
    const smart = getJdOptimizationTier('smart');

    expect(quick.modelId).not.toBe(smart.modelId);
    expect(quick.mode).toBe('light');
    expect(smart.mode).not.toBe('light');
    expect(quick.projectAnalysis).toBe(false);
    expect(smart.projectAnalysis).toBe(true);
  });

  it('maps each tier onto a distinct optimization mode', () => {
    // `mode` is the only tier field the optimizer service branches on.
    const modes = JD_OPTIMIZATION_TIERS.map((tier) => tier.mode);
    expect(modes).toEqual(['light', 'standard', 'aggressive']);
    expect(new Set(modes).size).toBe(3);
  });

  it('routes refinement passes through the tier model, one entry per extra pass', () => {
    for (const tier of JD_OPTIMIZATION_TIERS) {
      expect(tier.refinementModels).toHaveLength(tier.aiPasses - 1);
      expect(tier.refinementModels.every((model) => model === tier.modelId)).toBe(true);
    }
  });

  it('keeps Quick on the cheap single pass and skips the 16-parameter rewrite', () => {
    // enhancedJdOptimizerService gates the heavy rewrite behind `mode !== 'light'`.
    // Quick is the only 'light' tier, so this is what the price gap buys.
    const source = repoFile('src/services/enhancedJdOptimizerService.ts');
    expect(source).toContain("if (mode !== 'light')");
    expect(getJdOptimizationTier('quick').mode).toBe('light');
    expect(getJdOptimizationTier('smart').mode).not.toBe('light');
    expect(getJdOptimizationTier('deep').mode).not.toBe('light');
  });

  it('honours maxLoops and modelSequence in the optimization loop', () => {
    const source = repoFile('src/services/optimizationLoopController.ts');
    expect(source).toContain('options.maxLoops');
    expect(source).toContain('options.modelSequence');
    expect(source).toMatch(/for \(let loop = 0; loop < maxLoops; loop\+\+\)/);
  });

  it('keeps the loop ceiling above the highest tier so Deep is never clamped to Smart', () => {
    // optimizationLoopController clamps with Math.min(MAX_LOOPS, options.maxLoops).
    // Deep requests aiPasses - 1 refinement loops. If MAX_LOOPS ever drops below
    // that, Deep silently degrades to Smart output while still charging Deep prices.
    const source = repoFile('src/services/optimizationLoopController.ts');
    const declared = source.match(/const MAX_LOOPS = (\d+)/);
    expect(declared).not.toBeNull();

    const maxLoops = Number(declared![1]);
    const deepRefinementLoops = getJdOptimizationTier('deep').aiPasses - 1;
    expect(maxLoops).toBeGreaterThanOrEqual(deepRefinementLoops);
  });

  it('passes tier mode, model, and passes from the optimizer component', () => {
    const source = repoFile('src/components/ResumeOptimizer.tsx');
    expect(source).toContain('qualityTier.mode');
    expect(source).toContain('qualityTier.modelId');
    expect(source).toContain('qualityTier.aiPasses - 1');
    expect(source).toContain('qualityTier.refinementModels');
  });

  /**
   * REGRESSION GUARD — these two OPTIMIZATION_MODES fields differ per mode but
   * are read nowhere in src/. They are the natural place to express "Deep makes
   * more changes than Smart", and today they express nothing. If someone wires
   * them up, delete this test. If nobody does, it documents why Smart and Deep
   * produce structurally identical output.
   */
  it('documents that maxChangesPerSection and restructureSections are inert', () => {
    expect(OPTIMIZATION_MODES.light.maxChangesPerSection).toBe(2);
    expect(OPTIMIZATION_MODES.standard.maxChangesPerSection).toBe(5);
    expect(OPTIMIZATION_MODES.aggressive.maxChangesPerSection).toBe(10);
    expect(OPTIMIZATION_MODES.aggressive.restructureSections).toBe(true);
    expect(OPTIMIZATION_MODES.standard.restructureSections).toBe(false);

    const optimizerSource = repoFile('src/services/enhancedJdOptimizerService.ts');
    const rewriterSource = repoFile('src/services/fullResumeRewriter16ParameterService.ts');
    for (const source of [optimizerSource, rewriterSource]) {
      expect(source).not.toContain('maxChangesPerSection');
      expect(source).not.toContain('restructureSections');
    }
  });

  /**
   * The pricing modal advertises per-tier capabilities. Any field it renders as
   * a differentiator must either drive runtime behaviour or be understood as a
   * label. This pins the current split so the marketing table cannot quietly
   * grow a new promise with no code behind it.
   */
  it('pins which advertised tier fields are labels rather than behaviour', () => {
    const runtimeSources = [
      repoFile('src/components/ResumeOptimizer.tsx'),
      repoFile('src/services/enhancedJdOptimizerService.ts'),
      repoFile('src/services/optimizationLoopController.ts'),
    ].join('\n');

    const labelOnlyFields = [
      'roleStrategy',
      'sectionSuggestions',
      'accuracyCheck',
      'summaryRewriting',
      'experienceRewriting',
      'projectRewriting',
      'projectAnalysis',
    ];

    for (const field of labelOnlyFields) {
      expect(runtimeSources).not.toContain(`qualityTier.${field}`);
    }
  });
});
