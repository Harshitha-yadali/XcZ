import { expect, it, vi } from 'vitest';
import { openrouter } from './aiProxyService';
import { parseResumeFromFile } from './geminiResumeParserService';
import { GEMINI_3_5_FLASH_LITE_MODEL, PINNED_RESUME_PARSER_MODEL } from './openrouterModelConfig';

vi.mock('./aiProxyService', () => ({ openrouter: { chatWithSystem: vi.fn() } }));

it('reads the resume with the paid backup when the free models are busy', async () => {
  const chat = vi.mocked(openrouter.chatWithSystem);
  chat.mockRejectedValueOnce(new Error('AI proxy request failed (429): rate-limited'));
  chat.mockResolvedValueOnce(JSON.stringify({ name: 'Asha Rao', contact: {}, experience: [], education: [] }));
  const text = `Asha Rao\nasha@example.com\n${'Built Node.js APIs for billing. '.repeat(20)}`;
  const resume = await parseResumeFromFile({ name: 'r.txt', type: 'text/plain', text: async () => text } as unknown as File);

  expect(resume.name).toBe('Asha Rao');
  expect(chat.mock.calls.map(([, , options]) => options?.model)).toEqual([PINNED_RESUME_PARSER_MODEL, GEMINI_3_5_FLASH_LITE_MODEL]);
});
