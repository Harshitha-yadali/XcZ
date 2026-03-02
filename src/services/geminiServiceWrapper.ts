import { openrouter } from './aiProxyService';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class GeminiServiceWrapper {
  async generateText(prompt: string): Promise<string> {
    return openrouter.chat(prompt, {
      temperature: 0.3,
      maxTokens: 4000
    });
  }

  async chat(messages: Message[]): Promise<string> {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const lastMessage = messages[messages.length - 1];

    if (systemMessage) {
      return openrouter.chatWithSystem(systemMessage, lastMessage.content, {
        temperature: 0.3,
      });
    }

    return openrouter.chat(lastMessage.content, {
      temperature: 0.3,
      maxTokens: 4000
    });
  }
}

export const geminiService = new GeminiServiceWrapper();
