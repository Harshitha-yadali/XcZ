import { openrouter } from './aiProxyService';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const generateText = async (
  prompt: string,
  options: {
    provider?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> => {
  return openrouter.chat(prompt, {
    temperature: options.temperature || 0.3,
    maxTokens: options.maxTokens || 4000,
  });
};

export const chat = async (
  messages: ChatMessage[],
  options: {
    provider?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> => {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const lastMessage = messages[messages.length - 1];

  if (systemMessage) {
    return openrouter.chatWithSystem(systemMessage, lastMessage.content, {
      temperature: options.temperature || 0.3,
    });
  }

  return openrouter.chat(lastMessage.content, {
    temperature: options.temperature || 0.3,
    maxTokens: options.maxTokens || 4000,
  });
};

export const generateTextWithRetry = async (
  prompt: string,
  options: {
    provider?: string;
    temperature?: number;
    maxTokens?: number;
    maxRetries?: number;
  } = {}
): Promise<string> => {
  const { maxRetries = 3, ...generateOptions } = options;
  let lastError: Error | null = null;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateText(prompt, generateOptions);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  throw lastError || new Error('Failed to generate text after retries');
};

export const parseJSONResponse = <T>(response: string): T => {
  if (!response || response.trim().length === 0) {
    throw new Error('Empty response from AI - cannot parse JSON');
  }

  let cleaned = response
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const fixed = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(fixed);
  }
};

export const edenAITextService = {
  generateText,
  generateTextWithRetry,
  chat,
  parseJSONResponse
};
