import { openrouter } from './aiProxyService';
import { parseFile } from '../utils/fileParser';

export const extractTextWithOCR = async (file: File): Promise<string> => {
  const result = await parseFile(file);
  return result.text;
};

export const chatWithAI = openrouter.chat.bind(openrouter);
export const summarizeText = openrouter.summarize.bind(openrouter);

export const edenaiProxyService = {
  extractTextWithOCR,
  chatWithAI,
  summarizeText,
};

export default edenaiProxyService;
