import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResumeData } from '../types/resume';
import { openrouter } from './aiProxyService';
import { createInterviewPack, keepSupported } from './interviewPackService';

vi.mock('./aiProxyService', () => ({ openrouter: { chat: vi.fn() } }));

const chat = vi.mocked(openrouter.chat);
const resume = {
  name: 'Asha Rao', phone: '9000000000', email: 'asha@example.com', linkedin: '', github: '', education: [], certifications: [],
  workExperience: [{ role: 'Intern', company: 'Acme', year: '2024', bullets: ['Built Node.js APIs for billing.'] }],
  projects: [], skills: [{ category: 'Tech', count: 1, list: ['Node.js'] }],
} as unknown as ResumeData;
const honest = 'I built Node.js APIs for the billing team and enjoy careful work with other people. '.repeat(5).trim();
const reply = (count = 10, letter = honest) => 'Here it is: ' + JSON.stringify({
  questions: Array.from({ length: count }, (_, i) => ({ question: `How would you deploy on Kubernetes? ${i}`, answer: 'Talk about your Node.js APIs at Acme. Say you run Kubernetes.' })),
  coverLetter: letter,
});

describe('interview pack', () => {
  beforeEach(() => { chat.mockReset(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

  it('keeps job questions but removes claims the resume does not support', async () => {
    chat.mockResolvedValue(reply(10, honest + '\n\nI cut latency by 40%. I look forward to talking.'));
    const pack = await createInterviewPack(resume, 'JD', 'Backend Developer', 'm');
    expect(pack.questions).toHaveLength(10);
    expect(pack.questions[0]).toEqual({ question: 'How would you deploy on Kubernetes? 0', answer: 'Talk about your Node.js APIs at Acme.' });
    expect(pack.coverLetter).toBe(honest + '\n\nI look forward to talking.');
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('does not send contact details to the AI', async () => {
    chat.mockResolvedValue(reply());
    await createInterviewPack(resume, 'JD', '', 'm');
    expect(chat.mock.calls[0][0]).not.toMatch(/9000000000|asha@example|Asha Rao/);
  });

  it('retries once, then fails so the credit is refunded', async () => {
    chat.mockResolvedValueOnce('not json').mockResolvedValueOnce(reply());
    expect((await createInterviewPack(resume, 'JD', '', 'm')).questions).toHaveLength(10);

    chat.mockReset();
    chat.mockResolvedValue(reply(6));
    await expect(createInterviewPack(resume, 'JD', '', 'm')).rejects.toThrow('incomplete');
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('fails when too little of the letter is true', async () => {
    chat.mockResolvedValue(reply(10, 'I led Kubernetes for 12 teams. '.repeat(30)));
    await expect(createInterviewPack(resume, 'JD', '', 'm')).rejects.toThrow('incomplete');
    expect(keepSupported('I use Node.js.', 'Node.js')).toBe('I use Node.js.');
  });
});
