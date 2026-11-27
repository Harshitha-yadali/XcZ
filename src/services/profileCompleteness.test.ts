import { describe, expect, it } from 'vitest';
import { missingProfileFields } from './profileCompleteness';

const complete = {
  full_name: 'Asha Rao',
  email_address: 'asha@example.com',
  phone: '+91 98765 43210',
  current_location: 'Hyderabad',
  education_details: [{ degree: 'B.Tech', school: 'JNTU', year: '2024' }],
  experience_details: [],
};

describe('missingProfileFields', () => {
  it('passes a complete fresher profile', () => {
    expect(missingProfileFields(complete)).toEqual([]);
  });

  it('lists every gap of an empty profile', () => {
    expect(missingProfileFields(null)).toEqual(['Full name', 'Email', 'Phone', 'City', 'Education']);
  });

  it('rejects short phones and blank fields', () => {
    expect(missingProfileFields({ ...complete, phone: '12345', current_location: '  ' })).toEqual(['Phone', 'City']);
  });

  it('reads education stored as JSON text and ignores empty entries', () => {
    expect(missingProfileFields({ ...complete, education_details: '[{"school":"JNTU"}]' })).toEqual([]);
    expect(missingProfileFields({ ...complete, education_details: [{ degree: '', school: '' }] })).toEqual(['Education']);
    expect(missingProfileFields({ ...complete, education_details: 'not json' })).toEqual(['Education']);
  });
});
