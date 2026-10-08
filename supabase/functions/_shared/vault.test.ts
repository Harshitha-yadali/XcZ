// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, siteOf } from './vault.ts';

const key = 'a-long-random-test-key-0123456789abcdef';

describe('vault', () => {
  it('round-trips a password', async () => {
    const stored = await encryptSecret('S3cret! pässword', key);
    expect(stored).not.toContain('S3cret');
    expect(await decryptSecret(stored, key)).toBe('S3cret! pässword');
  });

  it('never produces the same ciphertext twice', async () => {
    expect(await encryptSecret('same', key)).not.toBe(await encryptSecret('same', key));
  });

  it('rejects the wrong key and altered data', async () => {
    const stored = await encryptSecret('secret', key);
    await expect(decryptSecret(stored, `${key}x`)).rejects.toThrow();
    const altered = stored.slice(0, -4) + (stored.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(decryptSecret(altered, key)).rejects.toThrow();
  });

  it('refuses a short key', async () => {
    await expect(encryptSecret('secret', 'short')).rejects.toThrow(/32 characters/);
  });

  it('files a login under the hostname of the job link', () => {
    expect(siteOf('https://Genpact.wd1.myworkdayjobs.com/en-US/jobs/1?x=1')).toBe('genpact.wd1.myworkdayjobs.com');
    expect(siteOf('not a url')).toBe('');
  });
});
