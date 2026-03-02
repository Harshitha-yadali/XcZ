import { openrouter } from './aiProxyService';

export interface ModerationResult {
  isSafe: boolean;
  flaggedCategories: string[];
  confidence: number;
  details?: string;
  rawResponse?: any;
}

export interface SpellCheckResult {
  correctedText: string;
  corrections: SpellCorrection[];
  hasCorrections: boolean;
  rawResponse?: any;
}

export interface SpellCorrection {
  original: string;
  corrected: string;
  offset: number;
  length: number;
  type: 'spelling' | 'grammar' | 'style';
}

export const moderateText = async (text: string): Promise<ModerationResult> => {
  if (!text || text.trim().length < 10) {
    return { isSafe: true, flaggedCategories: [], confidence: 1 };
  }

  try {
    const result = await openrouter.moderate(text);

    return {
      isSafe: !result.flagged,
      flaggedCategories: result.categories || [],
      confidence: result.flagged ? 0.3 : 0.95,
      rawResponse: result,
    };
  } catch (error: any) {
    console.error('Moderation error:', error);
    return { isSafe: true, flaggedCategories: [], confidence: 0 };
  }
};

export const spellCheck = async (text: string): Promise<SpellCheckResult> => {
  if (!text || text.trim().length < 10) {
    return { correctedText: text, corrections: [], hasCorrections: false };
  }

  try {
    const correctedText = await openrouter.spellCheck(text);
    const preserved = preserveMetrics(text, correctedText);
    const hasCorrections = preserved !== text;

    return {
      correctedText: preserved,
      corrections: [],
      hasCorrections,
    };
  } catch (error: any) {
    console.error('Spell check error:', error);
    return { correctedText: text, corrections: [], hasCorrections: false };
  }
};

const preserveMetrics = (original: string, corrected: string): string => {
  const metricPatterns: RegExp[] = [
    /\d+%/g,
    /\$[\d,]+[KMB]?/gi,
    /[\d,]+\+?/g,
    /\d+x/gi,
    /\d+\s*(?:years?|months?|weeks?|days?)/gi,
  ];

  let result = corrected;

  for (const pattern of metricPatterns) {
    const originalMatches: string[] = original.match(pattern) || [];
    const correctedMatches: string[] = result.match(pattern) || [];

    for (const origMetric of originalMatches) {
      if (!correctedMatches.includes(origMetric)) {
        const origIndex = original.indexOf(origMetric);
        const contextBefore = original.slice(Math.max(0, origIndex - 20), origIndex);
        const contextIndex = result.indexOf(contextBefore);
        if (contextIndex !== -1) {
          const searchStart = contextIndex + contextBefore.length;
          const searchEnd = Math.min(result.length, searchStart + 30);
          const searchArea = result.slice(searchStart, searchEnd);
          for (const corrMetric of correctedMatches) {
            if (searchArea.includes(corrMetric) && corrMetric !== origMetric) {
              result = result.replace(corrMetric, origMetric);
              break;
            }
          }
        }
      }
    }
  }

  return result;
};

export const processResumeText = async (text: string): Promise<{
  processedText: string;
  moderation: ModerationResult;
  spellCheck: SpellCheckResult;
  isApproved: boolean;
}> => {
  const moderationResult = await moderateText(text);

  if (!moderationResult.isSafe) {
    return {
      processedText: text,
      moderation: moderationResult,
      spellCheck: { correctedText: text, corrections: [], hasCorrections: false },
      isApproved: false,
    };
  }

  const spellCheckResult = await spellCheck(text);

  return {
    processedText: spellCheckResult.correctedText,
    moderation: moderationResult,
    spellCheck: spellCheckResult,
    isApproved: true,
  };
};

export const isInputSafe = async (text: string): Promise<boolean> => {
  const result = await moderateText(text);
  return result.isSafe;
};

export const edenModerationService = {
  moderateText,
  spellCheck,
  processResumeText,
  isInputSafe,
};

export default edenModerationService;
