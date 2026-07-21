import { describe, expect, it } from 'vitest';
import { getCertificationDisplayParts } from './certificationFormatting';

describe('getCertificationDisplayParts', () => {
  it('separates a generated certificate title from its description', () => {
    expect(getCertificationDisplayParts({
      title: 'Cisco Networking Essentials - completed foundational training in network architecture',
      description: '',
    })).toEqual({
      title: 'Cisco Networking Essentials',
      description: 'completed foundational training in network architecture',
    });
  });

  it('preserves explicitly structured certification fields', () => {
    expect(getCertificationDisplayParts({
      title: 'AWS Certified Developer',
      description: 'Issued by Amazon Web Services',
    })).toEqual({
      title: 'AWS Certified Developer',
      description: 'Issued by Amazon Web Services',
    });
  });

  it('does not split a dash that belongs to the certification name', () => {
    expect(getCertificationDisplayParts('AWS Certified Developer – Associate')).toEqual({
      title: 'AWS Certified Developer – Associate',
      description: '',
    });
  });
});
