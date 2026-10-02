import { describe, expect, it, vi } from 'vitest';

const { chatWithSystem } = vi.hoisted(() => ({ chatWithSystem: vi.fn() }));

vi.mock('./aiProxyService', () => ({ openrouter: { chatWithSystem } }));

import { deepseekService } from './deepseekService';

const params = { companyName: 'Flex', roleTitle: 'Associate Software Engineer', domain: 'IT', description: 'Original text' };

describe('deepseekService.polishJobDescription', () => {
  it('rejects an empty AI reply so the stored description is not wiped', async () => {
    chatWithSystem.mockResolvedValue('  ');
    await expect(deepseekService.polishJobDescription(params)).rejects.toThrow();
  });

  it('returns the polished text', async () => {
    chatWithSystem.mockResolvedValue('Polished text');
    await expect(deepseekService.polishJobDescription(params)).resolves.toBe('Polished text');
  });
});
